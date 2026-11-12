import os
import tempfile
import unittest
from unittest.mock import patch, AsyncMock
import asyncio
from cryptography.fernet import Fernet
from urllib.parse import parse_qs, urlsplit
from datetime import timedelta
from pathlib import Path

tmp = tempfile.TemporaryDirectory()
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(tmp.name) / 'test.db').replace('\\', '/')
from fastapi.testclient import TestClient
from sqlalchemy import text
import main

def tearDownModule():
    main.engine.dispose()
    tmp.cleanup()

class ApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        with main.engine.begin() as db:
            for table in ('events', 'projects', 'sessions', 'users'): db.execute(text('DELETE FROM '+table))
            db.execute(text("INSERT INTO users VALUES ('u1','g1','first'),('u2','g2','second')"))
            for user in ('u1','u2'):
                db.execute(text('INSERT INTO sessions VALUES (:token,:user,:expiry)'), {'token':main.digest(user),'user':user,'expiry':main.stamp(main.now()+timedelta(days=1))})

    def test_project_isolation_dedup_and_deletion(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('crease_session', 'u1')
        p = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        event = {'id':'event1','name':'pageview','timestamp':main.stamp(main.now()),'path':'/hello','visitorId':'v','sessionId':'s'}
        payload = {'projectId':p['id'],'events':[event]}
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://evil.example'}).status_code,403)
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com'}).json()['accepted'],1)
        self.assertEqual(self.client.post('/api/events', json=payload, headers={'origin':'https://example.com'}).json()['accepted'],0)
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/summary').json()['metrics']['pageviews'],1)
        self.client.cookies.set('crease_session', 'u2')
        self.assertEqual(self.client.get('/api/projects/'+p['id']+'/summary').status_code,404)
        self.assertEqual(self.client.delete('/api/projects/'+p['id'], headers=headers).status_code,404)
        self.client.cookies.set('crease_session', 'u1')
        self.assertEqual(self.client.delete('/api/projects/'+p['id'], headers=headers).status_code,200)
        with main.engine.connect() as db: self.assertEqual(db.execute(text('SELECT COUNT(*) FROM events')).scalar_one(),0)

    def test_mutation_requires_origin_and_auth(self):
        self.assertEqual(self.client.get('/api/projects').status_code,401)
        self.client.cookies.set('crease_session','u1')
        self.assertEqual(self.client.post('/api/projects',json={'name':'x','domain':'x.com'}).status_code,403)

    def test_github_install_checks_ownership_and_public_url(self):
        headers = {'origin':main.FRONTEND_URL}
        self.client.cookies.set('crease_session', 'u1')
        project = self.client.post('/api/projects', json={'name':'Site','domain':'example.com'}, headers=headers).json()
        payload = {'repository':'owner/site','path':'index.html','installation_id':1}
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

    def test_repository_pagination_includes_later_pages(self):
        responses = [{'repositories':[{'full_name':str(i)} for i in range(100)]}, {'repositories':[{'full_name':'owner/last'}]}]
        with patch.object(main, 'github_app_request', new=AsyncMock(side_effect=responses)) as request:
            repos, truncated = asyncio.run(main.github_app_pages('token', '/repos', 'repositories'))
        self.assertEqual(len(repos), 101)
        self.assertEqual(repos[-1]['full_name'], 'owner/last')
        self.assertFalse(truncated)
        self.assertEqual(request.await_count, 2)

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
        with patch.object(main, 'CLIENT_ID', 'test-id'), patch.object(main, 'CLIENT_SECRET', 'test-secret'), patch.object(main.httpx, 'AsyncClient', GitHubClient):
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
