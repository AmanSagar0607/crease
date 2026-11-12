"""Prepare a narrowly scoped GitHub installation pull request."""
import base64
import re
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
from fastapi import HTTPException

REPO = re.compile(r'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')

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
        async def call(method, route, **kwargs):
            try: response = await client.request(method, route, **kwargs)
            except httpx.RequestError as exc: raise HTTPException(503, 'Could not connect to GitHub') from exc
            if response.status_code >= 400:
                raise HTTPException(400, f'GitHub rejected the request (HTTP {response.status_code}). Check repository access and token permissions.')
            return response.json()
        repo = await call('GET', f'/repos/{repository}')
        base = repo['default_branch']
        contents = await call('GET', f'/repos/{repository}/contents/{path}', params={'ref':base})
        if contents.get('encoding') != 'base64' or contents.get('size', 0) > 500_000:
            raise HTTPException(422, 'The file must be a text HTML file smaller than 500 KB')
        try: source = base64.b64decode(contents['content']).decode('utf-8')
        except (ValueError, UnicodeError): raise HTTPException(422, 'The HTML file must be UTF-8')
        if 'data-crease-install' in source: raise HTTPException(409, 'This file already contains a Crease installation')
        if not re.search(r'</head\s*>', source, re.I): raise HTTPException(422, 'The HTML file needs a closing head tag')
        snippet = f'''\n<!-- Crease: dispatch crease:consent after visitor consent is granted. -->\n<script src="{origin}/crease.js" data-crease-install defer></script>\n<script>\n  window.addEventListener('crease:consent', function () {{\n    if (window.crease) window.crease.init({{ projectId: '{project_id}', endpoint: '{origin}/api/events' }});\n  }});\n</script>\n'''
        updated = re.sub(r'</head\s*>', lambda match: snippet + match.group(), source, count=1, flags=re.I)
        branch_info = await call('GET', f'/repos/{repository}/branches/{base}')
        branch = 'crease/install-' + uuid4().hex[:12]
        await call('POST', f'/repos/{repository}/git/refs', json={'ref':'refs/heads/'+branch,'sha':branch_info['commit']['sha']})
        await call('PUT', f'/repos/{repository}/contents/{path}', json={'message':'Add Crease analytics installation','content':base64.b64encode(updated.encode()).decode(),'sha':contents['sha'],'branch':branch})
        pr = await call('POST', f'/repos/{repository}/pulls', json={'title':'Add Crease analytics','head':branch,'base':base,'body':'Adds Crease tracking. Tracking starts only when the site dispatches `window.dispatchEvent(new Event("crease:consent"))` after any required consent. Review the code and configure your consent flow before merging.'})
        return {'url':pr['html_url']}
