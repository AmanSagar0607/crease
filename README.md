# Crease

An early multi-project analytics MVP with a Next.js frontend, a Python/FastAPI backend, and a standalone browser SDK. The app is under development and is not ready for public production deployment.

## Local setup

Requirements: Node.js 20.9+, Python 3.10+, and a GitHub OAuth app. In [GitHub Developer Settings](https://github.com/settings/developers), register a new OAuth app with homepage `http://localhost:3000` and authorization callback `http://localhost:3000/api/auth/callback`. Generate a client secret. Copy `backend/.env.example` to `backend/.env` and fill in the client ID and secret locally; never commit or share the secret. Restart the Python server after editing `.env`.

In one terminal, from `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-local.txt
uvicorn main:app --reload --port 8000
```

In another terminal, from the repository root:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000/api/auth/github` to sign in. SQLite is used locally by default. Set `DATABASE_URL` to a SQLAlchemy PostgreSQL URL such as `postgresql+psycopg://user:password@host:5432/crease` to use PostgreSQL. Tables are created on API startup; a migration system is still needed before upgrading a deployed database. `BACKEND_URL` controls the frontend's API proxy; `FRONTEND_URL` and `PUBLIC_API_URL` configure the backend's redirect and origin settings. In a real HTTPS environment, set `COOKIE_SECURE=true`; route OAuth and API requests through the same public host and register that callback URL.

## Tracking

Copy or serve `sdk/crease.js` from your site, then initialize it only after any required visitor consent. Configure the project's exact hostname, the write key shown in the dashboard, and the collector URL shown in the dashboard. Before a project accepts events, it must prove domain ownership with a DNS TXT record (`crease-site-verification=<token>`) or a root `<meta name="crease-site-verification" content="<token>">` tag; the dashboard shows the token and a check button. See [SDK usage and limitations](sdk/README.md). The write key authenticates writes for one project, but it is embedded in client code; treat collector data as untrusted and rotate the key if it leaks.

The dashboard can also create a GitHub pull request for a static HTML file, regardless of hosting provider. This requires a **separate GitHub App**, in addition to the sign-in OAuth app. Register it in GitHub Developer Settings with callback `http://localhost:3000/api/github-app/callback`, repository permissions Contents: read/write and Pull requests: read/write, and metadata read. Disable webhooks if unused. Set the GitHub App slug, client ID, client secret, and a generated Fernet key in `backend/.env` (see `.env.example`); restart the API. Install the app on selected repositories, then authorize it from the dashboard using the same GitHub account used to sign in. The app user token is encrypted in an HTTP-only browser cookie for one hour; configure HTTPS and `COOKIE_SECURE=true` outside local development. Repository enumeration is limited to 1,000 installations and 1,000 repositories per installation.

Before creating a pull request, deploy Crease to a publicly reachable HTTPS origin where `/crease.js` and `/api/events` work and set `CREASE_PUBLIC_ORIGIN` once on the server. The pull request adds a consent-gated snippet: the site must dispatch `crease:consent` after any required consent. Creating the pull request writes a new branch to GitHub; it does not merge or deploy it. Only a root `index.html` is supported currently. Next.js and other non-HTML entry points, Netlify account connections, and edge injection are not implemented yet.

## Publish the npm package

The reusable client package lives in [`packages/crease-analytics`](packages/crease-analytics). It exports a framework-neutral `init()` API and a Next.js `<Analytics />` component.

Before publishing, sign in to the npm account or organization that owns the `@crease` scope:

```bash
npm login
```

Check the package contents and publish a public release:

```bash
cd packages/crease-analytics
npm pack --dry-run
npm publish --access public
```

After publishing, Next.js applications can install it with `npm i @crease/analytics` and add the component below to their root layout:

```tsx
import { Analytics } from '@crease/analytics/next';

<Analytics projectId="YOUR_CREASE_PROJECT_ID" writeKey="crease_YOUR_PROJECT_WRITE_KEY" />
```

For a JavaScript site, import `init` from `@crease/analytics`, pass the project ID and write key, and call `track()` for custom events. Only initialize analytics when the site's consent policy permits it.

### Vercel Git settings (experimental)

Register a separate connectable-account integration in Vercel with Project read/write access and redirect URL `http://localhost:3000/api/vercel/callback` for local testing. Set `VERCEL_INTEGRATION_SLUG`, `VERCEL_INTEGRATION_CLIENT_ID`, `VERCEL_INTEGRATION_CLIENT_SECRET`, and an independently generated `VERCEL_TOKEN_KEY` in `backend/.env`, then restart the API. Use the Vercel panel in Crease to authorize the integration and link a project. Access tokens are encrypted server-side. Disconnecting removes Crease's stored token and project mappings but does not uninstall the integration at Vercel. Settings are read and written against the linked Vercel project. Inherited team settings are identified separately from project overrides. Project discovery is currently limited to the first 100 projects. Deploy hooks use Vercel's project API, but the published integration scope list does not explicitly include those endpoints; Vercel may deny access. Hook URLs are secrets shown only at creation. Concurrent edits in Vercel can race with Crease updates. This integration needs a real Vercel integration registration and end-to-end verification before production use.

## Tests

```powershell
node --test sdk/crease.test.cjs
cd backend
python -m unittest test_api -v
```

## Current limitations

Country displays unknown by default. Set `TRUST_VERCEL_GEO=true` only when requests reach the API exclusively through a trusted Vercel deployment that overwrites geolocation headers; otherwise callers can spoof locations. Sessions currently follow tab storage rather than an inactivity window. Retention runs when the setting changes and can be enforced regularly with `python backend/expire.py`; production requires scheduling it. The in-memory rate limiter is per-process and is not sufficient for distributed deployment. Durable migrations, shared abuse protection, security review, Vercel integration, and full OAuth/production deployment verification remain outstanding. Custom event properties are stored but not yet available for filtering. Backups need a deletion and retention policy. Public analytics collection requires a per-project write key, but the key ships in client code, so it cannot prevent a determined caller from forging events for that project. Project creation is restricted to authenticated users. Domains must pass DNS TXT or root meta-tag ownership verification before their events are accepted; once verified, a project stays verified until it is deleted.
