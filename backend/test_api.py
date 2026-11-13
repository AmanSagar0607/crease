import os
import tempfile
import unittest
from unittest.mock import patch, AsyncMock
import asyncio
import base64
import httpx
from cryptography.fernet import Fernet
from urllib.parse import parse_qs, urlsplit
from datetime import timedelta
from pathlib import Path

tmp = tempfile.TemporaryDirectory()
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(tmp.name) / 'test.db').replace('\\', '/')
from fastapi.testclient import TestClient
from sqlalchemy import text
import main
import github_install

def tearDownModule():
    main.engine.dispose()
    tmp.cleanup()

class ApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        with main.engine.begin() as db:
            for table in ('events', 'project_repositories', 'project_vercel', 'vercel_connections', 'github_connections', 'projects', 'sessions', 'users'): db.execute(text('DELETE FROM '+table))
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
            result = asyncio.run(github_install.create_install_pr('token','owner/site','index.html','project-id','https://crease.example'))
        updated = base64.b64decode(writes[0]['content']).decode()
        self.assertEqual(result['url'], 'https://github.com/owner/site/pull/1')
        self.assertIn('data-crease-install', updated)
        self.assertIn('crease:consent', updated)
        self.assertLess(updated.index('data-crease-install'), updated.index('</body>'))

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
