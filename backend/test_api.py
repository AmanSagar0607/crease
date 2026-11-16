import os
import unittest
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch, AsyncMock
import asyncio
import base64
import httpx
from cryptography.fernet import Fernet
from urllib.parse import parse_qs, urlsplit
from datetime import datetime, time, timedelta, timezone
from sqlalchemy.engine import make_url
from sqlalchemy import create_engine, text
from alembic import command
from alembic.config import Config

test_database_url = os.getenv('TEST_DATABASE_URL')
if not test_database_url or not test_database_url.startswith(('postgresql://', 'postgresql+')):
    raise RuntimeError('Set TEST_DATABASE_URL to an isolated PostgreSQL test database; SQLite and the production DATABASE_URL are not used by this suite.')
test_schema = 'crease_test_' + uuid4().hex
admin_url = make_url(test_database_url)
if admin_url.drivername == 'postgresql':
    admin_url = admin_url.set(drivername='postgresql+psycopg')
admin_engine = create_engine(admin_url)
with admin_engine.begin() as db:
    db.execute(text(f'CREATE SCHEMA "{test_schema}"'))
test_url = admin_url.set(query={**admin_url.query, 'options':f'-csearch_path={test_schema}'}).render_as_string(hide_password=False)
os.environ['DATABASE_URL'] = test_url
alembic_config = Config(str(Path(__file__).with_name('alembic.ini')))
alembic_config.set_main_option('script_location', str(Path(__file__).with_name('migrations')))
command.upgrade(alembic_config, 'head')
from fastapi.testclient import TestClient
import main
import github_install
import expire

def tearDownModule():
    main.engine.dispose()
    try:
        with admin_engine.begin() as db:
            db.execute(text(f'DROP SCHEMA IF EXISTS "{test_schema}" CASCADE'))
    finally:
        admin_engine.dispose()

class ApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        with main.engine.begin() as db:
            for table in ('rate_limits', 'event_properties', 'project_property_keys', 'analytics_sessions', 'events', 'project_repositories', 'project_vercel', 'vercel_connections', 'github_connections', 'projects', 'sessions', 'users'): db.execute(text('DELETE FROM '+table))
            db.execute(text("INSERT INTO users VALUES ('u1','g1','first'),('u2','g2','second')"))
            for user in ('u1','u2'):
                db.execute(text('INSERT INTO sessions VALUES (:token,:user,:expiry)'), {'token':main.digest(user),'user':user,'expiry':main.stamp(main.now()+timedelta(days=1))})

    def verify_project(self, project_id):
        with main.engine.begin() as db:
            db.execute(text('UPDATE projects SET verified_at=:at WHERE id=:id'), {'at':main.stamp(main.now()),'id':project_id})

    def test_rate_limiter_instances_share_one_counter(self):
        second_engine = create_engine(main.DATABASE_URL)
        try:
            first = main.RateLimiter(main.engine, clock=lambda: 1_700_000_000)
            second = main.RateLimiter(second_engine, clock=lambda: 1_700_000_000)
            for _ in range(4):
                self.assertTrue(first.consume('shared-test', 5))
            self.assertTrue(second.consume('shared-test', 5))
            self.assertFalse(first.consume('shared-test', 5))
            with main.engine.connect() as db:
                self.assertEqual(db.execute(text("SELECT hits FROM rate_limits WHERE bucket='shared-test'")).scalar_one(), 6)
        finally:
            second_engine.dispose()

    def test_event_rate_limits_are_durable_per_ip_and_project(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('crease_session', 'u1')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event = {'name':'pageview','timestamp':main.stamp(main.now()),'path':'/hello','visitorId':'v','sessionId':'s'}
        event_headers = {'origin':'https://example.com','x-crease-key':p['write_key']}
        original_ip, original_project = main.RATE_LIMIT_IP_PER_MINUTE, main.RATE_LIMIT_PROJECT_PER_MINUTE
        try:
            main.RATE_LIMIT_IP_PER_MINUTE = 2
            main.RATE_LIMIT_PROJECT_PER_MINUTE = 10
            for event_id in ('a','b'):
                self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[dict(event, id=event_id)]}, headers=event_headers).status_code, 200)
            limited = self.client.post('/api/events', json={'projectId':p['id'],'events':[dict(event, id='c')]}, headers=event_headers)
            self.assertEqual(limited.status_code, 429)
            self.assertEqual(limited.headers.get('retry-after'), '60')
            with main.engine.connect() as db:
                self.assertEqual(db.execute(text("SELECT hits FROM rate_limits WHERE bucket LIKE 'ip:%'")).scalar_one(), 3)

            with main.engine.begin() as db:
                db.execute(text('DELETE FROM rate_limits'))
            main.RATE_LIMIT_IP_PER_MINUTE = 100
            main.RATE_LIMIT_PROJECT_PER_MINUTE = 2
            for event_id in ('d','e'):
                self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[dict(event, id=event_id)]}, headers=event_headers).status_code, 200)
            self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[dict(event, id='f')]}, headers=event_headers).status_code, 429)
            with main.engine.connect() as db:
                self.assertEqual(db.execute(text("SELECT hits FROM rate_limits WHERE bucket=:bucket"), {'bucket':'project:'+p['id']}).scalar_one(), 3)
        finally:
            main.RATE_LIMIT_IP_PER_MINUTE, main.RATE_LIMIT_PROJECT_PER_MINUTE = original_ip, original_project

    def test_project_isolation_dedup_and_deletion(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('crease_session', 'u1')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        self.assertRegex(p['write_key'], r'^crease_[A-Za-z0-9_-]{16,}$')
        event_headers = {'origin':'https://example.com', 'x-crease-key':p['write_key']}
        event = {'id':'event1','name':'pageview','timestamp':main.stamp(main.now()),'path':'/hello','visitorId':'v','sessionId':'s'}
        payload = {'projectId':p['id'],'events':[event]}
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://evil.example', 'x-crease-key':p['write_key']}).status_code,403)
        self.assertEqual(self.client.post('/api/events', json=payload, headers=event_headers).json()['accepted'],1)
        self.assertEqual(self.client.post('/api/events', json=payload, headers=event_headers).json()['accepted'],0)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/summary').json()['metrics']['pageviews'],1)
        summary = self.client.get('/api/projects/'+p['id']+'/summary').json()
        self.assertEqual(len(summary['series']), 30)
        self.assertEqual(summary['series'][-1]['pageviews'], 1)
        self.assertEqual(summary['previous']['pageviews'], 0)
        self.assertIsNotNone(summary['last_event_at'])
        overview = self.client.get('/api/projects').json()
        self.assertEqual(overview[0]['visitors_7d'], 1)
        self.assertEqual(overview[0]['events_7d'], 1)
        alternate = dict(event, id='event2')
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[alternate]}, headers={'origin':'https://www.example.com', 'x-crease-key':p['write_key']}).json()['accepted'],1)
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[dict(event, id='event3')]}, headers={'origin':'https://other.example.com', 'x-crease-key':p['write_key']}).status_code,403)
        self.client.cookies.set('crease_session', 'u2')
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/summary').status_code,404)
        self.assertEqual(self.client.delete('/api/projects/'+p['id'], headers=headers).status_code,404)
        self.client.cookies.set('crease_session', 'u1')
        self.assertEqual(self.client.delete('/api/projects/'+p['id'], headers=headers).status_code,200)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM analytics_sessions WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 0)

    def test_property_registry_and_filters(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('crease_session','u1')
        p = self.client.post('/api/projects', json={'name':'Props','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event_headers = {'origin':'https://example.com','x-crease-key':p['write_key']}
        base = main.now() - timedelta(hours=2)
        events = [
            {'id':'p1','name':'signup','timestamp':main.stamp(base),'path':'/signup','visitorId':'v1','properties':{'seats':3,'trial':True,'beta':True}},
            {'id':'p2','name':'signup','timestamp':main.stamp(base+timedelta(minutes=5)),'path':'/signup','visitorId':'v2','properties':{'seats':1,'trial':False,'beta':2}},
            {'id':'p3','name':'pageview','timestamp':main.stamp(base+timedelta(minutes=10)),'path':'/','visitorId':'v3','properties':{'seats':3}},
        ]
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':events}, headers=event_headers).json()['accepted'], 3)
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[events[0]]}, headers=event_headers).json()['accepted'], 0)
        props = {item['name']: item for item in self.client.get('/api/projects/'+p['id']+'/properties').json()}
        self.assertEqual(set(props), {'seats','trial','beta'})
        self.assertEqual(props['seats']['value_type'], 'number')
        self.assertEqual(props['seats']['event_count'], 3)
        self.assertEqual(props['seats']['distinct_values'], 2)
        self.assertEqual(props['trial']['value_type'], 'boolean')
        self.assertEqual(props['beta']['value_type'], 'mixed')
        self.assertEqual({item['value']: item['count'] for item in props['seats']['values']}, {'3':2,'1':1})

        def event_ids(query):
            return [row['id'] for row in self.client.get('/api/projects/'+p['id']+'/events?'+query).json()]
        self.assertEqual(event_ids('property=seats&value=3'), ['p3','p1'])
        self.assertEqual(event_ids('property=seats&value=3.0'), ['p3','p1'])
        self.assertEqual(event_ids('property=trial&value=true'), ['p1'])
        self.assertEqual(event_ids('property=trial&value=false'), ['p2'])
        self.assertEqual(event_ids('property=seats&value=999'), [])
        self.assertEqual(event_ids('event=signup'), ['p2','p1'])
        self.assertEqual(event_ids('path=/signup'), ['p2','p1'])
        self.assertEqual(event_ids('limit=1'), ['p3'])
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/events?property=missing&value=1').status_code, 422)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/events?property=seats').status_code, 422)

        filtered = self.client.get('/api/projects/'+p['id']+'/summary?days=7&property=seats&value=3').json()
        self.assertEqual(filtered['metrics'], {'events':2,'pageviews':1,'visitors':2,'sessions':2})
        self.assertEqual(filtered['filter'], {'property':'seats','value':'3'})
        self.assertEqual(filtered['pages'], [{'label':'/','count':1}])
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/summary?property=missing&value=1').status_code, 422)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/summary?property=seats').status_code, 422)

        self.client.cookies.set('crease_session', 'u2')
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/properties').status_code, 404)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/events').status_code, 404)
        self.client.cookies.set('crease_session', 'u1')
        self.assertEqual(self.client.delete('/api/projects/'+p['id'], headers=headers).status_code, 200)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM event_properties WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 0)
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM project_property_keys WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 0)

    def test_event_sessions_aggregate_pageviews_and_follow_retention(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('crease_session','u1')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event_headers = {'origin':'https://example.com','x-crease-key':p['write_key']}
        timestamp = main.stamp(main.now())
        events = [
            {'id':'s1','name':'pageview','timestamp':timestamp,'path':'/entry','visitorId':'visitor','sessionId':'session'},
            {'id':'s2','name':'signup','timestamp':timestamp,'path':'/exit','visitorId':'visitor','sessionId':'session'},
        ]
        response = self.client.post('/api/events', json={'projectId':p['id'],'events':events}, headers=event_headers)
        self.assertEqual(response.status_code,200)
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[events[0]]}, headers=event_headers).json()['accepted'],0)
        with main.engine.connect() as db:
            session = db.execute(text('SELECT visitor_id,entry_page,exit_page,pageview_count FROM analytics_sessions WHERE project_id=:id'), {'id':p['id']}).mappings().one()
        self.assertEqual(dict(session), {'visitor_id':'visitor','entry_page':'/entry','exit_page':'/exit','pageview_count':1})
        self.assertEqual(self.client.patch('/api/projects/'+p['id']+'/retention', json={'retention_days':1}, headers={'origin':main.FRONTEND_URL}).status_code,200)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM analytics_sessions WHERE project_id=:id'), {'id':p['id']}).scalar_one(),1)

    def test_sessions_use_server_side_inactivity_window(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('crease_session','u1')
        p = self.client.post('/api/projects', json={'name':'Sessions','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event_headers = {'origin':'https://example.com','x-crease-key':p['write_key']}
        base = main.now().replace(microsecond=0) - timedelta(hours=3)
        def send(event_id, visitor, at):
            event = {'id':event_id,'name':'pageview','timestamp':main.stamp(at),'path':'/','visitorId':visitor,'sessionId':'client-supplied'}
            self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[event]}, headers=event_headers).status_code, 200)
        send('a1', 'v29', base)
        send('a2', 'v29', base + timedelta(minutes=29))
        send('b1', 'v31', base)
        send('b2', 'v31', base + timedelta(minutes=31))
        day = (main.now() - timedelta(days=1)).date()
        day_one = datetime.combine(day, time(23, 50), tzinfo=timezone.utc)
        send('c1', 'vday', day_one)
        send('c2', 'vday', day_one + timedelta(minutes=15))
        with main.engine.connect() as db:
            rows = db.execute(text('SELECT id, session_id FROM events WHERE project_id=:id'), {'id':p['id']}).mappings().all()
            sessions = db.execute(text('SELECT visitor_id, COUNT(*) FROM analytics_sessions WHERE project_id=:id GROUP BY visitor_id'), {'id':p['id']}).all()
        by_id = {row['id']: row['session_id'] for row in rows}
        self.assertEqual(by_id['a1'], by_id['a2'])
        self.assertNotEqual(by_id['b1'], by_id['b2'])
        self.assertNotEqual(by_id['c1'], by_id['c2'])
        self.assertNotEqual(by_id['a1'], 'client-supplied')
        self.assertEqual({row[0]: row[1] for row in sessions}, {'v29':1, 'v31':2, 'vday':2})

    def test_retention_job_deletes_old_events_and_keeps_recent(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('crease_session','u1')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        old = main.stamp(main.now() - timedelta(days=10))
        recent = main.stamp(main.now() - timedelta(days=1))
        with main.engine.begin() as db:
            for event_id, at, session_id in (('old-event', old, 'old-session'), ('recent-event', recent, 'recent-session')):
                db.execute(text('INSERT INTO events (project_id,id,name,occurred_at,path,visitor_id,session_id,properties) VALUES (:project,:id,:name,:at,:path,:visitor,:session,:properties)'), {'project':p['id'],'id':event_id,'name':'pageview','at':at,'path':'/','visitor':'v','session':session_id,'properties':'{}'})
                db.execute(text('INSERT INTO event_properties (project_id,event_id,name,value_text,value_number,value_boolean) VALUES (:project,:id,:name,:text,:number,NULL)'), {'project':p['id'],'id':event_id,'name':'seats','text':'2','number':2})
                db.execute(text('INSERT INTO analytics_sessions (project_id,session_id,visitor_id,started_at,last_activity_at,entry_page,exit_page,pageview_count) VALUES (:project,:session,:visitor,:at,:at,:path,:path,:pageviews)'), {'project':p['id'],'session':session_id,'visitor':'v','at':at,'path':'/','pageviews':1})
        self.assertEqual(self.client.patch('/api/projects/'+p['id']+'/retention', json={'retention_days':7}, headers=headers).status_code,200)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM events WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 2)
        with self.assertLogs('crease.retention', level='INFO') as logs:
            totals = expire.enforce_retention(main.engine)
        self.assertEqual(totals['events'], 1)
        self.assertEqual(totals['sessions'], 1)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT id FROM events WHERE project_id=:id ORDER BY id'), {'id':p['id']}).scalars().all(), ['recent-event'])
            self.assertEqual(db.execute(text('SELECT event_id FROM event_properties WHERE project_id=:id'), {'id':p['id']}).scalars().all(), ['recent-event'])
            self.assertEqual(db.execute(text('SELECT session_id FROM analytics_sessions WHERE project_id=:id'), {'id':p['id']}).scalars().all(), ['recent-session'])
        self.assertTrue(any(p['id'] in line for line in logs.output))

    def test_funnel_counts_ordered_sessions_and_lists_event_names(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('crease_session','u1')
        p = self.client.post('/api/projects', json={'name':'Funnel','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event_headers = {'origin':'https://example.com','x-crease-key':p['write_key']}
        base = main.now() - timedelta(hours=2)
        events = [
            {'id':'f1','name':'view_pricing','timestamp':main.stamp(base),'path':'/pricing','visitorId':'v1'},
            {'id':'f2','name':'signup','timestamp':main.stamp(base+timedelta(minutes=5)),'path':'/signup','visitorId':'v1'},
            {'id':'f3','name':'signup','timestamp':main.stamp(base),'path':'/signup','visitorId':'v2'},
            {'id':'f4','name':'view_pricing','timestamp':main.stamp(base+timedelta(minutes=5)),'path':'/pricing','visitorId':'v2'},
            {'id':'f5','name':'view_pricing','timestamp':main.stamp(base),'path':'/pricing','visitorId':'v3'},
        ]
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':events}, headers=event_headers).json()['accepted'], 5)
        result = self.client.get('/api/projects/'+p['id']+'/funnel?first=view_pricing&second=signup&days=7').json()
        self.assertEqual(result['first_count'], 3)
        self.assertEqual(result['second_count'], 1)
        self.assertEqual(result['conversion'], 0.3333)
        names = {item['label']: item['count'] for item in self.client.get('/api/projects/'+p['id']+'/summary?days=7').json()['event_names']}
        self.assertEqual(names, {'view_pricing':3,'signup':2})
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/funnel?first=missing&second=signup&days=7').json()['first_count'], 0)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/funnel?first=view_pricing&second=signup&days=1').status_code, 422)
        self.client.cookies.set('crease_session','u2')
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/funnel?first=view_pricing&second=signup').status_code, 404)

    def test_authenticated_country_forwarding_and_direct_spoofing(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('crease_session','u1')
        p = self.client.post('/api/projects', json={'name':'Geo','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        base = {'origin':'https://example.com','x-crease-key':p['write_key']}
        def send(event_id, path, extra):
            event = {'id':event_id,'name':'pageview','timestamp':main.stamp(main.now()),'path':'/','visitorId':'v'}
            return self.client.post(path, json={'projectId':p['id'],'events':[event]}, headers={**base, **extra})
        with patch.object(main, 'TRUST_VERCEL_GEO', True), patch.object(main, 'GEO_FORWARD_SECRET', 'test-secret'):
            self.assertEqual(send('direct', '/api/events', {'x-vercel-ip-country':'US', 'x-crease-country':'US'}).status_code, 200)
            self.assertEqual(send('no-secret', '/internal/events', {'x-crease-country':'US'}).status_code, 401)
            self.assertEqual(send('bad-secret', '/internal/events', {'x-crease-forward-secret':'wrong','x-crease-country':'US'}).status_code, 401)
            self.assertEqual(send('invalid', '/internal/events', {'x-crease-forward-secret':'test-secret','x-crease-country':'ZZ'}).status_code, 422)
            self.assertEqual(send('malformed', '/internal/events', {'x-crease-forward-secret':'test-secret','x-crease-country':'us'}).status_code, 422)
            self.assertEqual(send('missing', '/internal/events', {'x-crease-forward-secret':'test-secret'}).status_code, 200)
            self.assertEqual(send('valid', '/internal/events', {'x-crease-forward-secret':'test-secret','x-crease-country':'US'}).status_code, 200)
        with patch.object(main, 'TRUST_VERCEL_GEO', False), patch.object(main, 'GEO_FORWARD_SECRET', 'test-secret'):
            self.assertEqual(send('disabled', '/internal/events', {'x-crease-forward-secret':'test-secret','x-crease-country':'US'}).status_code, 200)
        with main.engine.connect() as db:
            rows = dict(db.execute(text('SELECT id, country FROM events WHERE project_id=:id'), {'id':p['id']}).all())
        self.assertEqual(rows, {'direct':None, 'missing':None, 'valid':'US', 'disabled':None})

    def test_event_preflight_allows_sdk_write_key_header(self):
        response = self.client.options('/api/events', headers={'origin':'https://example.com','access-control-request-method':'POST','access-control-request-headers':'content-type,x-crease-key'})
        self.assertEqual(response.status_code,204)
        self.assertIn('X-Crease-Key',response.headers['access-control-allow-headers'])
        with main.engine.connect() as db: self.assertEqual(db.execute(text('SELECT COUNT(*) FROM events')).scalar_one(),0)

    def test_events_require_project_write_key(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('crease_session', 'u1')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        other = self.client.post('/api/projects', json={'name':'Other','domain':'other.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event = {'id':'event1','name':'pageview','timestamp':main.stamp(main.now()),'path':'/hello','visitorId':'v','sessionId':'s'}
        payload = {'projectId':p['id'],'events':[event]}
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com'}).status_code,401)
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com','x-crease-key':'crease_wrongwrongwrongwrong'}).status_code,401)
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com','x-crease-key':other['write_key']}).status_code,401)
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com','x-crease-key':p['write_key']}).json()['accepted'],1)
        with main.engine.connect() as db:
            stored = db.execute(text('SELECT write_key_hash FROM projects WHERE id=:id'), {'id':p['id']}).scalar_one()
        self.assertEqual(stored, main.digest(p['write_key']))
        self.assertNotIn(p['write_key'], stored)
        rotated = self.client.post('/api/projects/'+p['id']+'/write-key', headers=headers).json()['write_key']
        self.assertNotEqual(rotated, p['write_key'])
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com','x-crease-key':p['write_key']}).status_code,401)
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[dict(event, id='event2')]}, headers={'origin':'https://example.com','x-crease-key':rotated}).json()['accepted'],1)
        listing = {item['id']:item for item in self.client.get('/api/projects').json()}
        self.assertTrue(listing[p['id']]['has_write_key'])
        self.assertNotIn('write_key', listing[p['id']])

    def test_domain_verification_pending_failed_and_passed(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('crease_session', 'u1')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.assertFalse(p['verified'])
        self.assertTrue(p['verification_token'])
        verification = self.client.get('/api/projects/'+p['id']+'/verification').json()
        self.assertFalse(verification['verified'])
        self.assertEqual(verification['record'], 'crease-site-verification='+p['verification_token'])
        self.assertEqual(verification['dns_name'], '_crease-verification.example.com')
        event = {'id':'event1','name':'pageview','timestamp':main.stamp(main.now()),'path':'/hello','visitorId':'v','sessionId':'s'}
        payload = {'projectId':p['id'],'events':[event]}
        event_headers = {'origin':'https://example.com','x-crease-key':p['write_key']}
        self.assertEqual(self.client.post('/api/events', json=payload, headers=event_headers).status_code,403)
        with patch.object(main, 'dns_has_token', new=AsyncMock(return_value=False)):
            failed = self.client.post('/api/projects/'+p['id']+'/verification/check', headers=headers).json()
        self.assertFalse(failed['verified'])
        self.assertIsNone(failed['method'])
        self.assertEqual(self.client.post('/api/events', json=payload, headers=event_headers).status_code,403)
        with patch.object(main, 'dns_has_token', new=AsyncMock(return_value=True)):
            passed = self.client.post('/api/projects/'+p['id']+'/verification/check', headers=headers).json()
        self.assertTrue(passed['verified'])
        self.assertEqual(passed['method'], 'dns')
        self.assertTrue(self.client.get('/api/projects/'+p['id']+'/verification').json()['verified'])
        self.assertEqual(self.client.post('/api/events', json=payload, headers=event_headers).json()['accepted'],1)
        self.client.cookies.set('crease_session', 'u2')
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/verification').status_code,404)
        self.assertEqual(self.client.post('/api/projects/'+p['id']+'/verification/check', headers=headers).status_code,404)

    def test_dns_verification_requires_exact_txt_and_supports_legacy_root(self):
        token = 'example-token'
        expected = main.verification_record(token)
        class Client:
            def __init__(self, answers): self.answers = answers
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def get(self, url, params, headers):
                return httpx.Response(200, json={'Answer': self.answers.get(params['name'], [])})
        def check(answers):
            with patch.object(main.httpx, 'AsyncClient', return_value=Client(answers)):
                return asyncio.run(main.dns_has_token('example.com', token))
        self.assertTrue(check({'_crease-verification.example.com': [{'type':16, 'data':'"'+expected+'"'}]}))
        self.assertTrue(check({'example.com': [{'type':16, 'data':'"'+expected+'"'}]}))
        self.assertFalse(check({'example.com': [{'type':16, 'data':'"prefix'+expected+'suffix"'}]}))
        self.assertFalse(check({'example.com': [{'type':1, 'data':'"'+expected+'"'}]}))
        self.assertFalse(check({}))

    def test_verification_checks_are_rate_limited(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('crease_session', 'u1')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        with patch.object(main, 'VERIFY_LIMIT_PER_MINUTE', 1), patch.object(main, 'dns_has_token', new=AsyncMock(return_value=False)):
            self.assertEqual(self.client.post('/api/projects/'+p['id']+'/verification/check', headers=headers).status_code, 200)
            self.assertEqual(self.client.post('/api/projects/'+p['id']+'/verification/check', headers=headers).status_code, 429)

    def test_mutation_requires_origin_and_auth(self):
        self.assertEqual(self.client.get('/api/projects').status_code,401)
        self.client.cookies.set('crease_session','u1')
        self.assertEqual(self.client.post('/api/projects',json={'name':'x','domain':'x.com'}).status_code,403)

    def test_github_install_checks_ownership_and_public_url(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('crease_session', 'u1')
        project = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        payload = {'repository':'owner/site','path':'index.html','installation_id':1,'write_key':'crease_0123456789abcdef'}
        with patch.object(main, 'GITHUB_APP_SLUG', ''):
            self.assertEqual(self.client.post('/api/projects/'+project['id']+'/github-install', json=payload, headers=headers).status_code,503)
        self.client.cookies.set('crease_session', 'u2')
        self.assertEqual(self.client.post('/api/projects/'+project['id']+'/github-install', json=payload, headers=headers).status_code,404)

    def test_github_app_token_is_bound_to_signed_in_user(self):
        key = Fernet.generate_key().decode()
        with patch.object(main, 'GITHUB_APP_SLUG', 'crease'), patch.object(main, 'GITHUB_APP_CLIENT_ID', 'id'), patch.object(main, 'GITHUB_APP_CLIENT_SECRET', 'secret'), patch.object(main, 'GITHUB_APP_TOKEN_KEY', key):
            encrypted = main.app_cipher().encrypt(main.json.dumps({'token':'test', 'user_id':'u1'}).encode()).decode()
            self.assertEqual(main.app_user_token(encrypted, {'id':'u1'}), 'test')
            with self.assertRaises(main.HTTPException): main.app_user_token(encrypted, {'id':'u2'})

    def test_saved_github_connection_is_encrypted_and_user_scoped(self):
        key = Fernet.generate_key().decode()
        with patch.object(main, 'GITHUB_APP_SLUG', 'crease'), patch.object(main, 'GITHUB_APP_CLIENT_ID', 'id'), patch.object(main, 'GITHUB_APP_CLIENT_SECRET', 'secret'), patch.object(main, 'GITHUB_APP_TOKEN_KEY', key):
            encrypted = main.app_cipher().encrypt(b'github-token').decode()
            with main.engine.begin() as db:
                db.execute(text('INSERT INTO github_connections VALUES (:user,:token)'), {'user':'u1', 'token':encrypted})
            self.assertNotIn('github-token', encrypted)
            self.assertEqual(main.app_user_token(None, {'id':'u1'}), 'github-token')
            with self.assertRaises(main.HTTPException): main.app_user_token(None, {'id':'u2'})

    def test_repository_pagination_includes_later_pages(self):
        responses = [{'repositories':[{'full_name':str(i)} for i in range(100)]}, {'repositories':[{'full_name':'owner/last'}]}]
        with patch.object(main, 'github_app_request', new=AsyncMock(side_effect=responses)) as request:
            repos, truncated = asyncio.run(main.github_app_pages('token', '/repos', 'repositories'))
        self.assertEqual(len(repos), 101)
        self.assertEqual(repos[-1]['full_name'], 'owner/last')
        self.assertFalse(truncated)
        self.assertEqual(request.await_count, 2)

    def test_installation_detects_next_layout_and_preserves_consent_gate(self):
        writes = []
        source = 'export default function Layout() { return <html><body>Site</body></html>; }'
        def handler(request):
            path = request.url.path
            if request.method == 'GET' and path == '/repos/owner/site': return httpx.Response(200, json={'default_branch':'main'})
            if path.endswith('/contents/index.html'): return httpx.Response(404, json={'message':'Not Found'})
            if request.method == 'GET' and path.endswith('/contents/src/app/layout.tsx'):
                return httpx.Response(200, json={'encoding':'base64', 'size':len(source), 'content':base64.b64encode(source.encode()).decode(), 'sha':'file-sha'})
            if path.endswith('/branches/main'): return httpx.Response(200, json={'commit':{'sha':'commit-sha'}})
            if request.method == 'POST' and path.endswith('/git/refs'): return httpx.Response(201, json={})
            if request.method == 'PUT' and path.endswith('/contents/src/app/layout.tsx'):
                writes.append(main.json.loads(request.content)); return httpx.Response(200, json={})
            if request.method == 'POST' and path.endswith('/pulls'): return httpx.Response(201, json={'html_url':'https://github.com/owner/site/pull/1'})
            return httpx.Response(404, json={'message':'Not Found'})
        real_client = httpx.AsyncClient
        with patch.object(github_install.httpx, 'AsyncClient', side_effect=lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw)):
            result = asyncio.run(github_install.create_install_pr('token','owner/site','index.html','project-id','https://crease.example','crease_0123456789abcdef'))
        updated = base64.b64decode(writes[0]['content']).decode()
        self.assertEqual(result['url'], 'https://github.com/owner/site/pull/1')
        self.assertIn('data-crease-install', updated)
        self.assertIn('crease:consent', updated)
        self.assertIn('writeKey', updated)
        self.assertLess(updated.index('data-crease-install'), updated.index('</body>'))

    def test_installation_status_identifies_project_on_default_branch(self):
        source = '<script data-crease-install>project-123</script>'
        def handler(request):
            if request.url.path == '/repos/owner/site': return httpx.Response(200, json={'default_branch':'main'})
            if request.url.path.endswith('/contents/index.html'):
                return httpx.Response(200, json={'encoding':'base64','size':len(source),'content':base64.b64encode(source.encode()).decode()})
            return httpx.Response(404, json={})
        real_client = httpx.AsyncClient
        with patch.object(github_install.httpx, 'AsyncClient', side_effect=lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw)):
            found = asyncio.run(github_install.installation_status('token','owner/site','project-123'))
            other = asyncio.run(github_install.installation_status('token','owner/site','project-456'))
        self.assertEqual(found['state'], 'installed')
        self.assertEqual(found['branch'], 'main')
        self.assertEqual(other['state'], 'different_project')

    def test_project_git_connection_is_owner_scoped(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('crease_session','u1')
        project = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()['id']
        payload = {'repository':'Owner/Site','installation_id':42}
        responses = [([{'id':42,'app_slug':'crease'}], False), ([{'full_name':'Owner/Site'}], False)]
        with patch.object(main, 'GITHUB_APP_SLUG', 'crease'), patch.object(main, 'app_user_token', return_value='test'), patch.object(main, 'github_app_pages', new=AsyncMock(side_effect=responses)):
            self.assertEqual(self.client.put('/api/projects/'+project+'/git', json=payload, headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/api/projects/'+project+'/git').json()['repository']['full_name'], 'Owner/Site')
        self.client.cookies.set('crease_session','u2')
        self.assertEqual(self.client.get('/api/projects/'+project+'/git').status_code,404)
        self.assertEqual(self.client.delete('/api/projects/'+project+'/git', headers=headers).status_code,404)
        self.client.cookies.set('crease_session','u1')
        self.assertEqual(self.client.delete('/api/projects/'+project+'/git', headers=headers).status_code,200)
        self.assertIsNone(self.client.get('/api/projects/'+project+'/git').json()['repository'])

    def test_vercel_settings_scoped_and_preserve_other_settings(self):
        headers = {'origin': main.FRONTEND_URL}; self.client.cookies.set('crease_session', 'u1')
        project = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()['id']
        provider = {'id':'prj_123','name':'example','gitComments':{'onCommit':False,'onPullRequest':True},'gitLFS':False,'gitProviderOptions':{'requireVerifiedCommits':True,'disableRepositoryDispatchEvents':False}}
        async def fake_api(token, team, method, path, body=None):
            self.assertEqual((token,team), ('token','team_123'))
            if method == 'PATCH':
                self.assertEqual(body['gitComments'], {'onCommit':True,'onPullRequest':True})
                return {**provider, **body}
            return provider
        with patch.object(main, 'vercel_connection', return_value=('token','team_123')), patch.object(main, 'vercel_request', side_effect=fake_api):
            self.assertEqual(self.client.post('/api/projects/'+project+'/vercel', json={'vercel_project_id':'prj_123'}, headers=headers).status_code,200)
            result = self.client.patch('/api/projects/'+project+'/vercel/git', json={'on_commit':True}, headers=headers)
            self.assertEqual(result.status_code,200)
            self.assertTrue(result.json()['settings']['on_commit'])
            self.client.cookies.set('crease_session','u2')
            self.assertEqual(self.client.get('/api/projects/'+project+'/vercel/git').status_code,404)
            self.assertEqual(self.client.patch('/api/projects/'+project+'/vercel/git', json={'git_lfs':True}, headers=headers).status_code,404)

    def test_vercel_authorization_state_is_bound_and_single_use(self):
        self.client.cookies.set('crease_session', 'u1')
        class Response:
            status_code = 200
            def json(self): return {'access_token':'vercel-secret','team_id':'team_123'}
        class Client:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def post(self, *args, **kwargs): return Response()
        key = Fernet.generate_key().decode()
        with patch.object(main, 'VERCEL_INTEGRATION_SLUG', 'crease'), patch.object(main, 'VERCEL_INTEGRATION_CLIENT_ID', 'id'), patch.object(main, 'VERCEL_INTEGRATION_CLIENT_SECRET', 'secret'), patch.object(main, 'VERCEL_TOKEN_KEY', key), patch.object(main.httpx, 'AsyncClient', Client):
            start = self.client.get('/api/vercel/connect', follow_redirects=False)
            state = parse_qs(urlsplit(start.headers['location']).query)['state'][0]
            state_cookie = self.client.cookies.get('crease_vercel_state')
            invalid = self.client.get('/api/vercel/callback', params={'code':'test','state':'incorrect'}, follow_redirects=False)
            self.assertEqual(invalid.status_code,400)
            invalid_next = self.client.get('/api/vercel/callback', params={'code':'test','state':state,'next':'https://example.com/steal'}, follow_redirects=False)
            self.assertEqual(invalid_next.status_code,400)
            callback = self.client.get('/api/vercel/callback', params={'code':'test','state':state}, follow_redirects=False)
            self.assertEqual(callback.status_code,302)
            self.assertEqual(main.vercel_connection('u1'), ('vercel-secret','team_123'))
            with main.engine.connect() as db:
                encrypted = db.execute(text('SELECT encrypted_token FROM vercel_connections WHERE user_id=:user'), {'user':'u1'}).scalar_one()
                self.assertNotIn('vercel-secret',encrypted)
            self.client.cookies.set('crease_vercel_state',state_cookie)
            self.assertEqual(self.client.get('/api/vercel/callback', params={'code':'test','state':state}, follow_redirects=False).status_code,400)

    def test_vercel_git_settings_map_event_and_status_flags(self):
        settings = main.git_settings({'gitProviderOptions': {'createDeployments':'disabled', 'disableRepositoryDispatchEvents':True, 'gitCommitStatus':False, 'consolidatedGitCommitStatus':{'enabled':True,'propagateFailures':False}}})
        self.assertFalse(settings['deployment_status_events'])
        self.assertFalse(settings['repository_dispatch_events'])
        self.assertFalse(settings['git_commit_status'])
        self.assertTrue(settings['consolidated_commit_status'])
        self.assertTrue(settings['soft_failures'])
        self.assertIsNone(settings['require_verified_commits'])

    def test_vercel_inherited_settings_accept_explicit_overrides(self):
        headers={'origin':main.FRONTEND_URL}; self.client.cookies.set('crease_session','u1')
        project = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()['id']
        with main.engine.begin() as db:
            db.execute(text('INSERT INTO project_vercel VALUES (:id,:user,:vercel)'), {'id':project,'user':'u1','vercel':'prj_123'})
        old = {'id':'prj_123','name':'site','gitProviderOptions':{}}
        async def fake_api(token, team, method, path, body=None):
            if method == 'PATCH':
                self.assertEqual(body['gitProviderOptions'], {'requireVerifiedCommits':True,'disableRepositoryDispatchEvents':False})
                return {**old, **body}
            return old
        with patch.object(main, 'vercel_connection', return_value=('token','team')), patch.object(main, 'vercel_request', side_effect=fake_api):
            response = self.client.patch('/api/projects/'+project+'/vercel/git', json={'require_verified_commits':True,'repository_dispatch_events':True}, headers=headers)
        self.assertEqual(response.status_code,200)

    def test_git_disconnect_preserves_vercel_but_project_delete_cleans_it(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('crease_session','u1')
        project = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()['id']
        with main.engine.begin() as db:
            db.execute(text('INSERT INTO project_vercel VALUES (:id,:user,:vercel)'), {'id':project,'user':'u1','vercel':'prj_123'})
        self.assertEqual(self.client.delete('/api/projects/'+project+'/git', headers=headers).status_code,200)
        self.assertEqual(main.linked_vercel_project(project,'u1'),'prj_123')
        self.assertEqual(self.client.delete('/api/projects/'+project, headers=headers).status_code,200)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM project_vercel WHERE project_id=:id'), {'id':project}).scalar_one(),0)

    def test_vercel_hooks_hide_existing_urls_and_require_project_owner(self):
        headers={'origin':main.FRONTEND_URL}; self.client.cookies.set('crease_session','u1')
        project = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()['id']
        with main.engine.begin() as db:
            db.execute(text('INSERT INTO project_vercel VALUES (:id,:user,:vercel)'), {'id':project,'user':'u1','vercel':'prj_123'})
        hook = {'id':'hook_1','name':'CMS','ref':'main','url':'https://api.vercel.com/v1/integrations/deploy/prj_123/secret'}
        async def fake_api(token, team, method, path, body=None, query=None): return {'link':{'deployHooks':[hook]}}
        with patch.object(main, 'vercel_connection', return_value=('token','team')), patch.object(main, 'vercel_request', side_effect=fake_api):
            listed = self.client.get('/api/projects/'+project+'/vercel/hooks')
            self.assertEqual(listed.headers['cache-control'], 'no-store')
            self.assertNotIn('secret', listed.text)
            created = self.client.post('/api/projects/'+project+'/vercel/hooks', json={'name':'CMS','ref':'main'}, headers=headers)
            self.assertEqual(created.status_code,200)
            self.assertEqual(created.headers['cache-control'],'no-store')
            self.client.cookies.set('crease_session','u2')
            self.assertEqual(self.client.get('/api/projects/'+project+'/vercel/hooks').status_code,404)
            self.assertEqual(self.client.delete('/api/projects/'+project+'/vercel/hooks/hook_1', headers=headers).status_code,404)

    def test_github_oauth_creates_session_and_rejects_reused_state(self):
        class FakeResponse:
            status_code = 200
            def __init__(self, payload): self.payload = payload
            def json(self): return self.payload
        class GitHubClient:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def post(self, *args, **kwargs): return FakeResponse({'access_token':'test-token'})
            async def get(self, *args, **kwargs): return FakeResponse({'id':12345, 'login':'octocat'})
        with patch.object(main, 'CLIENT_ID', 'test-id'), patch.object(main, 'CLIENT_SECRET', 'test-secret'), patch.object(main, 'PUBLIC_API_URL', 'http://localhost:3000'), patch.object(main, 'FRONTEND_URL', 'http://localhost:3000'), patch.object(main.httpx, 'AsyncClient', GitHubClient):
            start = self.client.get('/api/auth/github', follow_redirects=False)
            self.assertEqual(start.status_code, 302)
            params = parse_qs(urlsplit(start.headers['location']).query)
            self.assertEqual(params['redirect_uri'][0], 'http://localhost:3000/api/auth/callback')
            state = params['state'][0]
            callback = self.client.get('/api/auth/callback', params={'code':'code','state':state}, follow_redirects=False)
            self.assertEqual(callback.status_code,302)
            self.assertEqual(self.client.get('/api/me').json()['login'],'octocat')
            self.client.cookies.set('crease_oauth', state)
            self.assertEqual(self.client.get('/api/auth/callback', params={'code':'code','state':state}, follow_redirects=False).status_code,400)

if __name__ == '__main__': unittest.main()
