"""Crease API. Configure GitHub OAuth and a PostgreSQL URL before deployment."""
import hashlib
import json
import os
import re
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlsplit
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from pathlib import Path
from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from github_install import create_install_pr
from cryptography.fernet import Fernet, InvalidToken

load_dotenv(Path(__file__).with_name('.env'))
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./crease.db')
if os.getenv('VERCEL') and DATABASE_URL.startswith('sqlite:'):
    raise RuntimeError('DATABASE_URL must be set to a persistent PostgreSQL database on Vercel')
if DATABASE_URL.startswith('postgresql://'):
    DATABASE_URL = 'postgresql+psycopg://' + DATABASE_URL[len('postgresql://'):]
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
app = FastAPI(title='Crease API')

def setup():
    with engine.begin() as db:
        for sql in [
            'CREATE TABLE IF NOT EXISTS users (id VARCHAR(64) PRIMARY KEY, github_id VARCHAR(64) UNIQUE NOT NULL, login VARCHAR(255) NOT NULL)',
            'CREATE TABLE IF NOT EXISTS sessions (token_hash VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, expires_at VARCHAR(32) NOT NULL)',
            'CREATE TABLE IF NOT EXISTS oauth_states (state_hash VARCHAR(64) PRIMARY KEY, expires_at VARCHAR(32) NOT NULL)',
            'CREATE TABLE IF NOT EXISTS projects (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, name VARCHAR(100) NOT NULL, domain VARCHAR(253) NOT NULL, retention_days INTEGER NOT NULL DEFAULT 90)',
            'CREATE TABLE IF NOT EXISTS events (project_id VARCHAR(36) NOT NULL, id VARCHAR(64) NOT NULL, name VARCHAR(64) NOT NULL, occurred_at VARCHAR(40) NOT NULL, path VARCHAR(512) NOT NULL, visitor_id VARCHAR(64), session_id VARCHAR(64), country VARCHAR(2), device VARCHAR(16), referrer VARCHAR(253), properties TEXT NOT NULL, PRIMARY KEY(project_id,id))',
            'CREATE INDEX IF NOT EXISTS events_project_time ON events(project_id, occurred_at)',
        ]: db.execute(text(sql))

setup()
def now(): return datetime.now(timezone.utc)
def digest(value): return hashlib.sha256(value.encode()).hexdigest()
def stamp(value): return value.isoformat()
def session_user(crease_session: str | None = Cookie(default=None)):
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
def github_auth():
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
def me(user=Depends(session_user)): return user

@app.post('/api/logout')
def logout(response: Response, crease_session: str | None = Cookie(default=None), user=Depends(session_user)):
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

def app_cipher():
    if not all((GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_TOKEN_KEY)):
        raise HTTPException(503, 'GitHub App is not configured by the Crease administrator')
    try: return Fernet(GITHUB_APP_TOKEN_KEY.encode())
    except ValueError: raise HTTPException(503, 'GitHub App token key is invalid')

def app_user_token(value, user):
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
def github_app_status(user=Depends(session_user)):
    configured = all((GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_TOKEN_KEY))
    return {'configured': bool(configured), 'install_url': 'https://github.com/apps/'+GITHUB_APP_SLUG+'/installations/new' if configured else None, 'public_origin_configured': bool(CREASE_PUBLIC_ORIGIN)}

@app.get('/api/github-app/connect')
def github_app_connect(user=Depends(session_user)):
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
    response = RedirectResponse(FRONTEND_URL+'/dashboard', status_code=302)
    response.set_cookie('crease_app_token', cipher.encrypt(json.dumps({'token':token,'user_id':user['id']}).encode()).decode(), httponly=True, secure=SECURE, samesite='lax', max_age=3600, path='/')
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

@app.post('/api/projects/{project_id}/github-install')
async def github_install(project_id: str, data: GitHubInstallInput, crease_app_token: str | None = Cookie(default=None), user=Depends(session_user)):
    with engine.connect() as db: owned(db, project_id, user['id'])
    token = app_user_token(crease_app_token, user)
    result, _ = await github_app_pages(token, f'/user/installations/{data.installation_id}/repositories', 'repositories')
    if not any(repo['full_name'].lower() == data.repository.lower() for repo in result): raise HTTPException(403, 'Repository is not accessible to this account')
    return await create_install_pr(token, data.repository, data.path, project_id, CREASE_PUBLIC_ORIGIN)

@app.get('/api/projects')
def projects(user=Depends(session_user)):
    with engine.connect() as db: return [dict(r) for r in db.execute(text('SELECT id,name,domain,retention_days FROM projects WHERE user_id=:user'), {'user':user['id']}).mappings()]

@app.post('/api/projects', status_code=201)
def create_project(data: ProjectInput, user=Depends(session_user)):
    domain = data.domain.strip().lower().rstrip('.')
    if not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', domain): raise HTTPException(422, 'Enter a hostname without a scheme or path')
    if not data.name.strip(): raise HTTPException(422, 'Project name is required')
    result = {'id':str(uuid4()),'name':data.name.strip(),'domain':domain,'retention_days':90}
    with engine.begin() as db: db.execute(text('INSERT INTO projects (id,user_id,name,domain,retention_days) VALUES (:id,:user,:name,:domain,90)'), {**result,'user':user['id']})
    return result

@app.delete('/api/projects/{project_id}')
def delete_project(project_id: str, user=Depends(session_user)):
    with engine.begin() as db:
        owned(db, project_id, user['id'])
        db.execute(text('DELETE FROM events WHERE project_id=:id'), {'id':project_id})
        db.execute(text('DELETE FROM projects WHERE id=:id'), {'id':project_id})
    return {'ok':True}

@app.patch('/api/projects/{project_id}/retention')
def retention(project_id: str, data: RetentionInput, user=Depends(session_user)):
    with engine.begin() as db:
        owned(db, project_id, user['id'])
        db.execute(text('UPDATE projects SET retention_days=:days WHERE id=:id'), {'days':data.retention_days,'id':project_id})
        db.execute(text('DELETE FROM events WHERE project_id=:id AND occurred_at<:cutoff'), {'id':project_id,'cutoff':stamp(now()-timedelta(days=data.retention_days))})
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

hits = defaultdict(deque)
@app.middleware('http')
async def limits(request: Request, call_next):
    origin = request.headers.get('origin')
    if request.url.path == '/api/events' and request.method == 'OPTIONS':
        return Response(status_code=204, headers={'Access-Control-Allow-Origin': origin or 'null', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin'})
    if request.method in ('POST', 'PATCH', 'DELETE') and request.url.path != '/api/events' and origin != FRONTEND_URL:
        return Response(status_code=403)
    if request.url.path == '/api/events':
        length = request.headers.get('content-length')
        if length and (not length.isdigit() or int(length)>32768): return Response(status_code=413)
        body = await request.body()
        if len(body)>32768: return Response(status_code=413)
        key = request.client.host if request.client else 'unknown'; current = time.monotonic(); q = hits[key]
        while q and q[0] < current-60: q.popleft()
        if len(q)>=120: return Response(status_code=429)
        q.append(current)
    response = await call_next(request)
    if request.url.path == '/api/events' and origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
    return response

@app.post('/api/events')
def ingest(data: Batch, request: Request):
    origin = request.headers.get('origin', '')
    with engine.begin() as db:
        project = db.execute(text('SELECT domain FROM projects WHERE id=:id'), {'id':data.projectId}).mappings().first()
        if not project: raise HTTPException(404, 'Project not found')
        if not origin or urlsplit(origin).hostname != project['domain']: raise HTTPException(403, 'Origin does not match project')
        inserted = 0
        for e in data.events:
            if not e.path.startswith('/') or '?' in e.path or '#' in e.path: raise HTTPException(422, 'Invalid path')
            if len(e.properties)>20 or any(not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_.-]{0,63}', k) or re.search(r'password|token|secret|email', k, re.I) or not isinstance(v, (int, float, bool)) for k,v in e.properties.items()): raise HTTPException(422, 'Invalid event properties')
            t = e.timestamp if e.timestamp.tzinfo else e.timestamp.replace(tzinfo=timezone.utc)
            if abs((now()-t.astimezone(timezone.utc)).total_seconds()) > 86400 * 7: raise HTTPException(422, 'Event timestamp out of range')
            ua = request.headers.get('user-agent','').lower(); device = 'mobile' if 'mobile' in ua else 'desktop' if ua else 'unknown'
            country = request.headers.get('x-vercel-ip-country', '').upper() if TRUST_VERCEL_GEO else ''
            if not re.fullmatch(r'[A-Z]{2}', country): country = None
            referrer = e.referrer.lower() if e.referrer and re.fullmatch(r'[a-zA-Z0-9.-]+', e.referrer) else None
            result=db.execute(text('INSERT INTO events (project_id,id,name,occurred_at,path,visitor_id,session_id,country,device,referrer,properties) VALUES (:project,:id,:name,:ts,:path,:visitor,:session,:country,:device,:referrer,:properties) ON CONFLICT (project_id,id) DO NOTHING'), {'project':data.projectId,'id':e.id,'name':e.name,'ts':stamp(t.astimezone(timezone.utc)),'path':e.path,'visitor':e.visitorId,'session':e.sessionId,'country':country,'device':device,'referrer':referrer,'properties':json.dumps(e.properties)})
            inserted += result.rowcount
    return {'accepted': inserted}

@app.get('/api/projects/{project_id}/summary')
def summary(project_id: str, days: int = 30, user=Depends(session_user)):
    if days not in (7,30,90): raise HTTPException(422, 'Unsupported date range')
    params={'id':project_id,'since':stamp(now()-timedelta(days=days))}
    with engine.connect() as db:
        owned(db, project_id, user['id'])
        metrics=db.execute(text("SELECT COUNT(*) AS events, SUM(CASE WHEN name='pageview' THEN 1 ELSE 0 END) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors, COUNT(DISTINCT session_id) AS sessions FROM events WHERE project_id=:id AND occurred_at>=:since"),params).mappings().one()
        def breakdown(column):
            return [dict(r) for r in db.execute(text(f'SELECT COALESCE({column}, :unknown) AS label, COUNT(*) AS count FROM events WHERE project_id=:id AND occurred_at>=:since AND name=:name GROUP BY {column} ORDER BY count DESC LIMIT 10'), {**params,'unknown':'Unknown','name':'pageview'}).mappings()]
        return {'metrics':{k:(v or 0) for k,v in metrics.items()},'pages':breakdown('path'),'devices':breakdown('device'),'countries':breakdown('country'),'referrers':breakdown('referrer'),'days':days}
