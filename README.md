# Crease

An early multi-project analytics MVP with a Next.js frontend, a Python/FastAPI backend, and a standalone browser SDK. The app is under development and is not ready for public production deployment.

## Local setup

Requirements: Node.js 20.9+, Python 3.10+, and a GitHub OAuth app. In [GitHub Developer Settings](https://github.com/settings/developers), register a new OAuth app with homepage `http://localhost:3000` and authorization callback `http://localhost:3000/api/auth/callback`. Generate a client secret. Copy `backend/.env.example` to `backend/.env` and fill in the client ID and secret locally; never commit or share the secret. Restart the Python server after editing `.env`.

In one terminal, from `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

In another terminal, from the repository root:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000/api/auth/github` to sign in. SQLite is used locally by default. Set `DATABASE_URL` to a SQLAlchemy PostgreSQL URL such as `postgresql+psycopg://user:password@host:5432/crease` to use PostgreSQL. Tables are created on API startup; a migration system is still needed before upgrading a deployed database. `BACKEND_URL` controls the frontend's API proxy; `FRONTEND_URL` and `PUBLIC_API_URL` configure the backend's redirect and origin settings. In a real HTTPS environment, set `COOKIE_SECURE=true`; route OAuth and API requests through the same public host and register that callback URL.

## Tracking

Copy or serve `sdk/crease.js` from your site, then initialize it only after any required visitor consent. Configure the project's exact hostname and use the collector URL shown in the dashboard. See [SDK usage and limitations](sdk/README.md). A hostname and public project ID do not authenticate events; collector data is untrusted.

The dashboard can also create a GitHub pull request for a static HTML file, regardless of hosting provider. This requires a **separate GitHub App**, in addition to the sign-in OAuth app. Register it in GitHub Developer Settings with callback `http://localhost:3000/api/github-app/callback`, repository permissions Contents: read/write and Pull requests: read/write, and metadata read. Disable webhooks if unused. Set the GitHub App slug, client ID, client secret, and a generated Fernet key in `backend/.env` (see `.env.example`); restart the API. Install the app on selected repositories, then authorize it from the dashboard using the same GitHub account used to sign in. The app user token is encrypted in an HTTP-only browser cookie for one hour; configure HTTPS and `COOKIE_SECURE=true` outside local development. Repository enumeration is limited to 1,000 installations and 1,000 repositories per installation.

Before creating a pull request, deploy Crease to a publicly reachable HTTPS origin where `/crease.js` and `/api/events` work and set `CREASE_PUBLIC_ORIGIN` once on the server. The pull request adds a consent-gated snippet: the site must dispatch `crease:consent` after any required consent. Creating the pull request writes a new branch to GitHub; it does not merge or deploy it. Only a root `index.html` is supported currently. Next.js and other non-HTML entry points, Vercel and Netlify account connections, and edge injection are not implemented yet.

## Tests

```powershell
node --test sdk/crease.test.cjs
cd backend
python -m unittest test_api -v
```

## Current limitations

Country displays unknown by default. Set `TRUST_VERCEL_GEO=true` only when requests reach the API exclusively through a trusted Vercel deployment that overwrites geolocation headers; otherwise callers can spoof locations. Sessions currently follow tab storage rather than an inactivity window. Retention runs when the setting changes and can be enforced regularly with `python backend/expire.py`; production requires scheduling it. The in-memory rate limiter is per-process and is not sufficient for distributed deployment. Durable migrations, shared abuse protection, security review, Vercel integration, and full OAuth/production deployment verification remain outstanding. Custom event properties are stored but not yet available for filtering. Backups need a deletion and retention policy. Public analytics collection can be forged. Project creation is restricted to authenticated users, but domains are not ownership-verified.
