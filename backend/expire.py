"""Run regularly (for example daily) to enforce per-project retention."""
from datetime import timedelta
from sqlalchemy import text
from main import engine, now, stamp

with engine.begin() as db:
    projects = db.execute(text('SELECT id, retention_days FROM projects')).mappings().all()
    for project in projects:
        cutoff = stamp(now()-timedelta(days=project['retention_days']))
        db.execute(text('DELETE FROM events WHERE project_id=:id AND occurred_at<:cutoff'), {'id':project['id'], 'cutoff':cutoff})
        db.execute(text('DELETE FROM analytics_sessions WHERE project_id=:id AND last_activity_at<:cutoff'), {'id':project['id'], 'cutoff':cutoff})
