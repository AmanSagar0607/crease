"""Prepare a narrowly scoped GitHub installation pull request."""
import base64
import json
import re
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
from fastapi import HTTPException

REPO = re.compile(r'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')

async def installation_status(token: str, repository: str, project_id: str):
    """Inspect the default branch; this does not establish deployment or consent."""
    if not REPO.fullmatch(repository) or '..' in repository:
        raise HTTPException(422, 'Invalid repository name')
    headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
    try:
        async with httpx.AsyncClient(base_url='https://api.github.com', headers=headers, timeout=15) as client:
            repo = await client.get(f'/repos/{repository}')
            if repo.status_code != 200: raise HTTPException(403, 'Cannot inspect this repository. Check GitHub App access.')
            branch = repo.json()['default_branch']
            for path in ('index.html', 'src/app/layout.tsx', 'src/app/layout.jsx', 'app/layout.tsx', 'app/layout.jsx'):
                response = await client.get(f'/repos/{repository}/contents/{path}', params={'ref':branch})
                if response.status_code == 404: continue
                if response.status_code != 200: raise HTTPException(403, 'Cannot read repository contents. Check GitHub App permissions.')
                content = response.json()
                if content.get('encoding') != 'base64' or content.get('size', 0) > 500_000: raise HTTPException(422, 'The entry file cannot be inspected.')
                try: source = base64.b64decode(content['content'], validate=False).decode('utf-8')
                except (ValueError, UnicodeError, KeyError): raise HTTPException(422, 'The entry file cannot be inspected.')
                state = 'not_installed' if 'data-crease-install' not in source else ('installed' if project_id in source else 'different_project')
                return {'state':state, 'path':path, 'branch':branch}
    except httpx.RequestError as exc: raise HTTPException(503, 'Could not connect to GitHub') from exc
    raise HTTPException(422, 'No supported entry file found, or GitHub App Contents access is missing.')

async def create_install_pr(token: str, repository: str, path: str, project_id: str, public_url: str):
    if not REPO.fullmatch(repository) or '..' in repository:
        raise HTTPException(422, 'Enter a GitHub repository as owner/name')
    if not re.fullmatch(r'[A-Za-z0-9_./-]+\.html?', path) or '..' in path or path.startswith('/'):
        raise HTTPException(422, 'Enter a relative HTML file path, such as index.html')
    parsed = urlsplit(public_url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/') or parsed.hostname in ('localhost', '127.0.0.1'):
        raise HTTPException(422, 'Crease must have a public HTTPS origin before creating an installation pull request')
    origin = 'https://' + parsed.netloc
    headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
    async with httpx.AsyncClient(base_url='https://api.github.com', headers=headers, timeout=20) as client:
        async def call(method, route, missing_ok=False, **kwargs):
            try: response = await client.request(method, route, **kwargs)
            except httpx.RequestError as exc: raise HTTPException(503, 'Could not connect to GitHub') from exc
            if response.status_code == 404 and missing_ok: return None
            if response.status_code >= 400:
                raise HTTPException(400, f'GitHub rejected {method} {route} (HTTP {response.status_code}). Check that the GitHub App has Contents and Pull requests write access and that the installation accepted those permissions.')
            return response.json()
        repo = await call('GET', f'/repos/{repository}')
        base = repo['default_branch']
        contents = await call('GET', f'/repos/{repository}/contents/{path}', params={'ref':base}, missing_ok=True)
        kind = 'html'
        if contents is None and path == 'index.html':
            for candidate in ('src/app/layout.tsx', 'src/app/layout.jsx', 'app/layout.tsx', 'app/layout.jsx'):
                contents = await call('GET', f'/repos/{repository}/contents/{candidate}', params={'ref':base}, missing_ok=True)
                if contents is not None:
                    path, kind = candidate, 'next'
                    break
        if contents is None:
            raise HTTPException(422, 'No supported root index.html or Next.js App Router layout was found, or the GitHub App cannot read repository contents. Grant Contents read and write access to the installation and try again.')
        if contents.get('encoding') != 'base64' or contents.get('size', 0) > 500_000:
            raise HTTPException(422, 'The file must be a text HTML file smaller than 500 KB')
        try: source = base64.b64decode(contents['content']).decode('utf-8')
        except (ValueError, UnicodeError): raise HTTPException(422, 'The HTML file must be UTF-8')
        if 'data-crease-install' in source: raise HTTPException(409, 'This file already contains a Crease installation')
        closing = r'</head\s*>' if kind == 'html' else r'</body\s*>'
        if len(re.findall(closing, source, re.I)) != 1:
            raise HTTPException(422, 'The entry file must contain exactly one closing head tag (HTML) or body tag (Next.js layout).')
        snippet = f'''\n<!-- Crease: dispatch crease:consent after visitor consent is granted. -->\n<script src="{origin}/crease.js" data-crease-install defer></script>\n<script>\n  window.addEventListener('crease:consent', function () {{\n    if (window.crease) window.crease.init({{ projectId: '{project_id}', endpoint: '{origin}/api/events' }});\n  }});\n</script>\n'''
        if kind == 'next':
            script = "window.addEventListener('crease:consent', function () { var s = document.createElement('script'); s.src = " + json.dumps(origin+'/crease.js') + "; s.onload = function () { if (window.crease) window.crease.init({ projectId: " + json.dumps(project_id) + ", endpoint: " + json.dumps(origin+'/api/events') + " }); }; document.head.appendChild(s); }, { once: true });"
            snippet = '\n<script data-crease-install dangerouslySetInnerHTML={{ __html: '+json.dumps(script)+' }} />\n'
        updated = re.sub(closing, lambda match: snippet + match.group(), source, count=1, flags=re.I)
        branch_info = await call('GET', f'/repos/{repository}/branches/{base}')
        branch = 'crease/install-' + uuid4().hex[:12]
        await call('POST', f'/repos/{repository}/git/refs', json={'ref':'refs/heads/'+branch,'sha':branch_info['commit']['sha']})
        await call('PUT', f'/repos/{repository}/contents/{path}', json={'message':'Add Crease analytics installation','content':base64.b64encode(updated.encode()).decode(),'sha':contents['sha'],'branch':branch})
        pr = await call('POST', f'/repos/{repository}/pulls', json={'title':'Add Crease analytics','head':branch,'base':base,'body':'Adds Crease tracking. Tracking starts only when the site dispatches `window.dispatchEvent(new Event("crease:consent"))` after any required consent. Review the code and configure your consent flow before merging.'})
        return {'url':pr['html_url']}
