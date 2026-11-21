"""Enforce per-project retention. Run regularly (for example daily) from a scheduler.

Example:
    python backend/expire.py

The API only stores each project's retention setting; deletion happens in this job so
a request never performs a large, unbounded cleanup.
"""
import logging
from datetime import timedelta

from sqlalchemy import text

from main import engine, now, stamp

logger = logging.getLogger('Zappa.retention')


def table_exists(db, name):
    """Return True when the optional table is present in the current schema."""
    if db.dialect.name != 'postgresql':
        return db.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
            {'name': name},
        ).scalar() is not None
    return db.execute(text('SELECT to_regclass(:name)'), {'name': name}).scalar() is not None


def enforce_retention(db_engine=engine, log=logger):
    """Delete expired events and session summaries, logging counts per project."""
    totals = {'projects': 0, 'events': 0, 'sessions': 0}
    with db_engine.begin() as db:
        # The deployable API can run without the payment foundation migration, and a
        # self-hosted database may lag behind. Only touch tables that actually exist.
        present = {
            name: table_exists(db, name)
            for name in ('payment_integrations', 'payment_webhook_events', 'payments',
                         'attribution_touchpoints', 'event_properties', 'ai_crawler_requests')
        }
        projects = db.execute(text('SELECT id, name, retention_days FROM projects ORDER BY id')).mappings().all()
        for project in projects:
            cutoff = stamp(now() - timedelta(days=project['retention_days']))
            if present['payment_webhook_events'] and present['payment_integrations']:
                db.execute(text('DELETE FROM payment_webhook_events WHERE integration_id IN (SELECT id FROM payment_integrations WHERE project_id=:id) AND received_at<:cutoff'), {'id':project['id'], 'cutoff': now() - timedelta(days=project['retention_days'])})
            if present['payments']:
                db.execute(text('DELETE FROM payments WHERE project_id=:id AND occurred_at<:cutoff'), {'id':project['id'], 'cutoff': now() - timedelta(days=project['retention_days'])})
            if present['attribution_touchpoints']:
                db.execute(
                    text('DELETE FROM attribution_touchpoints WHERE project_id=:id AND occurred_at<:cutoff'),
                    {'id': project['id'], 'cutoff': now() - timedelta(days=project['retention_days'])},
                )
            if present['event_properties']:
                db.execute(
                    text('DELETE FROM event_properties WHERE project_id=:id AND event_id IN (SELECT id FROM events WHERE project_id=:id AND occurred_at<:cutoff)'),
                    {'id': project['id'], 'cutoff': cutoff},
                )
            if present['ai_crawler_requests']:
                db.execute(
                    text('DELETE FROM ai_crawler_requests WHERE project_id=:id AND requested_at<:cutoff'),
                    {'id': project['id'], 'cutoff': now() - timedelta(days=project['retention_days'])},
                )
            events = db.execute(
                text('DELETE FROM events WHERE project_id=:id AND occurred_at<:cutoff'),
                {'id': project['id'], 'cutoff': cutoff},
            ).rowcount
            sessions = db.execute(
                text('DELETE FROM analytics_sessions WHERE project_id=:id AND last_activity_at<:cutoff'),
                {'id': project['id'], 'cutoff': cutoff},
            ).rowcount
            totals['projects'] += 1
            totals['events'] += events
            totals['sessions'] += sessions
            log.info(
                'retention project=%s name=%s deleted_events=%s deleted_sessions=%s cutoff=%s',
                project['id'], project['name'], events, sessions, cutoff,
            )
    log.info(
        'retention complete projects=%s deleted_events=%s deleted_sessions=%s',
        totals['projects'], totals['events'], totals['sessions'],
    )
    return totals


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    enforce_retention()
