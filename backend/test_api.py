import os
import unittest
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch, AsyncMock
import asyncio
import base64
import hashlib
import hmac
import json
import time as wall_time
import httpx
import jwt
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
test_schema = 'Zappa_test_' + uuid4().hex
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
        self._verified_claims = {'token': {'sub':'u1','name':'First User'}, 'token-u2': {'sub':'u2','name':'Second User'}}
        self._verifier_patch = patch.object(main, 'verify_clerk_token', side_effect=lambda token: self._verified_claims[token] if token in self._verified_claims else (_ for _ in ()).throw(__import__('fastapi').HTTPException(401, 'Invalid test token')))
        self._verifier_patch.start()
        with main.engine.begin() as db:
            for table in ('ai_crawler_requests', 'geo_forward_replays', 'waitlist_signups', 'rate_limits', 'project_goals', 'event_properties', 'project_property_keys', 'analytics_sessions', 'events', 'project_repositories', 'project_vercel', 'vercel_connections', 'github_connections', 'projects', 'clerk_profiles'): db.execute(text('DELETE FROM '+table))

    def tearDown(self):
        self._verifier_patch.stop()
        self.client.close()

    def verify_project(self, project_id):
        with main.engine.begin() as db:
            db.execute(text('UPDATE projects SET verified_at=:at WHERE id=:id'), {'at':main.stamp(main.now()),'id':project_id})

    def signed_geo_request(self, project_id, write_key, event_id, country='IN', region_code='KA', city='Bengaluru', nonce=None):
        from uuid import uuid4
        nonce = nonce or str(uuid4())
        timestamp = str(int(wall_time.time()))
        event = {'id':event_id,'name':'pageview','timestamp':main.stamp(main.now()),'path':'/geo-test','visitorId':'geo-visitor','sessionId':str(uuid4()),'properties':{}}
        payload = {'projectId':project_id,'events':[event]}
        body = json.dumps(payload, separators=(',', ':')).encode()
        country_names = {'IN':'India','US':'United States'}
        geo = {'country':country,'country_name':country_names.get(country.upper(), 'India'),'region_code':region_code,'region_name':'Karnataka','city_name':city,'continent_code':'AS','timezone':'Asia/Kolkata','latitude':12.97,'longitude':77.59,'postal_code':'560001','geo_source':'cloudflare'}
        envelope = base64.urlsafe_b64encode(json.dumps(geo, separators=(',', ':')).encode()).decode().rstrip('=')
        payload_hash = hashlib.sha256(body).hexdigest()
        canonical = f'zappa-geo-v1\n{timestamp}\n{nonce}\n{project_id}\n{payload_hash}\n{envelope}'.encode()
        signature = hmac.new(b'test-cloudflare-secret-with-at-least-32-bytes', canonical, hashlib.sha256).hexdigest()
        headers = {'origin':'https://example.com','x-Zappa-key':write_key,'x-zappa-geo-timestamp':timestamp,'x-zappa-geo-nonce':nonce,'x-zappa-geo-envelope':envelope,'x-zappa-geo-signature':signature}
        return body, headers

    def test_ai_crawler_key_rotation_and_ingestion_are_deduplicated_and_tenant_scoped(self):
        self.client.cookies.set('__session', 'token')
        project = self.client.post('/api/projects', json={'name':'Crawler site','domain':'example.com'}, headers={'origin':main.FRONTEND_URL}).json()
        other = self.client.post('/api/projects', json={'name':'Other','domain':'other.example'}, headers={'origin':main.FRONTEND_URL}).json()
        key_response = self.client.post(f"/api/projects/{project['id']}/ai-crawler-key", headers={'origin':main.FRONTEND_URL})
        self.assertEqual(key_response.status_code, 201, key_response.text)
        key = key_response.json()['crawler_key']
        self.assertTrue(key.startswith('ZappaCrawler_'))
        record = {'requestId':'test-request-001','timestamp':main.stamp(main.now()),'hostname':'example.com','path':'/docs','method':'GET','statusCode':200,'userAgent':'GPTBot/1.0'}
        payload = {'projectId':project['id'],'requests':[record]}
        response = self.client.post('/api/ai-crawlers', json=payload, headers={'x-zappa-crawler-key':key})
        self.assertEqual(response.status_code, 202, response.text)
        duplicate = self.client.post('/api/ai-crawlers', json=payload, headers={'x-zappa-crawler-key':key})
        self.assertEqual(duplicate.json()['accepted'], 0)
        wrong_tenant = self.client.post('/api/ai-crawlers', json={'projectId':other['id'],'requests':[record]}, headers={'x-zappa-crawler-key':key})
        self.assertEqual(wrong_tenant.status_code, 401)
        private_data = self.client.get(f"/api/projects/{project['id']}/ai-crawlers?start={main.now().date()}&end={main.now().date()}")
        self.assertEqual(private_data.status_code, 200, private_data.text)
        self.assertEqual(private_data.json()['total_rows'], 1)
        self.assertEqual(private_data.json()['rows'][0]['verification_status'], 'unverified')

    def test_cloudflare_geo_hmac_stores_normalized_snapshot_and_rejects_replay(self):
        self.client.cookies.set('__session', 'token')
        with patch.object(main, 'GEO_CF_HMAC_SECRET', 'test-cloudflare-secret-with-at-least-32-bytes'):
            project = self.client.post('/api/projects', json={'name':'Geo site','domain':'example.com'}, headers={'origin':main.FRONTEND_URL}).json()
            self.verify_project(project['id'])
            body, headers = self.signed_geo_request(project['id'], project['write_key'], 'geo-event-1')
            response = self.client.post('/internal/events/geo', content=body, headers=headers)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['accepted'], 1)
            replay = self.client.post('/internal/events/geo', content=body, headers=headers)
            self.assertEqual(replay.status_code, 401)
        with main.engine.connect() as db:
            row = db.execute(text('SELECT country,country_name,region_code,city_name,continent_code,timezone,latitude,longitude,postal_code,geo_source FROM events WHERE id=:id'), {'id':'geo-event-1'}).mappings().one()
        self.assertEqual((row['country'], row['country_name'], row['region_code'], row['city_name'], row['geo_source']), ('IN', 'India', 'KA', 'Bengaluru', 'cloudflare'))
        self.assertEqual((row['continent_code'], row['timezone'], row['latitude'], row['longitude'], row['postal_code']), ('AS', 'Asia/Kolkata', 12.97, 77.59, '560001'))

    def test_cloudflare_geo_bad_hmac_and_browser_supplied_metadata_are_ignored(self):
        self.client.cookies.set('__session', 'token')
        with patch.object(main, 'GEO_CF_HMAC_SECRET', 'test-cloudflare-secret-with-at-least-32-bytes'):
            project = self.client.post('/api/projects', json={'name':'Geo trust','domain':'example.com'}, headers={'origin':main.FRONTEND_URL}).json()
            self.verify_project(project['id'])
            body, headers = self.signed_geo_request(project['id'], project['write_key'], 'geo-event-bad')
            headers['x-zappa-geo-signature'] = '0' * 64
            self.assertEqual(self.client.post('/internal/events/geo', content=body, headers=headers).status_code, 401)
            public = self.client.post('/api/events', content=body, headers={'origin':'https://example.com','x-Zappa-key':project['write_key'],'x-zappa-geo-envelope':headers['x-zappa-geo-envelope'],'x-zappa-geo-signature':headers['x-zappa-geo-signature']})
            self.assertEqual(public.status_code, 200, public.text)
        with main.engine.connect() as db:
            row = db.execute(text('SELECT geo_source,city_name,region_name FROM events WHERE id=:id'), {'id':'geo-event-bad'}).mappings().one()
        self.assertIsNone(row['geo_source'])
        self.assertIsNone(row['city_name'])
        self.assertIsNone(row['region_name'])
        today = main.now().date().isoformat()
        unknown = self.client.get(f"/api/projects/{project['id']}/geography?level=country&start={today}&end={today}")
        self.assertEqual(unknown.json()['rows'][0]['label'], 'Unknown')

    def test_geography_drilldown_is_date_and_project_scoped(self):
        self.client.cookies.set('__session', 'token')
        with patch.object(main, 'GEO_CF_HMAC_SECRET', 'test-cloudflare-secret-with-at-least-32-bytes'):
            project = self.client.post('/api/projects', json={'name':'Geo drilldown','domain':'example.com'}, headers={'origin':main.FRONTEND_URL}).json()
            other = self.client.post('/api/projects', json={'name':'Other geo','domain':'other.example'}, headers={'origin':main.FRONTEND_URL}).json()
            self.verify_project(project['id'])
            self.verify_project(other['id'])
            for event_id, country, region, city in [('g1','in','ka','Bengaluru'),('g2','IN','MH','मुंबई'),('g3','US','CA','San Francisco')]:
                body, headers = self.signed_geo_request(project['id'], project['write_key'], event_id, country, region, city)
                response = self.client.post('/internal/events/geo', content=body, headers=headers)
                self.assertEqual(response.status_code, 200, response.text)
            body, headers = self.signed_geo_request(other['id'], other['write_key'], 'g4', 'IN', 'KA', 'Bengaluru')
            headers['origin'] = 'https://other.example'
            self.assertEqual(self.client.post('/internal/events/geo', content=body, headers=headers).status_code, 200)
        today = main.now().date().isoformat()
        countries = self.client.get(f"/api/projects/{project['id']}/geography?level=country&timezone=Asia%2FKolkata&start={today}&end={today}&page_size=1")
        self.assertEqual(countries.status_code, 200, countries.text)
        self.assertEqual(countries.json()['timezone'], 'Asia/Kolkata')
        self.assertEqual(len(countries.json()['rows']), 1)
        self.assertEqual(countries.json()['total_rows'], 2)
        self.assertEqual(countries.json()['rows'][0]['country_code'], 'IN')
        countries_page_two = self.client.get(f"/api/projects/{project['id']}/geography?level=country&timezone=Asia%2FKolkata&start={today}&end={today}&page_size=1&page=2")
        self.assertEqual(countries_page_two.json()['rows'][0]['country_code'], 'US')
        regions = self.client.get(f"/api/projects/{project['id']}/geography?level=region&country=IN&start={today}&end={today}")
        self.assertEqual({row['region_code'] for row in regions.json()['rows']}, {'KA','MH'})
        city = self.client.get(f"/api/projects/{project['id']}/geography?level=city&country=IN&region_code=KA&start={today}&end={today}")
        self.assertEqual([row['label'] for row in city.json()['rows']], ['Bengaluru'])
        self.assertEqual(city.json()['rows'][0]['visitors'], 1)
        unicode_city = self.client.get(f"/api/projects/{project['id']}/geography?level=city&country=IN&region_code=MH&start={today}&end={today}")
        self.assertEqual([row['label'] for row in unicode_city.json()['rows']], ['मुंबई'])
        self.assertEqual(self.client.get(f"/api/projects/{other['id']}/geography?level=city&country=IN&region_code=KA&start={today}&end={today}").json()['total_visitors'], 1)

    def test_waitlist_requires_valid_email_and_consent_and_deduplicates(self):
        first = self.client.post('/api/waitlist', json={'email':'  Maker@Example.com ', 'consent':True})
        duplicate = self.client.post('/api/waitlist', json={'email':'maker@example.com', 'consent':True})
        self.assertEqual((first.status_code, duplicate.status_code), (202, 202))
        self.assertEqual(first.json(), duplicate.json())
        with main.engine.connect() as db:
            rows = db.execute(text('SELECT email,consented_at FROM waitlist_signups')).mappings().all()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['email'], 'maker@example.com')
        self.assertIsNotNone(rows[0]['consented_at'])
        self.assertEqual(self.client.post('/api/waitlist', json={'email':'not-an-email', 'consent':True}).status_code, 422)
        self.assertEqual(self.client.post('/api/waitlist', json={'email':'maker2@example.com', 'consent':False}).status_code, 422)
        self.assertEqual(self.client.post('/api/waitlist', json={'email':'', 'consent':True}).status_code, 422)

    def test_project_goals_count_observed_events_and_enforce_ownership(self):
        self.client.cookies.set('__session', 'token')
        headers = {'origin':main.FRONTEND_URL}
        project = self.client.post('/api/projects', json={'name':'Goal site','domain':'example.com'}, headers=headers).json()
        self.verify_project(project['id'])
        event_headers = {'origin':'https://example.com','x-Zappa-key':project['write_key']}
        now = main.now()
        events = [
            {'id':'goal-one','name':'signup','timestamp':main.stamp(now-timedelta(minutes=2)),'path':'/signup','visitorId':'v1'},
            {'id':'goal-two','name':'signup','timestamp':main.stamp(now-timedelta(minutes=1)),'path':'/signup','visitorId':'v2'},
            {'id':'other-event','name':'pageview','timestamp':main.stamp(now),'path':'/','visitorId':'v1'},
        ]
        self.assertEqual(self.client.post('/api/events', json={'projectId':project['id'],'events':events}, headers=event_headers).json()['accepted'], 3)
        created = self.client.post(f'/api/projects/{project["id"]}/goals', json={'name':'Signups','event_name':'signup','target_count':5}).json()
        self.assertEqual(created['target_count'], 5)
        result = self.client.get(f'/api/projects/{project["id"]}/goals?start={now.date()}&end={now.date()}').json()
        self.assertEqual(len(result), 1)
        self.assertEqual((result[0]['current_count'], result[0]['progress']), (2, 0.4))
        self.assertEqual(self.client.post(f'/api/projects/{project["id"]}/goals', json={'name':'Missing','event_name':'not_seen','target_count':1}).status_code, 422)
        self.assertEqual(self.client.post(f'/api/projects/{project["id"]}/goals', json={'name':'Invalid','event_name':'signup','target_count':0}).status_code, 422)
        self.assertEqual(self.client.post(f'/api/projects/{project["id"]}/goals', json={'name':'Signups','event_name':'signup','target_count':1}).status_code, 409)
        goal_id = created['id']
        self.client.cookies.set('__session', 'token-u2')
        self.assertEqual(self.client.get(f'/api/projects/{project["id"]}/goals').status_code, 404)
        self.assertEqual(self.client.get(f'/api/projects/{project["id"]}/goal-events').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/projects/{project["id"]}/goals/{goal_id}', json={'name':'stolen','event_name':'signup','target_count':1}).status_code, 404)
        self.assertEqual(self.client.delete(f'/api/projects/{project["id"]}/goals/{goal_id}').status_code, 404)
        self.client.cookies.set('__session', 'token')
        updated = self.client.patch(f'/api/projects/{project["id"]}/goals/{goal_id}', json={'name':'New signups','event_name':'signup','target_count':10})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(self.client.delete(f'/api/projects/{project["id"]}/goals/{goal_id}').status_code, 204)
        self.assertEqual(self.client.get(f'/api/projects/{project["id"]}/goals').json(), [])

    def test_attribution_persists_evidence_deduplicates_and_is_tenant_scoped(self):
        self.client.cookies.set('__session', 'token')
        headers = {'origin':main.FRONTEND_URL}
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event_headers = {'origin':'https://example.com','x-Zappa-key':p['write_key']}
        base = {'name':'pageview','timestamp':main.stamp(main.now()-timedelta(hours=2)),'path':'/landing','visitorId':'visitor'}
        event = dict(base, id='first', referrer='search.example', attribution={'utm_source':'search','utm_campaign':'spring'})
        direct = dict(base, id='second', referrer='example.com')
        later = dict(base, id='third', timestamp=main.stamp(main.now()), referrer='social.example', attribution={'utm_source':'social'})
        payload = {'projectId':p['id'],'events':[event,direct,later]}
        self.assertEqual(self.client.post('/api/events', json=payload, headers=event_headers).json()['accepted'],3)
        self.assertEqual(self.client.post('/api/events', json=payload, headers=event_headers).json()['accepted'],0)
        with main.engine.connect() as db:
            rows = db.execute(text('SELECT event_id,visitor_id,session_id,referrer_domain,utm_source,utm_campaign FROM attribution_touchpoints WHERE project_id=:id ORDER BY event_id'), {'id':p['id']}).mappings().all()
        self.assertEqual(len(rows), 3)
        self.assertEqual((rows[0]['referrer_domain'],rows[0]['utm_source'],rows[0]['utm_campaign']),('search.example','search','spring'))
        self.assertIsNone(rows[1]['referrer_domain'])
        self.assertIsNone(rows[1]['utm_source'])
        self.assertEqual(rows[0]['visitor_id'],rows[1]['visitor_id'])
        self.assertEqual(rows[0]['session_id'],rows[1]['session_id'])
        self.assertNotEqual(rows[0]['session_id'],rows[2]['session_id'])
        self.assertEqual(rows[0]['visitor_id'],rows[2]['visitor_id'])
        bad = dict(base,id='bad',attribution={'utm_source':'person@example.com'})
        self.assertEqual(self.client.post('/api/events',json={'projectId':p['id'],'events':[bad]},headers=event_headers).status_code,422)
        self.client.cookies.set('__session','token-u2')
        self.assertEqual(self.client.delete('/api/projects/'+p['id'],headers=headers).status_code,404)
        self.client.cookies.set('__session','token')
        self.assertEqual(self.client.delete('/api/projects/'+p['id'],headers=headers).status_code,200)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT count(*) FROM attribution_touchpoints WHERE project_id=:id'), {'id':p['id']}).scalar_one(),0)

    def test_overview_utc_ranges_attribution_and_isolation(self):
        self.client.cookies.set('__session', 'token')
        p = self.client.post('/api/projects', json={'name':'Overview','domain':'example.com'}, headers={'origin':main.FRONTEND_URL}).json()
        self.verify_project(p['id'])
        day = main.now().date()-timedelta(days=2)
        at = datetime.combine(day, datetime.min.time(), timezone.utc)
        events = [
            {'id':'old','name':'pageview','timestamp':main.stamp(at-timedelta(days=1)),'path':'/old','visitorId':'v1','attribution':{'utm_source':'search','utm_campaign':'launch'}},
            {'id':'one','name':'pageview','timestamp':main.stamp(at+timedelta(hours=1)),'path':'/landing','visitorId':'v1','referrer':'social.example'},
            {'id':'two','name':'pageview','timestamp':main.stamp(at+timedelta(hours=1,minutes=2)),'path':'/pricing','visitorId':'v1','referrer':'example.com'},
            {'id':'three','name':'pageview','timestamp':main.stamp(at+timedelta(hours=2)),'path':'/landing','visitorId':'v2','attribution':{'utm_source':'email','utm_medium':'newsletter','utm_campaign':'launch'}},
            {'id':'boundary','name':'pageview','timestamp':main.stamp(at+timedelta(days=1)),'path':'/later','visitorId':'v3'},
        ]
        self.assertEqual(self.client.post('/api/events',json={'projectId':p['id'],'events':events},headers={'origin':'https://example.com','x-Zappa-key':p['write_key']}).json()['accepted'],5)
        url=f'/api/projects/{p["id"]}/overview?start={day}&end={day}'
        first=self.client.get(url).json()
        dates=f'start={day}&end={day}'
        summary=self.client.get(f'/api/projects/{p["id"]}/summary?{dates}').json()
        self.assertEqual((summary['metrics']['visitors'],summary['metrics']['sessions'],summary['metrics']['pageviews']),(2,2,3))
        self.assertEqual(summary['previous']['pageviews'],1)
        self.assertEqual(len(summary['series']),1)
        recent=self.client.get(f'/api/projects/{p["id"]}/events?{dates}').json()
        self.assertEqual({event['id'] for event in recent},{'one','two','three'})
        funnel=self.client.get(f'/api/projects/{p["id"]}/funnel?first=pageview&second=pageview&{dates}').json()
        self.assertEqual((funnel['first_count'],funnel['second_count']),(2,2))
        self.assertEqual(self.client.get(f'/api/projects/{p["id"]}/events?start={day}').status_code,422)
        self.assertEqual({k:first['metrics'][k] for k in ('visitors','sessions','pageviews','new_visitors','returning_visitors')},{'visitors':2,'sessions':2,'pageviews':3,'new_visitors':1,'returning_visitors':1})
        self.assertEqual(first['previous']['visitors'],1)
        self.assertIsNone(first['metrics']['conversions'])
        self.assertEqual(first['landing_pages'][0]['path'],'/landing')
        self.assertEqual(first['landing_pages'][0]['sessions'],2)
        self.assertEqual(len(first['recent_activity']),3)
        self.assertIn('search', [r['source'] for r in first['acquisition']])
        self.assertEqual(sum(r['visitors'] for r in first['campaigns']),2)
        last=self.client.get(url+'&model=last_touch').json()
        non_direct=self.client.get(url+'&model=last_non_direct').json()
        self.assertIn('Direct or unknown',[r['source'] for r in last['acquisition']])
        self.assertIn('social.example',[r['source'] for r in non_direct['acquisition']])
        signup={'id':'signup','name':'signup','timestamp':main.stamp(at+timedelta(hours=1,minutes=5)),'path':'/signup','visitorId':'v1'}
        duplicate_visitor={**signup,'id':'signup-again','timestamp':main.stamp(at+timedelta(hours=1,minutes=6))}
        self.assertEqual(self.client.post('/api/events',json={'projectId':p['id'],'events':[signup,duplicate_visitor]},headers={'origin':'https://example.com','x-Zappa-key':p['write_key']}).json()['accepted'],2)
        converted=self.client.get(url+'&conversion_event=signup').json()
        self.assertEqual((converted['metrics']['conversions'],converted['metrics']['conversion_rate']),(1,0.5))
        self.assertEqual(sum(row['conversions'] for row in converted['acquisition']),1)
        self.assertEqual(sum(row['conversions'] for row in converted['campaigns']),1)
        self.assertEqual(converted['landing_pages'][0]['conversions'],1)
        self.assertEqual(self.client.get(url+'&conversion_event=missing').json()['metrics']['conversions'],0)
        self.assertEqual(self.client.get(url+'&model=bad').status_code,422)
        self.assertEqual(self.client.get(f'/api/projects/{p["id"]}/overview?start={day}&end={day-timedelta(days=1)}').status_code,422)
        self.assertEqual(self.client.get(f'/api/projects/{p["id"]}/overview?start={day-timedelta(days=90)}&end={day}').status_code,422)
        empty=self.client.get(f'/api/projects/{p["id"]}/overview?start={day-timedelta(days=5)}&end={day-timedelta(days=5)}').json()
        self.assertEqual(empty['metrics']['visitors'],0)
        self.assertEqual(empty['acquisition'],[])
        self.client.cookies.set('__session','token-u2')
        self.assertEqual(self.client.get(url).status_code,404)
        self.client.cookies.clear()
        self.assertEqual(self.client.get(url).status_code,401)

    def test_acquisition_models_preserve_first_and_last_non_direct_across_sessions(self):
        self.client.cookies.set('__session','token')
        headers={'origin':main.FRONTEND_URL}
        p=self.client.post('/api/projects',json={'name':'Acquisition','domain':'example.com'},headers=headers).json()
        self.verify_project(p['id'])
        base=main.now()-timedelta(hours=3)
        events=[
            {'id':'a','name':'pageview','timestamp':main.stamp(base),'path':'/landing','visitorId':'v1','referrer':'search.example','attribution':{'utm_source':'search'}},
            {'id':'b','name':'pageview','timestamp':main.stamp(base+timedelta(hours=1)),'path':'/pricing','visitorId':'v1','referrer':'social.example'},
            {'id':'c','name':'pageview','timestamp':main.stamp(base+timedelta(hours=2)),'path':'/','visitorId':'v1','referrer':'example.com'},
            {'id':'d','name':'pageview','timestamp':main.stamp(base),'path':'/','visitorId':'v2'},
            {'id':'e','name':'pageview','timestamp':main.stamp(base),'path':'/','visitorId':'v3','attribution':{'utm_campaign':'spring'}},
        ]
        self.assertEqual(self.client.post('/api/events',json={'projectId':p['id'],'events':events},headers={'origin':'https://example.com','x-Zappa-key':p['write_key']}).json()['accepted'],5)
        def report(model):
            response=self.client.get('/api/projects/'+p['id']+'/acquisition?days=7&model='+model)
            self.assertEqual(response.status_code,200)
            return response.json()
        first=report('first_touch')
        self.assertEqual(first['total_visitors'],3)
        self.assertEqual({(x['type'],x['source'],x['visitors']) for x in first['sources']},{('campaign','search',1),('direct_or_unknown','Direct or unknown',1),('campaign','Unknown source',1)})
        last=report('last_touch')
        self.assertIn({'type':'direct_or_unknown','source':'Direct or unknown','visitors':2},last['sources'])
        non_direct=report('last_non_direct')
        self.assertIn({'type':'referral','source':'social.example','visitors':1},non_direct['sources'])
        self.assertIn({'type':'direct_or_unknown','source':'Direct or unknown','visitors':1},non_direct['sources'])
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/acquisition?model=invalid').status_code,422)
        self.client.cookies.set('__session','token-u2')
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/acquisition').status_code,404)

    def test_ingestion_rejects_large_streams_and_overlong_project_ids(self):
        response = self.client.post('/api/events', content=iter([b'x' * 20000, b'y' * 20000]), headers={'content-type':'application/json'})
        self.assertEqual(response.status_code, 413)
        response = self.client.post('/api/events', json={'projectId':'x' * 1000, 'events':[]})
        self.assertEqual(response.status_code, 422)

    def test_stripe_webhooks_verify_deduplicate_and_reconcile_refunds(self):
        self.client.cookies.set('__session','token')
        headers = {'origin':main.FRONTEND_URL}
        p = self.client.post('/api/projects', json={'name':'Pay','domain':'example.com'}, headers=headers).json()
        key, secret = Fernet.generate_key().decode(), 'whsec_12345678901234567890'
        with patch.object(main, 'PAYMENT_ENCRYPTION_KEY', key):
            response = self.client.post('/api/projects/'+p['id']+'/payment-integrations/stripe', json={'signing_secret':secret,'live_mode':False}, headers=headers)
            self.assertEqual(response.status_code, 201)
            integration = response.json()['id']
            path = '/api/payment-webhooks/stripe/' + integration
            with main.engine.connect() as db:
                stored = db.execute(text('SELECT encrypted_signing_secret FROM payment_integrations WHERE id=:id'), {'id':integration}).scalar_one()
            self.assertNotIn(secret, stored)
            def send(event_id, event_type, refunded=0, signature=True, live=False, amount=1000):
                body = json.dumps({'id':event_id,'type':event_type,'livemode':live,'data':{'object':{'object':'charge','id':'ch_123','paid':True,'captured':True,'amount_captured':amount,'amount_refunded':refunded,'currency':'usd','created':int(wall_time.time()),'customer':'cus_123'}}}, separators=(',',':')).encode()
                timestamp = str(int(wall_time.time()))
                digest = hmac.new(secret.encode(), timestamp.encode()+b'.'+body, hashlib.sha256).hexdigest() if signature else '0'*64
                return self.client.post(path, content=body, headers={'stripe-signature':'t='+timestamp+',v1='+digest,'content-type':'application/json'})
            self.assertEqual(send('evt_bad','charge.succeeded',signature=False).status_code,400)
            self.assertEqual(send('evt_wrongmode','charge.succeeded',live=True).status_code,400)
            self.assertEqual(send('evt_refund','charge.refunded',refunded=400).status_code,200)
            self.assertEqual(send('evt_success','charge.succeeded',refunded=0).status_code,200)
            self.assertTrue(send('evt_refund','charge.refunded',refunded=400).json()['duplicate'])
            self.assertEqual(send('evt_conflict','charge.succeeded',amount=900).status_code,409)
            with main.engine.connect() as db:
                payment = db.execute(text('SELECT amount_minor,refunded_minor,currency FROM payments WHERE project_id=:id'), {'id':p['id']}).mappings().one()
                self.assertEqual((payment['amount_minor'],payment['refunded_minor'],payment['currency']),(1000,400,'USD'))
                self.assertEqual(db.execute(text('SELECT count(*) FROM payment_webhook_events WHERE integration_id=:id'), {'id':integration}).scalar_one(),2)
            self.client.cookies.set('__session','token-u2')
            self.assertEqual(self.client.get('/api/projects/'+p['id']+'/payment-integrations/stripe').status_code,404)
            self.assertEqual(self.client.delete('/api/projects/'+p['id']+'/payment-integrations/stripe',headers=headers).status_code,404)
            self.client.cookies.set('__session','token')
            self.assertEqual(self.client.delete('/api/projects/'+p['id']+'/payment-integrations/stripe',headers=headers).status_code,200)
            self.assertEqual(send('evt_after','charge.succeeded').status_code,404)
            with main.engine.connect() as db:
                self.assertEqual(db.execute(text('SELECT count(*) FROM payments WHERE project_id=:id'), {'id':p['id']}).scalar_one(),1)
            self.assertEqual(self.client.delete('/api/projects/'+p['id'],headers=headers).status_code,200)
            with main.engine.connect() as db:
                self.assertEqual(db.execute(text('SELECT count(*) FROM payments WHERE project_id=:id'), {'id':p['id']}).scalar_one(),0)

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
        self.client.cookies.set('__session', 'token')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event = {'name':'pageview','timestamp':main.stamp(main.now()),'path':'/hello','visitorId':'v','sessionId':'s'}
        event_headers = {'origin':'https://example.com','x-Zappa-key':p['write_key']}
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
        self.client.cookies.set('__session', 'token')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        self.assertRegex(p['write_key'], r'^Zappa_[A-Za-z0-9_-]{16,}$')
        event_headers = {'origin':'https://example.com', 'x-Zappa-key':p['write_key']}
        event = {'id':'event1','name':'pageview','timestamp':main.stamp(main.now()),'path':'/hello','visitorId':'v','sessionId':'s'}
        payload = {'projectId':p['id'],'events':[event]}
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://evil.example', 'x-Zappa-key':p['write_key']}).status_code,403)
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
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[alternate]}, headers={'origin':'https://www.example.com', 'x-Zappa-key':p['write_key']}).json()['accepted'],1)
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[dict(event, id='event3')]}, headers={'origin':'https://other.example.com', 'x-Zappa-key':p['write_key']}).status_code,403)
        self.client.cookies.set('__session', 'token-u2')
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/summary').status_code,404)
        self.assertEqual(self.client.delete('/api/projects/'+p['id'], headers=headers).status_code,404)
        self.client.cookies.set('__session', 'token')
        self.assertEqual(self.client.delete('/api/projects/'+p['id'], headers=headers).status_code,200)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM analytics_sessions WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 0)

    def test_property_registry_and_filters(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'Props','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event_headers = {'origin':'https://example.com','x-Zappa-key':p['write_key']}
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

        self.client.cookies.set('__session', 'token-u2')
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/properties').status_code, 404)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/events').status_code, 404)
        self.client.cookies.set('__session', 'token')
        self.assertEqual(self.client.delete('/api/projects/'+p['id'], headers=headers).status_code, 200)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM event_properties WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 0)
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM project_property_keys WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 0)

    def test_event_sessions_aggregate_pageviews_and_follow_retention(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event_headers = {'origin':'https://example.com','x-Zappa-key':p['write_key']}
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
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'Sessions','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event_headers = {'origin':'https://example.com','x-Zappa-key':p['write_key']}
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
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        old = main.stamp(main.now() - timedelta(days=10))
        recent = main.stamp(main.now() - timedelta(days=1))
        with main.engine.begin() as db:
            for event_id, at, session_id in (('old-event', old, 'old-session'), ('recent-event', recent, 'recent-session')):
                db.execute(text('INSERT INTO events (project_id,id,name,occurred_at,path,visitor_id,session_id,properties) VALUES (:project,:id,:name,:at,:path,:visitor,:session,:properties)'), {'project':p['id'],'id':event_id,'name':'pageview','at':at,'path':'/','visitor':'v','session':session_id,'properties':'{}'})
                db.execute(text('INSERT INTO event_properties (project_id,event_id,name,value_text,value_number,value_boolean) VALUES (:project,:id,:name,:text,:number,NULL)'), {'project':p['id'],'id':event_id,'name':'seats','text':'2','number':2})
                db.execute(text('INSERT INTO attribution_touchpoints (project_id,event_id,visitor_id,session_id,occurred_at,landing_page) VALUES (:project,:id,:visitor,:session,:at,:path)'), {'project':p['id'],'id':event_id,'visitor':'v','session':session_id,'at':main.parse_stamp(at),'path':'/'})
                db.execute(text("INSERT INTO payments (project_id,provider,live_mode,provider_transaction_id,amount_minor,refunded_minor,currency,occurred_at) VALUES (:project,'stripe',false,:id,100,0,'USD',:at)"), {'project':p['id'],'id':event_id,'at':main.parse_stamp(at)})
                db.execute(text('INSERT INTO analytics_sessions (project_id,session_id,visitor_id,started_at,last_activity_at,entry_page,exit_page,pageview_count) VALUES (:project,:session,:visitor,:at,:at,:path,:path,:pageviews)'), {'project':p['id'],'session':session_id,'visitor':'v','at':at,'path':'/','pageviews':1})
        self.assertEqual(self.client.patch('/api/projects/'+p['id']+'/retention', json={'retention_days':7}, headers=headers).status_code,200)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM events WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 2)
        with self.assertLogs('Zappa.retention', level='INFO') as logs:
            totals = expire.enforce_retention(main.engine)
        self.assertEqual(totals['events'], 1)
        self.assertEqual(totals['sessions'], 1)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT id FROM events WHERE project_id=:id ORDER BY id'), {'id':p['id']}).scalars().all(), ['recent-event'])
            self.assertEqual(db.execute(text('SELECT event_id FROM event_properties WHERE project_id=:id'), {'id':p['id']}).scalars().all(), ['recent-event'])
            self.assertEqual(db.execute(text('SELECT event_id FROM attribution_touchpoints WHERE project_id=:id'), {'id':p['id']}).scalars().all(), ['recent-event'])
            self.assertEqual(db.execute(text('SELECT provider_transaction_id FROM payments WHERE project_id=:id'), {'id':p['id']}).scalars().all(), ['recent-event'])
            self.assertEqual(db.execute(text('SELECT session_id FROM analytics_sessions WHERE project_id=:id'), {'id':p['id']}).scalars().all(), ['recent-session'])
        self.assertTrue(any(p['id'] in line for line in logs.output))

    def test_funnel_counts_ordered_sessions_and_lists_event_names(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'Funnel','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event_headers = {'origin':'https://example.com','x-Zappa-key':p['write_key']}
        base = main.now() - timedelta(hours=2)
        events = [
            {'id':'f1','name':'view_pricing','timestamp':main.stamp(base),'path':'/pricing','visitorId':'v1'},
            {'id':'f2','name':'signup','timestamp':main.stamp(base+timedelta(minutes=5)),'path':'/signup','visitorId':'v1'},
            {'id':'f3','name':'signup','timestamp':main.stamp(base),'path':'/signup','visitorId':'v2'},
            {'id':'f4','name':'view_pricing','timestamp':main.stamp(base+timedelta(minutes=5)),'path':'/pricing','visitorId':'v2'},
            {'id':'f5','name':'view_pricing','timestamp':main.stamp(base),'path':'/pricing','visitorId':'v3'},
            {'id':'f6','name':'purchase','timestamp':main.stamp(base+timedelta(minutes=10)),'path':'/thanks','visitorId':'v1'},
        ]
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':events}, headers=event_headers).json()['accepted'], 6)
        result = self.client.get('/api/projects/'+p['id']+'/funnel?first=view_pricing&second=signup&days=7').json()
        self.assertEqual(result['first_count'], 3)
        self.assertEqual(result['second_count'], 1)
        self.assertEqual(result['conversion'], 0.3333)
        names = {item['label']: item['count'] for item in self.client.get('/api/projects/'+p['id']+'/summary?days=7').json()['event_names']}
        self.assertEqual(names, {'view_pricing':3,'signup':2,'purchase':1})
        multi = self.client.get('/api/projects/'+p['id']+'/funnel/multi?steps=view_pricing&steps=signup&steps=purchase&days=7').json()
        self.assertEqual([step['count'] for step in multi['steps']], [3,1,1])
        self.assertEqual([step['conversion_from_previous'] for step in multi['steps']], [None,0.3333,1.0])
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/funnel/multi?steps=signup').status_code, 422)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/funnel/multi?steps=a&steps=b&steps=c&steps=d&steps=e&steps=f').status_code, 422)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/funnel?first=missing&second=signup&days=7').json()['first_count'], 0)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/funnel?first=view_pricing&second=signup&days=1').status_code, 422)
        self.client.cookies.set('__session','token-u2')
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/funnel?first=view_pricing&second=signup').status_code, 404)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/funnel/multi?steps=view_pricing&steps=signup').status_code, 404)

    def test_local_ip_geolocation_ignores_country_headers_and_direct_spoofing(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'Geo','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        base = {'origin':'https://example.com','x-Zappa-key':p['write_key']}
        def send(event_id, path, extra):
            event = {'id':event_id,'name':'pageview','timestamp':main.stamp(main.now()),'path':'/','visitorId':'v'}
            return self.client.post(path, json={'projectId':p['id'],'events':[event]}, headers={**base, **extra})
        def resolve(ip):
            return 'US' if ip == '203.0.113.5' else None
        with patch.object(main, 'geoip_country', side_effect=resolve), patch.object(main, 'GEO_FORWARD_SECRET', 'test-secret'):
            self.assertEqual(send('direct', '/api/events', {'x-vercel-ip-country':'US', 'x-Zappa-country':'US'}).status_code, 200)
            self.assertEqual(send('no-secret', '/internal/events', {'x-Zappa-client-ip':'203.0.113.5'}).status_code, 401)
            self.assertEqual(send('bad-secret', '/internal/events', {'x-Zappa-forward-secret':'wrong','x-Zappa-client-ip':'203.0.113.5'}).status_code, 401)
            self.assertEqual(send('country-header-only', '/internal/events', {'x-Zappa-forward-secret':'test-secret','x-Zappa-country':'US'}).status_code, 200)
            self.assertEqual(send('missing', '/internal/events', {'x-Zappa-forward-secret':'test-secret'}).status_code, 200)
            self.assertEqual(send('resolved', '/internal/events', {'x-Zappa-forward-secret':'test-secret','x-Zappa-client-ip':'203.0.113.5'}).status_code, 200)
        with main.engine.connect() as db:
            rows = dict(db.execute(text('SELECT id, country FROM events WHERE project_id=:id'), {'id':p['id']}).all())
        self.assertEqual(rows, {'direct':None, 'country-header-only':None, 'missing':None, 'resolved':'US'})

    def test_bot_user_agents_are_acknowledged_but_not_stored(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'Bots','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        base = {'origin':'https://example.com','x-Zappa-key':p['write_key']}
        event = {'id':'bot-1','name':'pageview','timestamp':main.stamp(main.now()),'path':'/','visitorId':'v'}
        for agent in ('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                      'curl/8.4.0', 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36',
                      'Mozilla/5.0 (compatible; UptimeRobot/2.0)'):
            response = self.client.post('/api/events', json={'projectId':p['id'],'events':[event]}, headers={**base,'user-agent':agent})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {'accepted':0,'filtered':'bot'})
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM events WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 0)
        browser = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[event]}, headers={**base,'user-agent':browser}).json()['accepted'], 1)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM events WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 1)

    def test_forwarded_client_ip_is_resolved_locally_when_secret_is_configured(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'Geo default','domain':'example.com'}, headers=headers).json()
        self.verify_project(p['id'])
        base = {'origin':'https://example.com','x-Zappa-key':p['write_key']}
        event = {'id':'geo-1','name':'pageview','timestamp':main.stamp(main.now()),'path':'/','visitorId':'v'}
        with patch.object(main, 'GEO_FORWARD_SECRET', 'test-secret'), patch.object(main, 'geoip_country', return_value='DE') as resolver:
            response = self.client.post('/internal/events', json={'projectId':p['id'],'events':[event]}, headers={**base,'x-Zappa-forward-secret':'test-secret','x-Zappa-client-ip':'203.0.113.10','x-Zappa-country':'US'})
        self.assertEqual(response.status_code, 200)
        resolver.assert_called_once_with('203.0.113.10')
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT country FROM events WHERE id=:id'), {'id':'geo-1'}).scalar_one(), 'DE')

    def test_retention_endpoint_requires_secret_and_deletes_expired_rows(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'Cron','domain':'example.com'}, headers=headers).json()
        self.assertEqual(self.client.patch('/api/projects/'+p['id']+'/retention', json={'retention_days':7}, headers=headers).status_code, 200)
        with main.engine.begin() as db:
            db.execute(text('INSERT INTO events (project_id,id,name,occurred_at,path,visitor_id,session_id,properties) VALUES (:project,:id,:name,:at,:path,:visitor,:session,:properties)'), {'project':p['id'],'id':'expired','name':'pageview','at':main.stamp(main.now()-timedelta(days=30)),'path':'/','visitor':'v','session':'s','properties':'{}'})
        self.assertEqual(self.client.post('/internal/retention').status_code, 401)
        self.assertEqual(self.client.post('/internal/retention', headers={'x-Zappa-retention-secret':'wrong'}).status_code, 401)
        with patch.object(main, 'RETENTION_SECRET', 'cron-secret'):
            response = self.client.post('/internal/retention', headers={'x-Zappa-retention-secret':'cron-secret'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['events'], 1)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM events WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 0)

    def test_scheduled_retention_helper_runs_without_an_external_cron(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'Scheduled','domain':'example.com'}, headers=headers).json()
        self.assertEqual(self.client.patch('/api/projects/'+p['id']+'/retention', json={'retention_days':7}, headers=headers).status_code, 200)
        with main.engine.begin() as db:
            db.execute(text('INSERT INTO events (project_id,id,name,occurred_at,path,visitor_id,session_id,properties) VALUES (:project,:id,:name,:at,:path,:visitor,:session,:properties)'), {'project':p['id'],'id':'scheduled-old','name':'pageview','at':main.stamp(main.now()-timedelta(days=30)),'path':'/','visitor':'v','session':'s','properties':'{}'})
        totals = asyncio.run(main.retention_once())
        self.assertGreaterEqual(totals['events'], 1)
        self.assertEqual(main.app.state.retention_last_totals, totals)
        self.assertIsNotNone(main.app.state.retention_last_run)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM events WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 0)

    def test_retention_tolerates_absent_payment_tables(self):
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        p = self.client.post('/api/projects', json={'name':'No payments','domain':'example.com'}, headers=headers).json()
        self.assertEqual(self.client.patch('/api/projects/'+p['id']+'/retention', json={'retention_days':7}, headers=headers).status_code, 200)
        old = main.stamp(main.now() - timedelta(days=30))
        with main.engine.begin() as db:
            db.execute(text('INSERT INTO events (project_id,id,name,occurred_at,path,visitor_id,session_id,properties) VALUES (:project,:id,:name,:at,:path,:visitor,:session,:properties)'), {'project':p['id'],'id':'old-event','name':'pageview','at':old,'path':'/','visitor':'v','session':'s','properties':'{}'})
        real = expire.table_exists
        def only_core(db, name):
            if name.startswith('payment'):
                return False
            return real(db, name)
        with patch.object(expire, 'table_exists', side_effect=only_core):
            totals = expire.enforce_retention(main.engine)
        self.assertEqual(totals['events'], 1)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM events WHERE project_id=:id'), {'id':p['id']}).scalar_one(), 0)

    def test_event_preflight_allows_sdk_write_key_header(self):
        response = self.client.options('/api/events', headers={'origin':'https://example.com','access-control-request-method':'POST','access-control-request-headers':'content-type,x-Zappa-key'})
        self.assertEqual(response.status_code,204)
        self.assertIn('X-Zappa-Key',response.headers['access-control-allow-headers'])
        with main.engine.connect() as db: self.assertEqual(db.execute(text('SELECT COUNT(*) FROM events')).scalar_one(),0)

    def test_events_require_project_write_key(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('__session', 'token')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        other = self.client.post('/api/projects', json={'name':'Other','domain':'other.com'}, headers=headers).json()
        self.verify_project(p['id'])
        event = {'id':'event1','name':'pageview','timestamp':main.stamp(main.now()),'path':'/hello','visitorId':'v','sessionId':'s'}
        payload = {'projectId':p['id'],'events':[event]}
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com'}).status_code,401)
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com','x-Zappa-key':'Zappa_wrongwrongwrongwrong'}).status_code,401)
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com','x-Zappa-key':other['write_key']}).status_code,401)
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com','x-Zappa-key':p['write_key']}).json()['accepted'],1)
        with main.engine.connect() as db:
            stored = db.execute(text('SELECT write_key_hash FROM projects WHERE id=:id'), {'id':p['id']}).scalar_one()
        self.assertEqual(stored, main.digest(p['write_key']))
        self.assertNotIn(p['write_key'], stored)
        rotated = self.client.post('/api/projects/'+p['id']+'/write-key', headers=headers).json()['write_key']
        self.assertNotEqual(rotated, p['write_key'])
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com','x-Zappa-key':p['write_key']}).status_code,401)
        self.assertEqual(self.client.post('/api/events', json={'projectId':p['id'],'events':[dict(event, id='event2')]}, headers={'origin':'https://example.com','x-Zappa-key':rotated}).json()['accepted'],1)
        listing = {item['id']:item for item in self.client.get('/api/projects').json()}
        self.assertTrue(listing[p['id']]['has_write_key'])
        self.assertNotIn('write_key', listing[p['id']])

    def test_live_stream_replays_from_cursor_and_enforces_project_ownership(self):
        self.client.cookies.set('__session', 'token')
        project = self.client.post('/api/projects', json={'name':'Live site','domain':'example.com'}, headers={'origin':main.FRONTEND_URL}).json()
        self.verify_project(project['id'])
        event = {'id':'live-stream-event','name':'pageview','timestamp':main.stamp(main.now()),'path':'/live','visitorId':'live-visitor'}
        accepted = self.client.post('/api/events', json={'projectId':project['id'],'events':[event]}, headers={'origin':'https://example.com','x-Zappa-key':project['write_key']})
        self.assertEqual(accepted.json()['accepted'], 1)

        with self.client.stream('GET', f"/api/events/stream?projectId={project['id']}&after=0") as response:
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.headers['content-type'].startswith('text/event-stream'))
            lines = iter(response.iter_lines())
            self.assertEqual(next(lines), 'event: ready')
            self.assertEqual(next(lines), 'id: 0')
            while next(lines) != 'event: analytics-event':
                pass
            self.assertTrue(next(lines).startswith('id: '))
            payload = json.loads(next(lines).removeprefix('data: '))
            self.assertEqual((payload['id'], payload['path'], payload['name']), ('live-stream-event', '/live', 'pageview'))
            self.assertGreater(payload['ingest_seq'], 0)

        self.client.cookies.set('__session', 'token-u2')
        denied = self.client.get(f"/api/events/stream?projectId={project['id']}")
        self.assertEqual(denied.status_code, 404)

    def test_domain_verification_pending_failed_and_passed(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('__session', 'token')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        self.assertFalse(p['verified'])
        self.assertTrue(p['verification_token'])
        verification = self.client.get('/api/projects/'+p['id']+'/verification').json()
        self.assertFalse(verification['verified'])
        self.assertEqual(verification['record'], 'Zappa-site-verification='+p['verification_token'])
        self.assertEqual(verification['dns_name'], '_Zappa-verification.example.com')
        event = {'id':'event1','name':'pageview','timestamp':main.stamp(main.now()),'path':'/hello','visitorId':'v','sessionId':'s'}
        payload = {'projectId':p['id'],'events':[event]}
        event_headers = {'origin':'https://example.com','x-Zappa-key':p['write_key']}
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
        self.client.cookies.set('__session', 'token-u2')
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
        self.assertTrue(check({'_Zappa-verification.example.com': [{'type':16, 'data':'"'+expected+'"'}]}))
        self.assertTrue(check({'example.com': [{'type':16, 'data':'"'+expected+'"'}]}))
        self.assertTrue(check({'_crease-verification.example.com': [{'type':16, 'data':'"crease-site-verification='+token+'"'}]}))
        self.assertTrue(check({'example.com': [{'type':16, 'data':'"crease-site-verification='+token+'"'}]}))
        self.assertFalse(check({'example.com': [{'type':16, 'data':'"prefix'+expected+'suffix"'}]}))
        self.assertFalse(check({'example.com': [{'type':1, 'data':'"'+expected+'"'}]}))
        self.assertFalse(check({}))

    def test_verification_checks_are_rate_limited(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('__session', 'token')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        with patch.object(main, 'VERIFY_LIMIT_PER_MINUTE', 1), patch.object(main, 'dns_has_token', new=AsyncMock(return_value=False)):
            self.assertEqual(self.client.post('/api/projects/'+p['id']+'/verification/check', headers=headers).status_code, 200)
            self.assertEqual(self.client.post('/api/projects/'+p['id']+'/verification/check', headers=headers).status_code, 429)

    def test_mutation_requires_origin_and_auth(self):
        self.assertEqual(self.client.get('/api/projects').status_code,401)
        self.client.cookies.set('__session','token')
        self.assertEqual(self.client.post('/api/projects',json={'name':'x','domain':'x.com'}).status_code,403)

    def test_github_install_checks_ownership_and_public_url(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('__session', 'token')
        project = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        payload = {'repository':'owner/site','path':'index.html','installation_id':1,'write_key':'Zappa_0123456789abcdef'}
        with patch.object(main, 'GITHUB_APP_SLUG', ''):
            self.assertEqual(self.client.post('/api/projects/'+project['id']+'/github-install', json=payload, headers=headers).status_code,503)
        self.client.cookies.set('__session', 'token-u2')
        self.assertEqual(self.client.post('/api/projects/'+project['id']+'/github-install', json=payload, headers=headers).status_code,404)

    def test_github_app_token_is_bound_to_signed_in_user(self):
        key = Fernet.generate_key().decode()
        with patch.object(main, 'GITHUB_APP_SLUG', 'Zappa'), patch.object(main, 'GITHUB_APP_CLIENT_ID', 'id'), patch.object(main, 'GITHUB_APP_CLIENT_SECRET', 'secret'), patch.object(main, 'GITHUB_APP_TOKEN_KEY', key):
            encrypted = main.app_cipher().encrypt(main.json.dumps({'token':'test', 'user_id':'u1'}).encode()).decode()
            self.assertEqual(main.app_user_token(encrypted, {'id':'u1'}), 'test')
            with self.assertRaises(main.HTTPException): main.app_user_token(encrypted, {'id':'u2'})

    def test_saved_github_connection_is_encrypted_and_user_scoped(self):
        key = Fernet.generate_key().decode()
        with patch.object(main, 'GITHUB_APP_SLUG', 'Zappa'), patch.object(main, 'GITHUB_APP_CLIENT_ID', 'id'), patch.object(main, 'GITHUB_APP_CLIENT_SECRET', 'secret'), patch.object(main, 'GITHUB_APP_TOKEN_KEY', key):
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
            result = asyncio.run(github_install.create_install_pr('token','owner/site','index.html','project-id','https://Zappa.example','Zappa_0123456789abcdef'))
        updated = base64.b64decode(writes[0]['content']).decode()
        self.assertEqual(result['url'], 'https://github.com/owner/site/pull/1')
        self.assertIn('data-Zappa-install', updated)
        self.assertIn('Zappa:consent', updated)
        self.assertIn('writeKey', updated)
        self.assertLess(updated.index('data-Zappa-install'), updated.index('</body>'))

    def test_installation_status_identifies_project_on_default_branch(self):
        source = '<script data-Zappa-install>project-123</script>'
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
        self.client.cookies.set('__session','token')
        project = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()['id']
        payload = {'repository':'Owner/Site','installation_id':42}
        responses = [([{'id':42,'app_slug':'Zappa'}], False), ([{'full_name':'Owner/Site'}], False)]
        with patch.object(main, 'GITHUB_APP_SLUG', 'Zappa'), patch.object(main, 'app_user_token', return_value='test'), patch.object(main, 'github_app_pages', new=AsyncMock(side_effect=responses)):
            self.assertEqual(self.client.put('/api/projects/'+project+'/git', json=payload, headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/api/projects/'+project+'/git').json()['repository']['full_name'], 'Owner/Site')
        self.client.cookies.set('__session','token-u2')
        self.assertEqual(self.client.get('/api/projects/'+project+'/git').status_code,404)
        self.assertEqual(self.client.delete('/api/projects/'+project+'/git', headers=headers).status_code,404)
        self.client.cookies.set('__session','token')
        self.assertEqual(self.client.delete('/api/projects/'+project+'/git', headers=headers).status_code,200)
        self.assertIsNone(self.client.get('/api/projects/'+project+'/git').json()['repository'])

    def test_vercel_settings_scoped_and_preserve_other_settings(self):
        headers = {'origin': main.FRONTEND_URL}; self.client.cookies.set('__session', 'token')
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
            self.client.cookies.set('__session','token-u2')
            self.assertEqual(self.client.get('/api/projects/'+project+'/vercel/git').status_code,404)
            self.assertEqual(self.client.patch('/api/projects/'+project+'/vercel/git', json={'git_lfs':True}, headers=headers).status_code,404)

    def test_vercel_authorization_state_is_bound_and_single_use(self):
        self.client.cookies.set('__session', 'token')
        class Response:
            status_code = 200
            def json(self): return {'access_token':'vercel-secret','team_id':'team_123'}
        class Client:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def post(self, *args, **kwargs): return Response()
        key = Fernet.generate_key().decode()
        with patch.object(main, 'VERCEL_INTEGRATION_SLUG', 'Zappa'), patch.object(main, 'VERCEL_INTEGRATION_CLIENT_ID', 'id'), patch.object(main, 'VERCEL_INTEGRATION_CLIENT_SECRET', 'secret'), patch.object(main, 'VERCEL_TOKEN_KEY', key), patch.object(main.httpx, 'AsyncClient', Client):
            start = self.client.get('/api/vercel/connect', follow_redirects=False)
            state = parse_qs(urlsplit(start.headers['location']).query)['state'][0]
            state_cookie = self.client.cookies.get('Zappa_vercel_state')
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
            self.client.cookies.set('Zappa_vercel_state',state_cookie)
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
        headers={'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
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
        headers = {'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
        project = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()['id']
        with main.engine.begin() as db:
            db.execute(text('INSERT INTO project_vercel VALUES (:id,:user,:vercel)'), {'id':project,'user':'u1','vercel':'prj_123'})
        self.assertEqual(self.client.delete('/api/projects/'+project+'/git', headers=headers).status_code,200)
        self.assertEqual(main.linked_vercel_project(project,'u1'),'prj_123')
        self.assertEqual(self.client.delete('/api/projects/'+project, headers=headers).status_code,200)
        with main.engine.connect() as db:
            self.assertEqual(db.execute(text('SELECT COUNT(*) FROM project_vercel WHERE project_id=:id'), {'id':project}).scalar_one(),0)

    def test_vercel_hooks_hide_existing_urls_and_require_project_owner(self):
        headers={'origin':main.FRONTEND_URL}; self.client.cookies.set('__session','token')
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
            self.client.cookies.set('__session','token-u2')
            self.assertEqual(self.client.get('/api/projects/'+project+'/vercel/hooks').status_code,404)
            self.assertEqual(self.client.delete('/api/projects/'+project+'/vercel/hooks/hook_1', headers=headers).status_code,404)

    def test_clerk_auth_rejects_missing_and_invalid_tokens_and_ignores_legacy_cookie(self):
        self.client.cookies.clear()
        self.assertEqual(self.client.get('/api/me').status_code, 401)
        self.client.cookies.set('Zappa_session', 'u1')
        self.assertEqual(self.client.get('/api/me').status_code, 401)
        self.client.cookies.set('__session', 'bad-token')
        self.assertEqual(self.client.get('/api/me').status_code, 401)
        self.client.cookies.set('__session', 'token')
        me = self.client.get('/api/me')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json(), {'id':'u1','clerk_id':'u1','login':'First User'})
        self.assertEqual(self.client.get('/api/auth/github').status_code, 404)
        self.assertEqual(self.client.get('/api/auth/callback').status_code, 404)
        self.assertEqual(self.client.post('/api/logout').status_code, 404)

    def test_clerk_webhook_route_is_public_but_requires_signature_configuration(self):
        self.assertEqual(self.client.post('/api/clerk-webhook', content=b'{}').status_code, 503)
        with patch.object(main, 'CLERK_WEBHOOK_SECRET', 'whsec_test'):
            invalid = self.client.post('/api/clerk-webhook', content=b'{"type":"user.deleted","data":{"id":"u1"}}')
        self.assertEqual(invalid.status_code, 400)

    def test_clerk_jwt_requires_signature_issuer_time_and_authorized_party(self):
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = key.public_key()
        class Key:
            def __init__(self, value): self.key = value
        class Jwks:
            def get_signing_key_from_jwt(self, token): return Key(public_key)
        now = int(wall_time.time())
        claims = {'sub':'user_clerk_12345678901234567890', 'iss':'https://issuer.example', 'iat':now,
                  'nbf':now-1, 'exp':now+60, 'azp':'https://app.example'}
        pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
        def token(values, signing_key=pem): return jwt.encode(values, signing_key, algorithm='RS256')
        with patch.object(main, 'CLERK_ISSUER', 'https://issuer.example'), \
             patch.object(main, 'CLERK_JWKS_URL', 'https://issuer.example/keys'), \
             patch.object(main, 'CLERK_AUTHORIZED_PARTIES', ('https://app.example',)), \
             patch.object(main, 'PyJWKClient', return_value=Jwks()), \
             patch.object(main, '_jwks_client', None), patch.object(main, '_jwks_url_cached', None):
            self.assertEqual(main.verify_clerk_token(token(claims))['sub'], claims['sub'])
            for bad in ({**claims,'exp':now-1}, {**claims,'nbf':now+30}, {**claims,'iss':'https://wrong.example'},
                        {**claims,'azp':'https://attacker.example'}):
                with self.assertRaises(__import__('fastapi').HTTPException): main.verify_clerk_token(token(bad))
            other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            wrong_pem = other.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
            with self.assertRaises(__import__('fastapi').HTTPException): main.verify_clerk_token(token(claims, wrong_pem))

if __name__ == '__main__': unittest.main()
