"""Crease API. Configure GitHub OAuth and a PostgreSQL URL before deployment."""
import asyncio
import hashlib
import ipaddress
import json
import os
import re
import secrets
import socket
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlsplit
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from pathlib import Path
from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
from sqlalchemy.exc import IntegrityError
from github_install import create_install_pr, enable_tracking_pr, installation_status
from cryptography.fernet import Fernet, InvalidToken

load_dotenv(Path(__file__).with_name('.env'))
DATABASE_URL = os.getenv('DATABASE_URL', '')
if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL must be set to the existing PostgreSQL database')
if DATABASE_URL.startswith('sqlite:'):
    raise RuntimeError('SQLite is disabled; configure DATABASE_URL with the existing PostgreSQL database')
if DATABASE_URL.startswith('postgresql://'):
    DATABASE_URL = 'postgresql+psycopg://' + DATABASE_URL[len('postgresql://'):]
if os.getenv('CREASE_WORKER'):
    engine = create_engine(DATABASE_URL, connect_args={'ssl_context': False}, poolclass=NullPool)
else:
    engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}, pool_pre_ping=True)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
PUBLIC_API_URL = os.getenv('PUBLIC_API_URL', 'http://localhost:3000').rstrip('/')
CLIENT_ID = os.getenv('GITHUB_CLIENT_ID', '')
CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET', '')
SECURE = os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
# Enable only behind infrastructure that overwrites this header and prevents direct access.
TRUST_VERCEL_GEO = os.getenv('TRUST_VERCEL_GEO', 'false').lower() == 'true'
GITHUB_APP_SLUG = os.getenv('GITHUB_APP_SLUG', '')
GITHUB_APP_CLIENT_ID = os.getenv('GITHUB_APP_CLIENT_ID', '')
GITHUB_APP_CLIENT_SECRET = os.getenv('GITHUB_APP_CLIENT_SECRET', '')
GITHUB_APP_TOKEN_KEY = os.getenv('GITHUB_APP_TOKEN_KEY', '')
CREASE_PUBLIC_ORIGIN = os.getenv('CREASE_PUBLIC_ORIGIN', '')
VERCEL_INTEGRATION_SLUG = os.getenv('VERCEL_INTEGRATION_SLUG', '')
VERCEL_INTEGRATION_CLIENT_ID = os.getenv('VERCEL_INTEGRATION_CLIENT_ID', '')
VERCEL_INTEGRATION_CLIENT_SECRET = os.getenv('VERCEL_INTEGRATION_CLIENT_SECRET', '')
VERCEL_TOKEN_KEY = os.getenv('VERCEL_TOKEN_KEY', '')
app = FastAPI(title='Crease API')

@app.get('/health')
async def health():
    """Confirm the API can reach its configured database without exposing credentials."""
    try:
        with engine.connect() as db:
            db.execute(text('SELECT 1'))
    except Exception as exc:
        raise HTTPException(503, 'Database connection is unavailable') from exc
    return {'status': 'ok', 'database': 'connected'}

def now(): return datetime.now(timezone.utc)
def digest(value): return hashlib.sha256(value.encode()).hexdigest()
def new_write_key(): return 'crease_' + secrets.token_urlsafe(24)
def new_verification_token(): return secrets.token_urlsafe(24)
def stamp(value): return value.isoformat()

def parse_stamp(value):
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

def resolve_session(db, project_id, visitor_id, event_id, event_time):
    """Return an existing session id or create one after 30 minutes idle or a new UTC day."""
    if not visitor_id:
        return None
    params = {'project': project_id, 'visitor': visitor_id, 'id': event_id, 'ts': stamp(event_time)}
    neighbours = [
        db.execute(text('SELECT occurred_at, session_id FROM events WHERE project_id=:project AND visitor_id=:visitor AND id<>:id AND occurred_at<=:ts ORDER BY occurred_at DESC LIMIT 1'), params).mappings().first(),
        db.execute(text('SELECT occurred_at, session_id FROM events WHERE project_id=:project AND visitor_id=:visitor AND id<>:id AND occurred_at>=:ts ORDER BY occurred_at ASC LIMIT 1'), params).mappings().first(),
    ]
    for row in neighbours:
        if not row or not row['session_id']:
            continue
        try:
            last = parse_stamp(row['occurred_at'])
        except ValueError:
            continue
        gap = abs((event_time - last).total_seconds())
        if gap <= SESSION_IDLE_SECONDS and last.astimezone(timezone.utc).date() == event_time.astimezone(timezone.utc).date():
            return row['session_id']
    return str(uuid4())

def typed_property(value):
    """Return canonical storage columns and a type name for a property value."""
    if isinstance(value, bool):
        return ('true' if value else 'false'), None, value, 'boolean'
    return str(value), float(value), None, 'number'

def store_event_properties(db, project_id, event_id, properties, at):
    """Index each property and update the project's declared-key registry."""
    for name, value in properties.items():
        value_text, value_number, value_boolean, value_type = typed_property(value)
        db.execute(text('''
            INSERT INTO event_properties (project_id,event_id,name,value_text,value_number,value_boolean)
            VALUES (:project,:event,:name,:text,:number,:boolean)
            ON CONFLICT (project_id,event_id,name) DO NOTHING
        '''), {'project':project_id,'event':event_id,'name':name,'text':value_text,'number':value_number,'boolean':value_boolean})
        db.execute(text('''
            INSERT INTO project_property_keys (project_id,name,value_type,first_seen_at,last_seen_at)
            VALUES (:project,:name,:type,:at,:at)
            ON CONFLICT (project_id,name) DO UPDATE SET
              value_type=CASE WHEN project_property_keys.value_type=excluded.value_type THEN project_property_keys.value_type ELSE 'mixed' END,
              first_seen_at=LEAST(project_property_keys.first_seen_at,excluded.first_seen_at),
              last_seen_at=GREATEST(project_property_keys.last_seen_at,excluded.last_seen_at)
        '''), {'project':project_id,'name':name,'type':value_type,'at':at})

def property_filter(property_key, value):
    """Return a SQL fragment and params matching an indexed property, or empty when unfiltered."""
    if not property_key:
        return '', {}
    params = {'prop_name': property_key, 'prop_text': value}
    match = 'ep.value_text = :prop_text'
    try:
        params['prop_number'] = float(value)
    except (TypeError, ValueError):
        pass
    else:
        match = '(ep.value_text = :prop_text OR ep.value_number = :prop_number)'
    return f'ep.name = :prop_name AND {match}', params

RATE_WINDOW_SECONDS = 60
RATE_LIMIT_IP_PER_MINUTE = int(os.getenv('RATE_LIMIT_IP_PER_MINUTE', '120'))
RATE_LIMIT_PROJECT_PER_MINUTE = int(os.getenv('RATE_LIMIT_PROJECT_PER_MINUTE', '600'))
SESSION_IDLE_MINUTES = int(os.getenv('SESSION_IDLE_MINUTES', '30'))
SESSION_IDLE_SECONDS = SESSION_IDLE_MINUTES * 60

class RateLimiter:
    """Durable fixed-window counter shared by every process using the same database."""
    def __init__(self, db_engine, clock=time.time):
        self.engine = db_engine
        self.clock = clock

    def consume(self, bucket, limit, window_seconds=RATE_WINDOW_SECONDS):
        window = int(self.clock()) // window_seconds * window_seconds
        with self.engine.begin() as db:
            hits = db.execute(text('''
                INSERT INTO rate_limits (bucket, window_start, hits) VALUES (:bucket, :window, 1)
                ON CONFLICT (bucket) DO UPDATE SET
                    hits = CASE WHEN rate_limits.window_start = :window THEN rate_limits.hits + 1 ELSE 1 END,
                    window_start = :window
                RETURNING hits
            '''), {'bucket': bucket, 'window': window}).scalar_one()
        return hits <= limit

limiter = RateLimiter(engine)
async def session_user(crease_session: str | None = Cookie(default=None)):
    if not crease_session: raise HTTPException(401, 'Sign in required')
    with engine.connect() as db:
        row = db.execute(text('SELECT users.id, users.login, users.github_id FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=:token AND expires_at>:now'), {'token': digest(crease_session), 'now': stamp(now())}).mappings().first()
    if not row: raise HTTPException(401, 'Session expired')
    return dict(row)

def owned(db, project_id, user_id):
    row = db.execute(text('SELECT * FROM projects WHERE id=:id AND user_id=:user'), {'id': project_id, 'user': user_id}).mappings().first()
    if not row: raise HTTPException(404, 'Project not found')
    return row

@app.get('/api/auth/github')
async def github_auth():
    if not CLIENT_ID or not CLIENT_SECRET: raise HTTPException(503, 'GitHub sign-in is not configured')
    state = secrets.token_urlsafe(32)
    with engine.begin() as db: db.execute(text('INSERT INTO oauth_states VALUES (:state,:expires)'), {'state': digest(state), 'expires': stamp(now()+timedelta(minutes=10))})
    params = urlencode({'client_id': CLIENT_ID, 'redirect_uri': PUBLIC_API_URL + '/api/auth/callback', 'scope': 'read:user', 'state': state})
    response = RedirectResponse('https://github.com/login/oauth/authorize?' + params, status_code=302)
    response.set_cookie('crease_oauth', state, httponly=True, secure=SECURE, samesite='lax', max_age=600, path='/')
    return response

@app.get('/api/auth/callback')
async def github_callback(code: str, state: str, crease_oauth: str | None = Cookie(default=None)):
    if not crease_oauth or not secrets.compare_digest(state, crease_oauth): raise HTTPException(400, 'Invalid OAuth state')
    with engine.begin() as db:
        result = db.execute(text('DELETE FROM oauth_states WHERE state_hash=:state AND expires_at>:now'), {'state': digest(state), 'now': stamp(now())})
        if result.rowcount != 1: raise HTTPException(400, 'Expired OAuth state')
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            token_response = await client.post('https://github.com/login/oauth/access_token', data={'client_id': CLIENT_ID, 'client_secret': CLIENT_SECRET, 'code': code, 'redirect_uri': PUBLIC_API_URL+'/api/auth/callback'}, headers={'Accept': 'application/json'})
            token = token_response.json().get('access_token')
            if not token: raise HTTPException(400, 'GitHub authorization failed. Start sign-in again and check the OAuth app configuration.')
            user_response = await client.get('https://api.github.com/user', headers={'Authorization': 'Bearer '+token, 'Accept': 'application/vnd.github+json'})
            if user_response.status_code != 200: raise HTTPException(400, 'GitHub user lookup failed')
            profile = user_response.json()
    except httpx.RequestError as exc:
        raise HTTPException(503, 'Could not connect to GitHub. Check the API server network connection, then start sign-in again.') from exc
    github_id = str(profile['id']); login = profile['login']; new_id = str(uuid4()); session = secrets.token_urlsafe(32)
    with engine.begin() as db:
        db.execute(text('INSERT INTO users (id,github_id,login) VALUES (:id,:github,:login) ON CONFLICT (github_id) DO UPDATE SET login=:login'), {'id':new_id,'github':github_id,'login':login})
        user_id = db.execute(text('SELECT id FROM users WHERE github_id=:github'), {'github': github_id}).scalar_one()
        db.execute(text('INSERT INTO sessions VALUES (:token,:user,:expires)'), {'token':digest(session), 'user':user_id, 'expires':stamp(now()+timedelta(days=7))})
    response = RedirectResponse(FRONTEND_URL+'/dashboard', status_code=302)
    response.set_cookie('crease_session', session, httponly=True, secure=SECURE, samesite='lax', max_age=604800, path='/')
    response.delete_cookie('crease_oauth', path='/')
    return response

@app.get('/api/me')
async def me(user=Depends(session_user)): return user

@app.post('/api/logout')
async def logout(response: Response, crease_session: str | None = Cookie(default=None), user=Depends(session_user)):
    with engine.begin() as db: db.execute(text('DELETE FROM sessions WHERE token_hash=:token'), {'token':digest(crease_session)})
    response.delete_cookie('crease_session', path='/'); response.delete_cookie('crease_app_token', path='/'); return {'ok':True}

class ProjectInput(BaseModel):
    name: str = Field(min_length=1,max_length=100)
    domain: str = Field(min_length=1,max_length=253)

class RetentionInput(BaseModel):
    retention_days: int = Field(ge=1, le=90)

class GitHubInstallInput(BaseModel):
    repository: str = Field(min_length=3, max_length=200)
    path: str = Field(min_length=1, max_length=250)
    installation_id: int = Field(gt=0)
    write_key: str = Field(min_length=1, max_length=200)

class GitRepositoryInput(BaseModel):
    repository: str = Field(min_length=3, max_length=200, pattern=r'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')
    installation_id: int = Field(gt=0)

def app_cipher():
    if not all((GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_TOKEN_KEY)):
        raise HTTPException(503, 'GitHub App is not configured by the Crease administrator')
    try: return Fernet(GITHUB_APP_TOKEN_KEY.encode())
    except ValueError: raise HTTPException(503, 'GitHub App token key is invalid')

def app_user_token(value, user):
    with engine.connect() as db:
        row = db.execute(text('SELECT encrypted_token FROM github_connections WHERE user_id=:user'), {'user': user['id']}).first()
    if row:
        try: return app_cipher().decrypt(row[0].encode()).decode()
        except (InvalidToken, ValueError, TypeError): raise HTTPException(401, 'Connect GitHub repositories again')
    try:
        data = json.loads(app_cipher().decrypt((value or '').encode(), ttl=3600))
        if data['user_id'] != user['id']: raise ValueError()
        return data['token']
    except (InvalidToken, ValueError, KeyError, TypeError):
        raise HTTPException(401, 'Connect GitHub repositories again')

async def github_app_request(token, path):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get('https://api.github.com'+path, headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
        if response.status_code != 200: raise HTTPException(403, 'GitHub access expired or was revoked; reconnect GitHub')
        return response.json()
    except httpx.RequestError as exc: raise HTTPException(503, 'Could not connect to GitHub') from exc

async def github_app_pages(token, path, key):
    """Follow numbered GitHub pages with a bounded response size."""
    items = []
    for page in range(1, 11):
        result = await github_app_request(token, f'{path}?per_page=100&page={page}')
        batch = result.get(key, [])
        items.extend(batch)
        if len(batch) < 100: return items, False
    return items, True

@app.get('/api/github-app/status')
async def github_app_status(user=Depends(session_user)):
    configured = all((GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_TOKEN_KEY))
    return {'configured': bool(configured), 'install_url': 'https://github.com/apps/'+GITHUB_APP_SLUG+'/installations/new' if configured else None, 'public_origin_configured': bool(CREASE_PUBLIC_ORIGIN)}

@app.get('/api/github-app/connect')
async def github_app_connect(user=Depends(session_user)):
    cipher = app_cipher()
    state = secrets.token_urlsafe(32)
    params = urlencode({'client_id':GITHUB_APP_CLIENT_ID, 'redirect_uri':PUBLIC_API_URL+'/api/github-app/callback', 'state':state})
    response = RedirectResponse('https://github.com/login/oauth/authorize?'+params, status_code=302)
    response.set_cookie('crease_app_state', cipher.encrypt(json.dumps({'state':state,'user_id':user['id']}).encode()).decode(), httponly=True, secure=SECURE, samesite='lax', max_age=600, path='/')
    return response

@app.get('/api/github-app/callback')
async def github_app_callback(code: str, state: str, crease_app_state: str | None = Cookie(default=None), user=Depends(session_user)):
    cipher = app_cipher()
    try:
        data = json.loads(cipher.decrypt((crease_app_state or '').encode(), ttl=600))
        if data['user_id'] != user['id'] or not secrets.compare_digest(data['state'], state): raise ValueError()
    except (InvalidToken, ValueError, KeyError, TypeError): raise HTTPException(400, 'Invalid or expired GitHub connection request')
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            result = await client.post('https://github.com/login/oauth/access_token', data={'client_id':GITHUB_APP_CLIENT_ID,'client_secret':GITHUB_APP_CLIENT_SECRET,'code':code,'redirect_uri':PUBLIC_API_URL+'/api/github-app/callback'}, headers={'Accept':'application/json'})
        token = result.json().get('access_token')
        if not token: raise HTTPException(400, 'GitHub connection failed; try again')
        profile = await github_app_request(token, '/user')
        if str(profile['id']) != user['github_id']: raise HTTPException(403, 'Connect the same GitHub account used to sign in')
    except httpx.RequestError as exc: raise HTTPException(503, 'Could not connect to GitHub') from exc
    with engine.begin() as db:
        db.execute(text('INSERT INTO github_connections (user_id,encrypted_token) VALUES (:user,:token) ON CONFLICT (user_id) DO UPDATE SET encrypted_token=:token'), {'user':user['id'], 'token':cipher.encrypt(token.encode()).decode()})
    installations, _ = await github_app_pages(token, '/user/installations', 'installations')
    installed = any(item.get('app_slug', '').lower() == GITHUB_APP_SLUG.lower() for item in installations)
    destination = FRONTEND_URL+'/dashboard' if installed else 'https://github.com/apps/'+GITHUB_APP_SLUG+'/installations/new'
    response = RedirectResponse(destination, status_code=302)
    response.delete_cookie('crease_app_token', path='/')
    response.delete_cookie('crease_app_state', path='/')
    return response

@app.get('/api/github-app/repositories')
async def github_app_repositories(crease_app_token: str | None = Cookie(default=None), user=Depends(session_user)):
    token = app_user_token(crease_app_token, user)
    installations, truncated = await github_app_pages(token, '/user/installations', 'installations')
    repos = []
    for installation in installations:
        if installation.get('app_slug', '').lower() != GITHUB_APP_SLUG.lower(): continue
        result, repo_truncated = await github_app_pages(token, f"/user/installations/{int(installation['id'])}/repositories", 'repositories')
        truncated = truncated or repo_truncated
        repos.extend({'full_name':r['full_name'],'installation_id':installation['id']} for r in result)
    return {'repositories': repos, 'installation_count': sum(1 for item in installations if item.get('app_slug', '').lower() == GITHUB_APP_SLUG.lower()), 'available_app_slugs': [item.get('app_slug') for item in installations if item.get('app_slug')], 'truncated': truncated}

@app.get('/api/projects/{project_id}/github-install/status')
async def github_install_status(project_id: str, response: Response, crease_app_token: str | None = Cookie(default=None), user=Depends(session_user)):
    response.headers['Cache-Control'] = 'no-store'
    with engine.connect() as db:
        owned(db, project_id, user['id'])
        repo = db.execute(text('SELECT full_name, installation_id FROM project_repositories WHERE project_id=:id'), {'id':project_id}).mappings().first()
        event_count = db.execute(text('SELECT COUNT(*) FROM events WHERE project_id=:id'), {'id':project_id}).scalar_one()
        latest_event = db.execute(text('SELECT MAX(occurred_at) FROM events WHERE project_id=:id'), {'id':project_id}).scalar_one()
    if not repo: raise HTTPException(404, 'Connect a repository first')
    token = app_user_token(crease_app_token, user)
    installations, _ = await github_app_pages(token, '/user/installations', 'installations')
    if not any(int(i['id']) == repo['installation_id'] and i.get('app_slug', '').lower() == GITHUB_APP_SLUG.lower() for i in installations):
        raise HTTPException(403, 'The GitHub App no longer has access to this repository. Check the installation.')
    repositories, _ = await github_app_pages(token, f"/user/installations/{repo['installation_id']}/repositories", 'repositories')
    if not any(r['full_name'].lower() == repo['full_name'].lower() for r in repositories): raise HTTPException(403, 'The GitHub App no longer has access to this repository.')
    result = await installation_status(token, repo['full_name'], project_id)
    result['analytics'] = {'event_count': event_count, 'latest_event': latest_event}
    return result

@app.post('/api/projects/{project_id}/github-install')
async def github_install(project_id: str, data: GitHubInstallInput, crease_app_token: str | None = Cookie(default=None), user=Depends(session_user)):
    with engine.connect() as db: owned(db, project_id, user['id'])
    token = app_user_token(crease_app_token, user)
    result, _ = await github_app_pages(token, f'/user/installations/{data.installation_id}/repositories', 'repositories')
    if not any(repo['full_name'].lower() == data.repository.lower() for repo in result): raise HTTPException(403, 'Repository is not accessible to this account')
    return await create_install_pr(token, data.repository, data.path, project_id, CREASE_PUBLIC_ORIGIN, data.write_key)

@app.post('/api/projects/{project_id}/github-install/enable-tracking')
async def enable_github_tracking(project_id: str, crease_app_token: str | None = Cookie(default=None), user=Depends(session_user)):
    with engine.connect() as db:
        owned(db, project_id, user['id'])
        repo = db.execute(text('SELECT full_name FROM project_repositories WHERE project_id=:id'), {'id':project_id}).mappings().first()
    if not repo: raise HTTPException(404, 'Connect a repository first')
    token = app_user_token(crease_app_token, user)
    return await enable_tracking_pr(token, repo['full_name'], project_id)

@app.get('/api/projects/{project_id}/git')
async def get_project_git(project_id: str, user=Depends(session_user)):
    with engine.connect() as db:
        owned(db, project_id, user['id'])
        row = db.execute(text('SELECT full_name, installation_id FROM project_repositories WHERE project_id=:id'), {'id': project_id}).mappings().first()
        return {'repository': dict(row) if row else None}

@app.put('/api/projects/{project_id}/git')
async def connect_project_git(project_id: str, data: GitRepositoryInput, crease_app_token: str | None = Cookie(default=None), user=Depends(session_user)):
    with engine.connect() as db: owned(db, project_id, user['id'])
    token = app_user_token(crease_app_token, user)
    installations, _ = await github_app_pages(token, '/user/installations', 'installations')
    if not any(int(item['id']) == data.installation_id and item.get('app_slug', '').lower() == GITHUB_APP_SLUG.lower() for item in installations):
        raise HTTPException(403, 'This GitHub App installation is not accessible to this account')
    repositories, _ = await github_app_pages(token, f'/user/installations/{data.installation_id}/repositories', 'repositories')
    selected = next((item for item in repositories if item['full_name'].lower() == data.repository.lower()), None)
    if selected is None: raise HTTPException(403, 'Repository is not accessible to this account')
    with engine.begin() as db:
        owned(db, project_id, user['id'])
        db.execute(text('INSERT INTO project_repositories (project_id,full_name,installation_id) VALUES (:id,:name,:installation) ON CONFLICT (project_id) DO UPDATE SET full_name=:name, installation_id=:installation'), {'id':project_id,'name':selected['full_name'],'installation':data.installation_id})
    return {'repository': {'full_name':selected['full_name'], 'installation_id':data.installation_id}}

@app.delete('/api/projects/{project_id}/git')
async def disconnect_project_git(project_id: str, user=Depends(session_user)):
    with engine.begin() as db:
        owned(db, project_id, user['id'])
        db.execute(text('DELETE FROM project_repositories WHERE project_id=:id'), {'id':project_id})
    return {'repository': None}

@app.get('/api/projects')
async def projects(user=Depends(session_user)):
    since = stamp(now() - timedelta(days=7))
    with engine.connect() as db:
        rows = db.execute(text('''SELECT p.id, p.name, p.domain, p.retention_days,
            (p.write_key_hash IS NOT NULL) AS has_write_key,
            (p.verified_at IS NOT NULL) AS verified,
            (SELECT COUNT(DISTINCT e.visitor_id) FROM events e WHERE e.project_id=p.id AND e.occurred_at>=:since) AS visitors_7d,
            (SELECT COUNT(*) FROM events e WHERE e.project_id=p.id AND e.occurred_at>=:since) AS events_7d,
            (SELECT MAX(e.occurred_at) FROM events e WHERE e.project_id=p.id) AS last_event_at
            FROM projects p WHERE p.user_id=:user ORDER BY p.name'''), {'user':user['id'], 'since':since}).mappings()
        return [dict(r) for r in rows]

@app.post('/api/projects', status_code=201)
async def create_project(data: ProjectInput, user=Depends(session_user)):
    domain = data.domain.strip().lower().rstrip('.')
    if not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', domain): raise HTTPException(422, 'Enter a hostname without a scheme or path')
    if not data.name.strip(): raise HTTPException(422, 'Project name is required')
    result = {'id':str(uuid4()),'name':data.name.strip(),'domain':domain,'retention_days':90}
    write_key = new_write_key()
    verification_token = new_verification_token()
    with engine.begin() as db: db.execute(text('INSERT INTO projects (id,user_id,name,domain,retention_days,write_key_hash,verification_token) VALUES (:id,:user,:name,:domain,90,:key_hash,:verification_token)'), {**result,'user':user['id'],'key_hash':digest(write_key),'verification_token':verification_token})
    return {**result, 'write_key': write_key, 'verification_token': verification_token, 'verified': False}

@app.post('/api/projects/{project_id}/write-key', status_code=201)
async def rotate_write_key(project_id: str, user=Depends(session_user)):
    write_key = new_write_key()
    with engine.begin() as db:
        owned(db, project_id, user['id'])
        db.execute(text('UPDATE projects SET write_key_hash=:key_hash WHERE id=:id'), {'key_hash':digest(write_key),'id':project_id})
    return {'write_key': write_key}

def verification_record(token): return 'crease-site-verification=' + token

def public_host(domain):
    try:
        addresses = socket.getaddrinfo(domain, None)
    except OSError:
        return False
    if not addresses:
        return False
    for address in addresses:
        try:
            ip = ipaddress.ip_address(address[4][0])
        except ValueError:
            return False
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True

async def dns_has_token(domain, token):
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            response = await client.get('https://cloudflare-dns.com/dns-query', params={'name':domain,'type':'TXT'}, headers={'Accept':'application/dns-json'})
        if response.status_code != 200: return False
        answers = response.json().get('Answer', [])
    except (httpx.RequestError, ValueError, AttributeError):
        return False
    expected = verification_record(token)
    for answer in answers:
        data = str(answer.get('data', '')).replace('"', '').strip()
        if data == expected or token in data: return True
    return False

async def meta_has_token(domain, token):
    if not await asyncio.to_thread(public_host, domain): return False
    for scheme in ('https', 'http'):
        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
                response = await client.get(f'{scheme}://{domain}/')
            if response.status_code != 200: continue
            text = response.text[:300_000]
        except (httpx.RequestError, ValueError):
            continue
        for tag in re.findall(r'<meta\b[^>]*>', text, re.I):
            if not re.search(r'name\s*=\s*["\']crease-site-verification["\']', tag, re.I): continue
            if token in tag: return True
    return False

@app.get('/api/projects/{project_id}/verification')
async def get_verification(project_id: str, user=Depends(session_user)):
    with engine.connect() as db:
        row = owned(db, project_id, user['id'])
    return {'token':row['verification_token'],'verified':bool(row['verified_at']),'verified_at':row['verified_at'],'record':verification_record(row['verification_token']),'meta':f'<meta name="crease-site-verification" content="{row["verification_token"]}" />'}

@app.post('/api/projects/{project_id}/verification/check')
async def check_verification(project_id: str, user=Depends(session_user)):
    with engine.connect() as db:
        row = owned(db, project_id, user['id'])
    token, domain = row['verification_token'], row['domain']
    method = 'dns' if await dns_has_token(domain, token) else None
    if not method and await meta_has_token(domain, token): method = 'meta'
    checked_at = stamp(now())
    if method:
        with engine.begin() as db:
            owned(db, project_id, user['id'])
            db.execute(text('UPDATE projects SET verified_at=COALESCE(verified_at,:checked_at) WHERE id=:id'), {'checked_at':checked_at,'id':project_id})
    return {'verified':bool(row['verified_at'] or method),'method':method,'checked_at':checked_at}

@app.delete('/api/projects/{project_id}')
async def delete_project(project_id: str, user=Depends(session_user)):
    with engine.begin() as db:
        owned(db, project_id, user['id'])
        db.execute(text('DELETE FROM project_repositories WHERE project_id=:id'), {'id':project_id})
        db.execute(text('DELETE FROM project_vercel WHERE project_id=:id'), {'id':project_id})
        db.execute(text('DELETE FROM event_properties WHERE project_id=:id'), {'id':project_id})
        db.execute(text('DELETE FROM project_property_keys WHERE project_id=:id'), {'id':project_id})
        db.execute(text('DELETE FROM events WHERE project_id=:id'), {'id':project_id})
        db.execute(text('DELETE FROM analytics_sessions WHERE project_id=:id'), {'id':project_id})
        db.execute(text('DELETE FROM projects WHERE id=:id'), {'id':project_id})
    return {'ok':True}

@app.patch('/api/projects/{project_id}/retention')
async def retention(project_id: str, data: RetentionInput, user=Depends(session_user)):
    with engine.begin() as db:
        owned(db, project_id, user['id'])
        db.execute(text('UPDATE projects SET retention_days=:days WHERE id=:id'), {'days':data.retention_days,'id':project_id})
    return {'retention_days':data.retention_days}

class Event(BaseModel):
    id: str = Field(min_length=1,max_length=64)
    name: str = Field(pattern=r'^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$')
    timestamp: datetime
    path: str = Field(min_length=1,max_length=512)
    visitorId: str | None = Field(default=None,max_length=64)
    sessionId: str | None = Field(default=None,max_length=64)
    properties: dict = Field(default_factory=dict)
    referrer: str | None = Field(default=None,max_length=253)

class Batch(BaseModel):
    projectId: str = Field(max_length=36)
    events: list[Event] = Field(min_length=1,max_length=20)

@app.middleware('http')
async def limits(request: Request, call_next):
    origin = request.headers.get('origin')
    if request.url.path == '/api/events' and request.method == 'OPTIONS':
        return Response(status_code=204, headers={'Access-Control-Allow-Origin': origin or 'null', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Crease-Key', 'Vary': 'Origin'})
    if request.method in ('POST', 'PUT', 'PATCH', 'DELETE') and request.url.path != '/api/events' and origin != FRONTEND_URL:
        return Response(status_code=403)
    if request.url.path == '/api/events':
        length = request.headers.get('content-length')
        if length and (not length.isdigit() or int(length)>32768): return Response(status_code=413)
        body = await request.body()
        if len(body)>32768: return Response(status_code=413)
        try:
            parsed = json.loads(body)
            project_id = parsed.get('projectId') if isinstance(parsed, dict) else None
        except (ValueError, UnicodeDecodeError):
            project_id = None
        client_key = request.client.host if request.client else 'unknown'
        if not limiter.consume('ip:' + client_key, RATE_LIMIT_IP_PER_MINUTE):
            return Response(status_code=429, headers={'Retry-After': str(RATE_WINDOW_SECONDS)})
        if isinstance(project_id, str) and project_id and not limiter.consume('project:' + project_id, RATE_LIMIT_PROJECT_PER_MINUTE):
            return Response(status_code=429, headers={'Retry-After': str(RATE_WINDOW_SECONDS)})
    response = await call_next(request)
    if request.url.path == '/api/events' and origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
    return response

@app.post('/api/events')
async def ingest(data: Batch, request: Request):
    origin = request.headers.get('origin', '')
    with engine.begin() as db:
        project = db.execute(text('SELECT domain, write_key_hash, verified_at FROM projects WHERE id=:id'), {'id':data.projectId}).mappings().first()
        if not project: raise HTTPException(404, 'Project not found')
        supplied = request.headers.get('x-crease-key', '')
        if not supplied and request.headers.get('authorization', '').lower().startswith('bearer '):
            supplied = request.headers['authorization'][7:].strip()
        if not project['write_key_hash'] or not supplied or not secrets.compare_digest(digest(supplied), project['write_key_hash']):
            raise HTTPException(401, 'Invalid project write key')
        if not project['verified_at']:
            raise HTTPException(403, 'Project domain is not verified')
        host = urlsplit(origin).hostname if origin else None
        domain = project['domain']
        alternate = domain[4:] if domain.startswith('www.') else 'www.' + domain
        if host not in (domain, alternate): raise HTTPException(403, 'Origin does not match project')
        inserted = 0
        for e in data.events:
            if not e.path.startswith('/') or '?' in e.path or '#' in e.path: raise HTTPException(422, 'Invalid path')
            if len(e.properties)>20 or any(not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_.-]{0,63}', k) or re.search(r'password|token|secret|email', k, re.I) or not isinstance(v, (int, float, bool)) for k,v in e.properties.items()): raise HTTPException(422, 'Invalid event properties')
            t = e.timestamp if e.timestamp.tzinfo else e.timestamp.replace(tzinfo=timezone.utc)
            event_time = t.astimezone(timezone.utc)
            if abs((now()-event_time).total_seconds()) > 86400 * 7: raise HTTPException(422, 'Event timestamp out of range')
            ua = request.headers.get('user-agent','').lower(); device = 'mobile' if 'mobile' in ua else 'desktop' if ua else 'unknown'
            country = request.headers.get('x-vercel-ip-country', '').upper() if TRUST_VERCEL_GEO else ''
            if not re.fullmatch(r'[A-Z]{2}', country): country = None
            referrer = e.referrer.lower() if e.referrer and re.fullmatch(r'[a-zA-Z0-9.-]+', e.referrer) else None
            session_id = resolve_session(db, data.projectId, e.visitorId, e.id, event_time)
            result=db.execute(text('INSERT INTO events (project_id,id,name,occurred_at,path,visitor_id,session_id,country,device,referrer,properties) VALUES (:project,:id,:name,:ts,:path,:visitor,:session,:country,:device,:referrer,:properties) ON CONFLICT (project_id,id) DO NOTHING'), {'project':data.projectId,'id':e.id,'name':e.name,'ts':stamp(event_time),'path':e.path,'visitor':e.visitorId,'session':session_id,'country':country,'device':device,'referrer':referrer,'properties':json.dumps(e.properties)})
            inserted += result.rowcount
            if result.rowcount and e.properties:
                store_event_properties(db, data.projectId, e.id, e.properties, stamp(event_time))
            if result.rowcount and session_id:
                db.execute(text('''
                    INSERT INTO analytics_sessions (project_id,session_id,visitor_id,started_at,last_activity_at,entry_page,exit_page,pageview_count)
                    VALUES (:project,:session,:visitor,:at,:at,:path,:path,:pageview)
                    ON CONFLICT (project_id,session_id) DO UPDATE SET
                      visitor_id=COALESCE(analytics_sessions.visitor_id,excluded.visitor_id),
                      entry_page=CASE WHEN excluded.started_at < analytics_sessions.started_at THEN excluded.entry_page ELSE analytics_sessions.entry_page END,
                      started_at=CASE WHEN excluded.started_at < analytics_sessions.started_at THEN excluded.started_at ELSE analytics_sessions.started_at END,
                      exit_page=CASE WHEN excluded.last_activity_at >= analytics_sessions.last_activity_at THEN excluded.exit_page ELSE analytics_sessions.exit_page END,
                      last_activity_at=CASE WHEN excluded.last_activity_at > analytics_sessions.last_activity_at THEN excluded.last_activity_at ELSE analytics_sessions.last_activity_at END,
                      pageview_count=analytics_sessions.pageview_count+excluded.pageview_count
                '''), {'project':data.projectId,'session':session_id,'visitor':e.visitorId,'at':stamp(event_time),'path':e.path,'pageview':1 if e.name == 'pageview' else 0})
    return {'accepted': inserted}

@app.get('/api/projects/{project_id}/summary')
async def summary(project_id: str, days: int = 30, property: str | None = Query(default=None, max_length=64), value: str | None = Query(default=None, max_length=256), user=Depends(session_user)):
    if days not in (7,30,90): raise HTTPException(422, 'Unsupported date range')
    if (property is None) != (value is None): raise HTTPException(422, 'property and value must be provided together')
    end = now()
    start = end - timedelta(days=days-1)
    previous_start = start - timedelta(days=days)
    params={'id':project_id,'since':stamp(start)}
    previous_params={'id':project_id,'since':stamp(previous_start),'until':stamp(start)}
    with engine.connect() as db:
        owned(db, project_id, user['id'])
        source = 'events'
        if property is not None:
            known = db.execute(text('SELECT 1 FROM project_property_keys WHERE project_id=:id AND name=:name'), {'id':project_id,'name':property}).first()
            if not known: raise HTTPException(422, 'Unknown property key')
            clause, extra = property_filter(property, value)
            params.update(extra)
            previous_params.update(extra)
            source = f'(SELECT e.* FROM events e JOIN event_properties ep ON ep.project_id=e.project_id AND ep.event_id=e.id WHERE {clause}) AS events'
        def metric_window(query_params, until=False):
            clause = ' AND occurred_at<:until' if until else ''
            row = db.execute(text(f"SELECT COUNT(*) AS events, SUM(CASE WHEN name='pageview' THEN 1 ELSE 0 END) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors FROM {source} WHERE project_id=:id AND occurred_at>=:since{clause}"), query_params).mappings().one()
            row = dict(row)
            if property is not None:
                row['sessions'] = db.execute(text(f'SELECT COUNT(DISTINCT session_id) FROM {source} WHERE project_id=:id AND occurred_at>=:since{clause}'), query_params).scalar_one()
            else:
                session_clause = ' AND started_at<:until' if until else ''
                row['sessions'] = db.execute(text(f'SELECT COUNT(*) FROM analytics_sessions WHERE project_id=:id AND started_at>=:since{session_clause}'), query_params).scalar_one()
            return {k:(v or 0) for k,v in row.items()}
        metrics=metric_window(params)
        previous=metric_window(previous_params, until=True)
        if property is not None:
            session_rows=db.execute(text(f'SELECT MIN(occurred_at) AS started_at, MAX(occurred_at) AS last_activity_at FROM {source} WHERE project_id=:id AND occurred_at>=:since AND session_id IS NOT NULL GROUP BY session_id'), params).mappings().all()
        else:
            session_rows=db.execute(text('SELECT started_at,last_activity_at FROM analytics_sessions WHERE project_id=:id AND started_at>=:since'), params).mappings().all()
        durations=[]
        for row in session_rows:
            try:
                elapsed=(datetime.fromisoformat(row['last_activity_at'])-datetime.fromisoformat(row['started_at'])).total_seconds()
                if elapsed >= 0: durations.append(elapsed)
            except (TypeError, ValueError):
                continue
        last_event_at=db.execute(text('SELECT MAX(occurred_at) FROM events WHERE project_id=:id'), {'id':project_id}).scalar()
        daily=db.execute(text(f"SELECT substr(occurred_at,1,10) AS day, COUNT(*) AS events, SUM(CASE WHEN name='pageview' THEN 1 ELSE 0 END) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors, COUNT(DISTINCT session_id) AS sessions FROM {source} WHERE project_id=:id AND occurred_at>=:since GROUP BY substr(occurred_at,1,10) ORDER BY day"), params).mappings()
        daily_rows={row['day']:row for row in daily}
        series=[]
        day=start.date()
        while day<=end.date():
            row=daily_rows.get(day.isoformat())
            series.append({'date':day.isoformat(),'events':int((row or {}).get('events') or 0),'pageviews':int((row or {}).get('pageviews') or 0),'visitors':int((row or {}).get('visitors') or 0),'sessions':int((row or {}).get('sessions') or 0)})
            day += timedelta(days=1)
        def breakdown(column):
            return [dict(r) for r in db.execute(text(f'SELECT COALESCE({column}, :unknown) AS label, COUNT(*) AS count FROM {source} WHERE project_id=:id AND occurred_at>=:since AND name=:name GROUP BY {column} ORDER BY count DESC LIMIT 10'), {**params,'unknown':'Unknown','name':'pageview'}).mappings()]
        return {'metrics':metrics,'previous':previous,'series':series,'last_event_at':last_event_at,'pages':breakdown('path'),'devices':breakdown('device'),'countries':breakdown('country'),'referrers':breakdown('referrer'),'days':days,'filter':{'property':property,'value':value},'average_session_duration_seconds':round(sum(durations)/len(durations)) if durations else 0}

@app.get('/api/projects/{project_id}/properties')
async def properties(project_id: str, user=Depends(session_user)):
    with engine.connect() as db:
        owned(db, project_id, user['id'])
        rows = db.execute(text('''
            SELECT k.name, k.value_type, k.first_seen_at, k.last_seen_at,
                   COUNT(ep.event_id) AS event_count,
                   COUNT(DISTINCT ep.value_text) AS distinct_values
            FROM project_property_keys k
            LEFT JOIN event_properties ep ON ep.project_id=k.project_id AND ep.name=k.name
            WHERE k.project_id=:id
            GROUP BY k.name, k.value_type, k.first_seen_at, k.last_seen_at
            ORDER BY k.name
        '''), {'id':project_id}).mappings().all()
        value_rows = db.execute(text('''
            SELECT name, value_text, COUNT(*) AS count
            FROM event_properties WHERE project_id=:id
            GROUP BY name, value_text ORDER BY name, count DESC
        '''), {'id':project_id}).mappings().all()
    values = {}
    for row in value_rows:
        values.setdefault(row['name'], []).append({'value':row['value_text'],'count':int(row['count'])})
    return [{**dict(row), 'event_count':int(row['event_count']), 'distinct_values':int(row['distinct_values']), 'values':values.get(row['name'], [])[:20]} for row in rows]

@app.get('/api/projects/{project_id}/events')
async def project_events(project_id: str, days: int = 30, event: str | None = Query(default=None, max_length=64), path: str | None = Query(default=None, max_length=512), property: str | None = Query(default=None, max_length=64), value: str | None = Query(default=None, max_length=256), limit: int = 100, user=Depends(session_user)):
    if days not in (7,30,90): raise HTTPException(422, 'Unsupported date range')
    if not 1 <= limit <= 200: raise HTTPException(422, 'Limit must be between 1 and 200')
    if (property is None) != (value is None): raise HTTPException(422, 'property and value must be provided together')
    params = {'id':project_id, 'since':stamp(now()-timedelta(days=days-1)), 'limit':limit}
    with engine.connect() as db:
        owned(db, project_id, user['id'])
        source = 'events e'
        where = ['e.project_id=:id', 'e.occurred_at>=:since']
        if property is not None:
            known = db.execute(text('SELECT 1 FROM project_property_keys WHERE project_id=:id AND name=:name'), {'id':project_id,'name':property}).first()
            if not known: raise HTTPException(422, 'Unknown property key')
            clause, extra = property_filter(property, value)
            params.update(extra)
            source = 'events e JOIN event_properties ep ON ep.project_id=e.project_id AND ep.event_id=e.id'
            where.append(clause)
        if event is not None:
            where.append('e.name=:event'); params['event'] = event
        if path is not None:
            where.append('e.path=:path'); params['path'] = path
        rows = db.execute(text(f"SELECT e.id, e.name, e.occurred_at, e.path, e.visitor_id, e.session_id, e.country, e.device, e.referrer, e.properties FROM {source} WHERE " + ' AND '.join(where) + ' ORDER BY e.occurred_at DESC LIMIT :limit'), params).mappings().all()
    return [{'id':row['id'],'name':row['name'],'occurred_at':row['occurred_at'],'path':row['path'],'visitor_id':row['visitor_id'],'session_id':row['session_id'],'country':row['country'],'device':row['device'],'referrer':row['referrer'],'properties':json.loads(row['properties'])} for row in rows]

# Vercel access is per Crease account, encrypted at rest, and never sent to the browser.
def vercel_cipher():
    if not all((VERCEL_INTEGRATION_SLUG, VERCEL_INTEGRATION_CLIENT_ID, VERCEL_INTEGRATION_CLIENT_SECRET, VERCEL_TOKEN_KEY)):
        raise HTTPException(503, 'Vercel integration is not configured')
    try: return Fernet(VERCEL_TOKEN_KEY.encode())
    except ValueError: raise HTTPException(503, 'Vercel encryption key is invalid')

def vercel_connection(user_id):
    with engine.connect() as db:
        row = db.execute(text('SELECT encrypted_token, team_id FROM vercel_connections WHERE user_id=:user'), {'user':user_id}).mappings().first()
    if not row: raise HTTPException(401, 'Connect Vercel first')
    try: return vercel_cipher().decrypt(row['encrypted_token'].encode()).decode(), row['team_id']
    except (InvalidToken, UnicodeError): raise HTTPException(503, 'Vercel connection cannot be decrypted; reconnect Vercel')

async def vercel_request(token, team_id, method, path, body=None, query=None):
    try:
        async with httpx.AsyncClient(base_url='https://api.vercel.com', timeout=15) as client:
            params = dict(query or {})
            if team_id: params['teamId'] = team_id
            response = await client.request(method, path, headers={'Authorization':'Bearer '+token}, params=params, json=body)
        if response.status_code in (401,403): raise HTTPException(403, 'Vercel access was denied; reconnect or review the integration permissions')
        if response.status_code == 404: raise HTTPException(404, 'Vercel project not found or not accessible')
        if response.status_code >= 400: raise HTTPException(502, 'Vercel could not process this request')
        if response.status_code == 204: return {}
        return response.json()
    except httpx.RequestError as exc: raise HTTPException(503, 'Could not connect to Vercel') from exc

@app.get('/api/vercel/status')
async def vercel_status(user=Depends(session_user)):
    configured = all((VERCEL_INTEGRATION_SLUG, VERCEL_INTEGRATION_CLIENT_ID, VERCEL_INTEGRATION_CLIENT_SECRET, VERCEL_TOKEN_KEY))
    with engine.connect() as db:
        connected = db.execute(text('SELECT 1 FROM vercel_connections WHERE user_id=:id'), {'id':user['id']}).first() is not None
    return {'configured':bool(configured), 'connected':connected}

@app.get('/api/vercel/connect')
async def vercel_connect(user=Depends(session_user)):
    cipher = vercel_cipher(); state = secrets.token_urlsafe(32)
    with engine.begin() as db: db.execute(text('INSERT INTO oauth_states VALUES (:state,:expires)'), {'state':digest(state),'expires':stamp(now()+timedelta(minutes=10))})
    response = RedirectResponse('https://vercel.com/integrations/'+VERCEL_INTEGRATION_SLUG+'/new?'+urlencode({'state':state}), status_code=302)
    response.set_cookie('crease_vercel_state', cipher.encrypt(json.dumps({'state':state,'user_id':user['id']}).encode()).decode(), httponly=True, secure=SECURE, samesite='lax', max_age=600, path='/')
    return response

@app.get('/api/vercel/callback')
async def vercel_callback(code: str, state: str, next: str | None = None, crease_vercel_state: str | None = Cookie(default=None), user=Depends(session_user)):
    cipher = vercel_cipher()
    target = FRONTEND_URL+'/dashboard'
    if next:
        parsed = urlsplit(next)
        if parsed.scheme != 'https' or parsed.hostname != 'vercel.com' or parsed.username or parsed.password:
            raise HTTPException(400, 'Invalid Vercel completion URL')
        target = next + ('&' if parsed.query else '?') + urlencode({'state':state})
    try:
        data = json.loads(cipher.decrypt((crease_vercel_state or '').encode(), ttl=600))
        if data['user_id'] != user['id'] or not secrets.compare_digest(data['state'], state): raise ValueError()
    except (InvalidToken, ValueError, KeyError, TypeError): raise HTTPException(400, 'Invalid or expired Vercel connection request')
    with engine.begin() as db:
        result = db.execute(text('DELETE FROM oauth_states WHERE state_hash=:state AND expires_at>:now'), {'state':digest(state), 'now':stamp(now())})
        if result.rowcount != 1: raise HTTPException(400, 'Vercel connection request has expired')
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post('https://api.vercel.com/v2/oauth/access_token', data={'client_id':VERCEL_INTEGRATION_CLIENT_ID,'client_secret':VERCEL_INTEGRATION_CLIENT_SECRET,'code':code,'redirect_uri':PUBLIC_API_URL+'/api/vercel/callback'})
        if response.status_code != 200: raise HTTPException(400, 'Vercel authorization failed; try connecting again')
        token_data = response.json(); token = token_data.get('access_token'); team = token_data.get('team_id')
        if not isinstance(token, str) or not token: raise HTTPException(400, 'Vercel did not return an access token')
    except (httpx.RequestError, ValueError) as exc: raise HTTPException(503, 'Could not connect to Vercel') from exc
    with engine.begin() as db:
        db.execute(text('DELETE FROM project_vercel WHERE user_id=:user'), {'user':user['id']})
        db.execute(text('INSERT INTO vercel_connections (user_id,encrypted_token,team_id) VALUES (:user,:token,:team) ON CONFLICT (user_id) DO UPDATE SET encrypted_token=:token,team_id=:team'), {'user':user['id'],'token':cipher.encrypt(token.encode()).decode(),'team':team})
    response = RedirectResponse(target, status_code=302)
    response.delete_cookie('crease_vercel_state', path='/')
    return response

@app.post('/api/vercel/disconnect')
async def vercel_disconnect(user=Depends(session_user)):
    with engine.begin() as db:
        db.execute(text('DELETE FROM project_vercel WHERE user_id=:user'), {'user':user['id']})
        db.execute(text('DELETE FROM vercel_connections WHERE user_id=:user'), {'user':user['id']})
    return {'ok':True}

@app.get('/api/vercel/projects')
async def vercel_projects(user=Depends(session_user)):
    token, team = vercel_connection(user['id'])
    result = await vercel_request(token, team, 'GET', '/v9/projects', query={'limit':100})
    return {'projects':[{'id':p['id'],'name':p['name']} for p in result.get('projects', [])], 'has_more':bool(result.get('pagination', {}).get('next'))}

class VercelProjectInput(BaseModel):
    vercel_project_id: str = Field(pattern=r'^prj_[A-Za-z0-9]+$', max_length=128)

@app.post('/api/projects/{project_id}/vercel')
async def link_vercel_project(project_id: str, data: VercelProjectInput, user=Depends(session_user)):
    with engine.connect() as db: owned(db, project_id, user['id'])
    token, team = vercel_connection(user['id'])
    await vercel_request(token, team, 'GET', '/v9/projects/'+data.vercel_project_id)
    with engine.begin() as db:
        owned(db, project_id, user['id'])
        db.execute(text('INSERT INTO project_vercel VALUES (:project,:user,:vercel) ON CONFLICT (project_id) DO UPDATE SET user_id=:user,vercel_project_id=:vercel'), {'project':project_id,'user':user['id'],'vercel':data.vercel_project_id})
    return {'vercel_project_id':data.vercel_project_id}

def linked_vercel_project(project_id, user_id):
    with engine.connect() as db:
        owned(db, project_id, user_id)
        row = db.execute(text('SELECT vercel_project_id FROM project_vercel WHERE project_id=:project AND user_id=:user'), {'project':project_id,'user':user_id}).first()
    if not row: raise HTTPException(404, 'No Vercel project linked')
    return row[0]

def git_settings(project):
    comments = project.get('gitComments') or {}; options = project.get('gitProviderOptions') or {}
    consolidated = options.get('consolidatedGitCommitStatus') or {}
    deployments = options.get('createDeployments')
    return {'on_commit':comments.get('onCommit'), 'on_pull_request':comments.get('onPullRequest'), 'git_lfs':project.get('gitLFS'), 'require_verified_commits':options.get('requireVerifiedCommits'), 'repository_dispatch_events':None if 'disableRepositoryDispatchEvents' not in options else not options['disableRepositoryDispatchEvents'], 'deployment_status_events':(deployments == 'enabled') if deployments in ('enabled', 'disabled') else None, 'git_commit_status':options.get('gitCommitStatus', True), 'consolidated_commit_status':consolidated.get('enabled'), 'soft_failures':None if 'propagateFailures' not in consolidated else not consolidated['propagateFailures']}

@app.get('/api/projects/{project_id}/vercel/git')
async def get_vercel_git(project_id: str, user=Depends(session_user)):
    provider_id = linked_vercel_project(project_id, user['id']); token, team = vercel_connection(user['id'])
    project = await vercel_request(token, team, 'GET', '/v9/projects/'+provider_id)
    return {'project':{'id':project['id'],'name':project['name']}, 'settings':git_settings(project)}

class VercelGitInput(BaseModel):
    on_commit: bool | None = None
    on_pull_request: bool | None = None
    git_lfs: bool | None = None
    require_verified_commits: bool | None = None
    repository_dispatch_events: bool | None = None
    deployment_status_events: bool | None = None
    git_commit_status: bool | None = None
    consolidated_commit_status: bool | None = None
    soft_failures: bool | None = None

@app.patch('/api/projects/{project_id}/vercel/git')
async def update_vercel_git(project_id: str, data: VercelGitInput, user=Depends(session_user)):
    provider_id = linked_vercel_project(project_id, user['id']); token, team = vercel_connection(user['id'])
    old = await vercel_request(token, team, 'GET', '/v9/projects/'+provider_id)
    changes = data.model_dump(exclude_none=True)
    if not changes: raise HTTPException(422, 'Select a setting to update')
    inherited_settings = {'require_verified_commits', 'repository_dispatch_events'}
    if any(git_settings(old).get(key) is None and key not in inherited_settings for key in changes): raise HTTPException(422, 'That setting is not available for this Vercel project')
    body = {}
    if 'on_commit' in changes or 'on_pull_request' in changes:
        body['gitComments'] = {key:value for key,value in (old.get('gitComments') or {}).items() if key in ('onCommit','onPullRequest')}
        if 'on_commit' in changes: body['gitComments']['onCommit'] = changes['on_commit']
        if 'on_pull_request' in changes: body['gitComments']['onPullRequest'] = changes['on_pull_request']
    if 'git_lfs' in changes: body['gitLFS'] = changes['git_lfs']
    if any(key in changes for key in ('require_verified_commits', 'repository_dispatch_events', 'deployment_status_events', 'git_commit_status', 'consolidated_commit_status', 'soft_failures')):
        body['gitProviderOptions'] = {key:value for key,value in (old.get('gitProviderOptions') or {}).items() if key in ('requireVerifiedCommits','disableRepositoryDispatchEvents','createDeployments','gitCommitStatus','consolidatedGitCommitStatus')}
        if 'require_verified_commits' in changes: body['gitProviderOptions']['requireVerifiedCommits'] = changes['require_verified_commits']
        if 'repository_dispatch_events' in changes: body['gitProviderOptions']['disableRepositoryDispatchEvents'] = not changes['repository_dispatch_events']
        if 'deployment_status_events' in changes: body['gitProviderOptions']['createDeployments'] = 'enabled' if changes['deployment_status_events'] else 'disabled'
        if 'git_commit_status' in changes: body['gitProviderOptions']['gitCommitStatus'] = changes['git_commit_status']
        if 'consolidated_commit_status' in changes or 'soft_failures' in changes:
            consolidated = dict(body['gitProviderOptions'].get('consolidatedGitCommitStatus') or {})
            if 'consolidated_commit_status' in changes: consolidated['enabled'] = changes['consolidated_commit_status']
            if 'soft_failures' in changes: consolidated['propagateFailures'] = not changes['soft_failures']
            body['gitProviderOptions']['consolidatedGitCommitStatus'] = consolidated
    updated = await vercel_request(token, team, 'PATCH', '/v9/projects/'+provider_id, body)
    return {'project':{'id':updated['id'],'name':updated['name']}, 'settings':git_settings(updated)}

class DeployHookInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    ref: str = Field(min_length=1, max_length=200)

@app.get('/api/projects/{project_id}/vercel/hooks')
async def get_vercel_hooks(project_id: str, response: Response, user=Depends(session_user)):
    provider_id = linked_vercel_project(project_id, user['id']); token, team = vercel_connection(user['id'])
    project = await vercel_request(token, team, 'GET', '/v9/projects/'+provider_id)
    hooks = (project.get('link') or {}).get('deployHooks') or []
    response.headers['Cache-Control'] = 'no-store'
    return {'hooks':[{'id':hook['id'],'name':hook['name'],'ref':hook['ref']} for hook in hooks]}

@app.post('/api/projects/{project_id}/vercel/hooks')
async def create_vercel_hook(project_id: str, data: DeployHookInput, response: Response, user=Depends(session_user)):
    name, ref = data.name.strip(), data.ref.strip()
    if not name or not ref or any(ord(c) < 32 for c in name+ref): raise HTTPException(422, 'Enter a valid name and branch')
    provider_id = linked_vercel_project(project_id, user['id']); token, team = vercel_connection(user['id'])
    project = await vercel_request(token, team, 'POST', '/v2/projects/'+provider_id+'/deploy-hooks', {'name':name,'ref':ref})
    hooks = (project.get('link') or {}).get('deployHooks') or []
    hook = next((item for item in reversed(hooks) if item.get('name') == name and item.get('ref') == ref), None)
    if not hook: raise HTTPException(502, 'Vercel created the hook but did not return its details; refresh before retrying')
    url = urlsplit(hook.get('url', ''))
    if url.scheme != 'https' or url.hostname != 'api.vercel.com': raise HTTPException(502, 'Vercel returned an invalid hook URL; check Vercel before retrying')
    response.headers['Cache-Control'] = 'no-store'
    return {'hook':{'id':hook['id'],'name':hook['name'],'ref':hook['ref'],'url':hook['url']}}

@app.delete('/api/projects/{project_id}/vercel/hooks/{hook_id}')
async def delete_vercel_hook(project_id: str, hook_id: str, user=Depends(session_user)):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', hook_id): raise HTTPException(422, 'Invalid hook ID')
    provider_id = linked_vercel_project(project_id, user['id']); token, team = vercel_connection(user['id'])
    await vercel_request(token, team, 'DELETE', '/v2/projects/'+provider_id+'/deploy-hooks/'+hook_id)
    return {'ok':True}
