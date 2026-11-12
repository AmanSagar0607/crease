"""Cloudflare Python Worker adapter for the existing FastAPI application."""
import asyncio
import os
from urllib.parse import quote
from workers import WorkerEntrypoint, asgi

lock = asyncio.Lock()
application = None

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        global application
        # Hyperdrive's synchronous sockets must not be shared across requests.
        async with lock:
            if application is None:
                db = self.env.HYPERDRIVE
                user = quote(str(db.user), safe='')
                password = quote(str(db.password), safe='')
                database = quote(str(db.database), safe='')
                os.environ['DATABASE_URL'] = f'postgresql+pg8000://{user}:{password}@{db.host}:{db.port}/{database}'
                os.environ['CREASE_WORKER'] = '1'
                for key in ('FRONTEND_URL', 'PUBLIC_API_URL', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_APP_SLUG', 'GITHUB_APP_CLIENT_ID', 'GITHUB_APP_CLIENT_SECRET', 'GITHUB_APP_TOKEN_KEY', 'CREASE_PUBLIC_ORIGIN', 'COOKIE_SECURE', 'VERCEL_INTEGRATION_SLUG', 'VERCEL_INTEGRATION_CLIENT_ID', 'VERCEL_INTEGRATION_CLIENT_SECRET', 'VERCEL_TOKEN_KEY'):
                    value = getattr(self.env, key, None)
                    if value is not None: os.environ[key] = str(value)
                from main import app
                application = app
            return await asgi.fetch(application, request, self.env)
