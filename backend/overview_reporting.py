"""Project-scoped, UTC calendar-day overview reporting."""
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import text

MODELS = ('first_touch', 'last_touch', 'last_non_direct')


def report(db, project_id, start_date, end_date, model, conversion_event=None):
    start = datetime.combine(start_date, datetime.min.time(), timezone.utc)
    end = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), timezone.utc)
    length = (end_date - start_date).days + 1
    previous_start = start - timedelta(days=length)
    p = {'project': project_id, 'start': start.isoformat(), 'end': end.isoformat(),
         'previous_start': previous_start.isoformat(), 'touch_start': start, 'touch_end': end, 'conversion_event': conversion_event}
    def metrics(lo, hi):
        args = {**p, 'lo': lo.isoformat(), 'hi': hi.isoformat()}
        row = db.execute(text('''WITH active AS (
          SELECT visitor_id, MIN(occurred_at) AS first_in_window FROM events
          WHERE project_id=:project AND occurred_at>=:lo AND occurred_at<:hi AND visitor_id IS NOT NULL GROUP BY visitor_id
        ) SELECT (SELECT COUNT(*) FROM active) AS visitors,
          (SELECT COUNT(*) FROM events WHERE project_id=:project AND occurred_at>=:lo AND occurred_at<:hi AND name='pageview') AS pageviews,
          (SELECT COUNT(*) FROM analytics_sessions WHERE project_id=:project AND started_at>=:lo AND started_at<:hi) AS sessions,
          (SELECT COUNT(*) FROM active a WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.project_id=:project AND e.visitor_id=a.visitor_id AND e.occurred_at<:lo)) AS new_visitors'''), args).mappings().one()
        result = dict(row)
        result['returning_visitors'] = result['visitors'] - result['new_visitors']
        if conversion_event is None:
            result.update(conversions=None, conversion_rate=None)
        else:
            converted = db.execute(text('SELECT COUNT(DISTINCT visitor_id) FROM events WHERE project_id=:project AND occurred_at>=:lo AND occurred_at<:hi AND name=:conversion_event AND visitor_id IS NOT NULL'), args).scalar_one()
            result.update(conversions=converted, conversion_rate=converted / result['visitors'] if result['visitors'] else 0)
        return result
    current, previous = metrics(start, end), metrics(previous_start, start)
    daily = db.execute(text('''WITH e AS (
       SELECT substr(occurred_at,1,10) AS day, COUNT(DISTINCT visitor_id) AS visitors
       FROM events WHERE project_id=:project AND occurred_at>=:previous_start AND occurred_at<:end GROUP BY 1
    ), s AS (
       SELECT substr(started_at,1,10) AS day, COUNT(*) AS sessions FROM analytics_sessions
       WHERE project_id=:project AND started_at>=:previous_start AND started_at<:end GROUP BY 1
    ) SELECT COALESCE(e.day,s.day) AS day, COALESCE(e.visitors,0) AS visitors, COALESCE(s.sessions,0) AS sessions
      FROM e FULL OUTER JOIN s ON s.day=e.day'''), p).mappings().all()
    by_day = {row['day']: row for row in daily}
    series = []
    for i in range(length):
        day = (start_date + timedelta(days=i)).isoformat()
        prior = (start_date - timedelta(days=length-i)).isoformat()
        point, old = by_day.get(day, {}), by_day.get(prior, {})
        series.append({'date':day, 'visitors':point.get('visitors',0), 'sessions':point.get('sessions',0),
                       'previous_visitors':old.get('visitors',0), 'previous_sessions':old.get('sessions',0)})
    order = {'first_touch':'occurred_at ASC, event_id ASC', 'last_touch':'occurred_at DESC, event_id DESC',
             'last_non_direct':"CASE WHEN utm_source IS NULL AND utm_medium IS NULL AND utm_campaign IS NULL AND utm_content IS NULL AND utm_term IS NULL AND referrer_domain IS NULL THEN 1 ELSE 0 END, occurred_at DESC, event_id DESC"}[model]
    attribution = db.execute(text(f'''WITH active AS (
        SELECT DISTINCT visitor_id FROM attribution_touchpoints WHERE project_id=:project AND occurred_at>=:touch_start AND occurred_at<:touch_end
      ), ranked AS (
        SELECT t.*, ROW_NUMBER() OVER (PARTITION BY t.visitor_id ORDER BY {order}) AS rank
        FROM attribution_touchpoints t JOIN active a ON a.visitor_id=t.visitor_id
        WHERE t.project_id=:project AND t.occurred_at<:touch_end
      ), selected AS (
        SELECT visitor_id, COALESCE(utm_source,referrer_domain,CASE WHEN utm_medium IS NOT NULL OR utm_campaign IS NOT NULL OR utm_content IS NOT NULL OR utm_term IS NOT NULL THEN 'Unknown source' ELSE 'Direct or unknown' END) AS source,
        COALESCE(utm_medium,'Unknown') AS medium, COALESCE(utm_campaign,'Unknown') AS campaign FROM ranked WHERE rank=1
      ), converted AS (
        SELECT DISTINCT visitor_id FROM events WHERE project_id=:project AND occurred_at>=:start AND occurred_at<:end AND name=:conversion_event AND visitor_id IS NOT NULL
      ), session_counts AS (
        SELECT visitor_id,COUNT(*) AS n FROM analytics_sessions WHERE project_id=:project AND started_at>=:start AND started_at<:end GROUP BY visitor_id
      ) SELECT source,medium,campaign,COUNT(*) AS visitors,COALESCE(SUM(s.n),0) AS sessions,COUNT(c.visitor_id) AS converted
        FROM selected a LEFT JOIN session_counts s ON s.visitor_id=a.visitor_id LEFT JOIN converted c ON c.visitor_id=a.visitor_id GROUP BY source,medium,campaign
        ORDER BY visitors DESC,source,medium,campaign LIMIT 50'''), p).mappings().all()
    def conversion_row(row):
        data = dict(row)
        count = data.pop('converted')
        data.update(conversions=count if conversion_event else None, conversion_rate=(count / data['visitors'] if data['visitors'] else 0) if conversion_event else None)
        return data
    acquisition = [conversion_row(row) for row in attribution]
    campaigns = db.execute(text(f'''WITH active AS (
        SELECT DISTINCT visitor_id FROM attribution_touchpoints WHERE project_id=:project AND occurred_at>=:touch_start AND occurred_at<:touch_end
      ), ranked AS (
        SELECT t.*, ROW_NUMBER() OVER (PARTITION BY t.visitor_id ORDER BY {order}) AS rank
        FROM attribution_touchpoints t JOIN active a ON a.visitor_id=t.visitor_id
        WHERE t.project_id=:project AND t.occurred_at<:touch_end
      ), converted AS (
        SELECT DISTINCT visitor_id FROM events WHERE project_id=:project AND occurred_at>=:start AND occurred_at<:end AND name=:conversion_event AND visitor_id IS NOT NULL
      ) SELECT utm_campaign AS campaign, COALESCE(utm_source,referrer_domain,'Unknown source') AS source, COUNT(*) AS visitors, COUNT(c.visitor_id) AS converted
        FROM ranked r LEFT JOIN converted c ON c.visitor_id=r.visitor_id WHERE rank=1 AND utm_campaign IS NOT NULL GROUP BY utm_campaign,2
        ORDER BY visitors DESC, campaign,source LIMIT 10'''), p).mappings().all()
    landing = db.execute(text('''SELECT s.entry_page AS path,COUNT(DISTINCT s.visitor_id) AS visitors,COUNT(*) AS sessions,
        COUNT(DISTINCT CASE WHEN c.session_id IS NOT NULL THEN s.visitor_id END) AS converted
        FROM analytics_sessions s LEFT JOIN (SELECT DISTINCT session_id FROM events WHERE project_id=:project AND occurred_at>=:start AND occurred_at<:end AND name=:conversion_event AND session_id IS NOT NULL) c ON c.session_id=s.session_id
        WHERE s.project_id=:project AND s.started_at>=:start AND s.started_at<:end
        GROUP BY s.entry_page ORDER BY sessions DESC,s.entry_page LIMIT 10'''), p).mappings().all()
    recent = db.execute(text('''SELECT name,path,occurred_at FROM events WHERE project_id=:project AND occurred_at>=:start AND occurred_at<:end ORDER BY occurred_at DESC,id DESC LIMIT 10'''), p).mappings().all()
    return {'start':start_date.isoformat(),'end':end_date.isoformat(),'timezone':'UTC','model':model,
            'metrics':current,'previous':previous,'series':series,'acquisition':acquisition,
            'campaigns':[conversion_row(row) for row in campaigns],
            'landing_pages':[conversion_row(row) for row in landing],
            'recent_activity':[dict(row) for row in recent],'revenue_available':False}
