"""Project-scoped AI referral and crawler reports for the shared overview filters."""
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import text

from ai_traffic import ai_referrer_case_sql


MODEL_ORDER = {
    'first_touch': 't.occurred_at ASC,t.event_id ASC',
    'last_touch': 't.occurred_at DESC,t.event_id DESC',
    'last_non_direct': "CASE WHEN t.utm_source IS NULL AND t.utm_medium IS NULL AND t.utm_campaign IS NULL AND t.utm_content IS NULL AND t.utm_term IS NULL AND t.referrer_domain IS NULL THEN 1 ELSE 0 END,t.occurred_at DESC,t.event_id DESC",
}


def _attribution_cte(model):
    order = MODEL_ORDER[model]
    platform = ai_referrer_case_sql('r.referrer_domain')
    return f"""WITH active AS (
      SELECT DISTINCT visitor_id FROM attribution_touchpoints
      WHERE project_id=:project AND occurred_at>=:touch_start AND occurred_at<:touch_end
    ), ranked AS (
      SELECT t.*, ROW_NUMBER() OVER (PARTITION BY t.visitor_id ORDER BY {order}) AS rank
      FROM attribution_touchpoints t JOIN active a ON a.visitor_id=t.visitor_id
      WHERE t.project_id=:project AND t.occurred_at<:touch_end
    ), selected AS (
      SELECT r.*, {platform} AS ai_platform FROM ranked r WHERE rank=1
    ), ai_visitors AS (
      SELECT * FROM selected WHERE ai_platform IS NOT NULL
    )"""


def _campaign_params(project_id, start_date, end_date):
    start = datetime.combine(start_date, time.min, timezone.utc)
    end = datetime.combine(end_date + timedelta(days=1), time.min, timezone.utc)
    return {
        'project': project_id,
        'start': start.isoformat(),
        'end': end.isoformat(),
        'touch_start': start,
        'touch_end': end,
        'crawler_start': start,
        'crawler_end': end,
    }


def _empty_day(date_value):
    return {
        'date': date_value,
        'referral_visitors': 0,
        'referral_sessions': 0,
        'referral_pageviews': 0,
        'crawler_requests': 0,
    }


def report(db, project_id, start_date, end_date, model, conversion_event=None, crawler_key_configured=False):
    """Return observed AI channels and unverified crawler matches for an inclusive UTC range."""
    params = _campaign_params(project_id, start_date, end_date)
    attribution = _attribution_cte(model)
    conversion = conversion_event or ''

    metrics = db.execute(text(f"""{attribution}
      SELECT COUNT(DISTINCT a.visitor_id) AS visitors,
        COUNT(DISTINCT s.session_id) AS sessions,
        COUNT(DISTINCT CASE WHEN e.name='pageview' THEN e.id END) AS pageviews,
        COUNT(DISTINCT CASE WHEN e.name=:conversion_event THEN e.visitor_id END) AS converted
      FROM ai_visitors a
      LEFT JOIN analytics_sessions s ON s.project_id=:project AND s.visitor_id=a.visitor_id AND s.started_at>=:start AND s.started_at<:end
      LEFT JOIN events e ON e.project_id=:project AND e.visitor_id=a.visitor_id AND e.occurred_at>=:start AND e.occurred_at<:end AND e.name IN ('pageview',:conversion_event)
    """), {**params, 'conversion_event': conversion}).mappings().one()
    visitor_count = int(metrics['visitors'] or 0)
    converted = int(metrics['converted'] or 0)
    referrals_metrics = {
        'visitors': visitor_count,
        'sessions': int(metrics['sessions'] or 0),
        'pageviews': int(metrics['pageviews'] or 0),
        'conversions': converted if conversion_event else None,
        'conversion_rate': (converted / visitor_count if visitor_count else 0) if conversion_event else None,
    }

    platforms = db.execute(text(f"""{attribution}
      SELECT a.ai_platform AS platform, a.referrer_domain AS referrer_hostname,
        a.utm_source, a.utm_medium, a.utm_campaign,
        COUNT(DISTINCT a.visitor_id) AS visitors,
        COUNT(DISTINCT s.session_id) AS sessions,
        COUNT(DISTINCT CASE WHEN e.name='pageview' THEN e.id END) AS pageviews,
        COUNT(DISTINCT CASE WHEN e.name=:conversion_event THEN e.visitor_id END) AS converted
      FROM ai_visitors a
      LEFT JOIN analytics_sessions s ON s.project_id=:project AND s.visitor_id=a.visitor_id AND s.started_at>=:start AND s.started_at<:end
      LEFT JOIN events e ON e.project_id=:project AND e.visitor_id=a.visitor_id AND e.occurred_at>=:start AND e.occurred_at<:end AND e.name IN ('pageview',:conversion_event)
      GROUP BY a.ai_platform,a.referrer_domain,a.utm_source,a.utm_medium,a.utm_campaign
      ORDER BY visitors DESC,platform,referrer_hostname LIMIT 50
    """), {**params, 'conversion_event': conversion}).mappings().all()
    referral_rows = []
    for row in platforms:
        data = dict(row)
        count = int(data.pop('converted') or 0)
        data.update(
            visitors=int(data['visitors'] or 0),
            sessions=int(data['sessions'] or 0),
            pageviews=int(data['pageviews'] or 0),
            conversions=count if conversion_event else None,
            conversion_rate=(count / data['visitors'] if data['visitors'] else 0) if conversion_event else None,
        )
        referral_rows.append(data)

    landing = db.execute(text(f"""{attribution}
      SELECT s.entry_page AS path, COUNT(DISTINCT s.visitor_id) AS visitors,
        COUNT(DISTINCT s.session_id) AS sessions,
        COUNT(DISTINCT CASE WHEN c.visitor_id IS NOT NULL THEN s.visitor_id END) AS converted
      FROM analytics_sessions s JOIN ai_visitors a ON a.visitor_id=s.visitor_id
      LEFT JOIN (
        SELECT DISTINCT session_id,visitor_id FROM events
        WHERE project_id=:project AND occurred_at>=:start AND occurred_at<:end AND name=:conversion_event AND session_id IS NOT NULL
      ) c ON c.session_id=s.session_id AND c.visitor_id=s.visitor_id
      WHERE s.project_id=:project AND s.started_at>=:start AND s.started_at<:end
      GROUP BY s.entry_page ORDER BY sessions DESC,s.entry_page LIMIT 10
    """), {**params, 'conversion_event': conversion}).mappings().all()
    landing_pages = []
    for row in landing:
        data = dict(row)
        count = int(data.pop('converted') or 0)
        data.update(
            visitors=int(data['visitors'] or 0),
            sessions=int(data['sessions'] or 0),
            conversions=count if conversion_event else None,
            conversion_rate=(count / data['visitors'] if data['visitors'] else 0) if conversion_event else None,
        )
        landing_pages.append(data)

    referral_daily = db.execute(text(f"""{attribution},
      e AS (
        SELECT CAST(CAST(e.occurred_at AS TIMESTAMPTZ) AT TIME ZONE 'UTC' AS date) AS day, COUNT(DISTINCT e.visitor_id) AS visitors,
          COUNT(*) FILTER (WHERE e.name='pageview') AS pageviews
        FROM events e JOIN ai_visitors a ON a.visitor_id=e.visitor_id
        WHERE e.project_id=:project AND e.occurred_at>=:start AND e.occurred_at<:end
        GROUP BY 1
      ), s AS (
        SELECT CAST(CAST(s.started_at AS TIMESTAMPTZ) AT TIME ZONE 'UTC' AS date) AS day, COUNT(*) AS sessions
        FROM analytics_sessions s JOIN ai_visitors a ON a.visitor_id=s.visitor_id
        WHERE s.project_id=:project AND s.started_at>=:start AND s.started_at<:end
        GROUP BY 1
      ) SELECT COALESCE(e.day,s.day) AS day,COALESCE(e.visitors,0) AS visitors,
        COALESCE(s.sessions,0) AS sessions,COALESCE(e.pageviews,0) AS pageviews
      FROM e FULL OUTER JOIN s ON e.day=s.day
    """), params).mappings().all()
    by_day = {str(row['day'])[:10]: row for row in referral_daily}
    days = []
    for offset in range((end_date - start_date).days + 1):
        date_value = (start_date + timedelta(days=offset)).isoformat()
        row = by_day.get(date_value, {})
        days.append({
            'date': date_value,
            'referral_visitors': int(row.get('visitors', 0) or 0),
            'referral_sessions': int(row.get('sessions', 0) or 0),
            'referral_pageviews': int(row.get('pageviews', 0) or 0),
            'crawler_requests': 0,
        })

    crawler_totals = db.execute(text("""SELECT COUNT(*) AS requests,
        COUNT(DISTINCT crawler_name) AS unique_crawlers,
        COUNT(DISTINCT path) AS pages, MAX(requested_at) AS latest_at
      FROM ai_crawler_requests
      WHERE project_id=:project AND requested_at>=:crawler_start AND requested_at<:crawler_end
    """), params).mappings().one()
    crawler_platforms = db.execute(text("""SELECT crawler_name AS crawler,organization,category,
        COUNT(*) AS requests,COUNT(DISTINCT path) AS pages,MAX(requested_at) AS last_seen,
        MIN(verification_status) AS verification_status,
        MIN(detection_method) AS detection_method
      FROM ai_crawler_requests
      WHERE project_id=:project AND requested_at>=:crawler_start AND requested_at<:crawler_end
      GROUP BY crawler_name,organization,category
      ORDER BY requests DESC,crawler LIMIT 20
    """), params).mappings().all()
    crawler_pages = db.execute(text("""SELECT path,COUNT(*) AS requests,
        COUNT(DISTINCT crawler_name) AS crawlers,MAX(requested_at) AS last_seen
      FROM ai_crawler_requests
      WHERE project_id=:project AND requested_at>=:crawler_start AND requested_at<:crawler_end
      GROUP BY path ORDER BY requests DESC,path LIMIT 10
    """), params).mappings().all()
    recent = db.execute(text("""SELECT request_id,requested_at,crawler_name AS crawler,organization,category,
        hostname,path,method,status_code,user_agent,detection_method,verification_status
      FROM ai_crawler_requests
      WHERE project_id=:project AND requested_at>=:crawler_start AND requested_at<:crawler_end
      ORDER BY requested_at DESC,request_id DESC LIMIT 10
    """), params).mappings().all()
    crawler_daily = db.execute(text("""SELECT CAST(requested_at AT TIME ZONE 'UTC' AS date) AS day,COUNT(*) AS requests
      FROM ai_crawler_requests
      WHERE project_id=:project AND requested_at>=:crawler_start AND requested_at<:crawler_end
      GROUP BY 1
    """), params).mappings().all()
    crawler_by_day = {row['day'].isoformat(): int(row['requests']) for row in crawler_daily}
    for point in days:
        point['crawler_requests'] = crawler_by_day.get(point['date'], 0)

    return {
        'model': model,
        'crawler_key_configured': bool(crawler_key_configured),
        'referrals': {
            'metrics': referrals_metrics,
            'platforms': referral_rows,
            'landing_pages': landing_pages,
        },
        'crawlers': {
            'metrics': {
                'requests': int(crawler_totals['requests'] or 0),
                'unique_crawlers': int(crawler_totals['unique_crawlers'] or 0),
                'pages': int(crawler_totals['pages'] or 0),
                'latest_at': crawler_totals['latest_at'],
            },
            'platforms': [dict(row) for row in crawler_platforms],
            'top_pages': [dict(row) for row in crawler_pages],
            'recent': [dict(row) for row in recent],
        },
        'series': days,
    }


def crawler_details(db, project_id, start_date, end_date, page=1, page_size=50):
    """Return bounded, tenant-scoped crawler records for a details view/export."""
    params = _campaign_params(project_id, start_date, end_date)
    count = db.execute(text("""SELECT COUNT(*) FROM ai_crawler_requests
      WHERE project_id=:project AND requested_at>=:crawler_start AND requested_at<:crawler_end
    """), params).scalar_one()
    rows = db.execute(text("""SELECT request_id,requested_at,crawler_name AS crawler,organization,category,
        hostname,path,method,status_code,user_agent,detection_method,verification_status
      FROM ai_crawler_requests
      WHERE project_id=:project AND requested_at>=:crawler_start AND requested_at<:crawler_end
      ORDER BY requested_at DESC,request_id DESC LIMIT :limit OFFSET :offset
    """), {**params, 'limit': page_size, 'offset': (page - 1) * page_size}).mappings().all()
    return {
        'start': start_date.isoformat(),
        'end': end_date.isoformat(),
        'page': page,
        'page_size': page_size,
        'total_rows': int(count),
        'rows': [dict(row) for row in rows],
    }
