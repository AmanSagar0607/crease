# Zappa

Revenue and acquisition analytics for SaaS founders, indie hackers and developers. Zappa preserves the existing Next.js dashboard, FastAPI collector/reporting service, and compatible browser/NPM tracking SDKs.

## Local setup

Requirements: Node.js 20.9+, Python 3.10+, PostgreSQL 14+, and a Clerk application. Copy `.env.example` and `backend/.env.example` to local `.env` files, configure Clerk's publishable/secret keys, issuer and exact authorized frontend origins, and provide a local PostgreSQL `DATABASE_URL`. Keep all secret keys outside browser code and source control. Email/password signup, verification, recovery, Google/GitHub social sign-in (after provider setup), and account management are handled by Clerk; GitHub repository installation is a separate integration.

In one terminal, from `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-local.txt
$env:DATABASE_URL='postgresql+psycopg://user:password@localhost:5432/Zappa'
alembic upgrade head
uvicorn main:app --reload --port 8000
```

In another terminal, from the repository root:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000/sign-up` to create an account or `/sign-in` to log in. PostgreSQL is required for the existing FastAPI service; SQLite is rejected. Set `DATABASE_URL` to a SQLAlchemy PostgreSQL URL such as `postgresql+psycopg://user:password@localhost:5432/zappa`, then run `alembic upgrade head` from `backend` before starting the API. The API no longer creates or alters tables on startup. Clerk session JWTs are verified by the backend; legacy `Zappa_session` cookies are not accepted. `BACKEND_URL` controls the frontend's API proxy; `FRONTEND_URL`, `CLERK_ISSUER`, `CLERK_AUTHORIZED_PARTIES` and optionally `CLERK_JWKS_URL` configure the API. Never copy provider credentials into source files.

## Tracking

Copy or serve `sdk/Zappa.js` from your site, then initialize it only after any required visitor consent. The public file name, npm package scope, event contracts, project IDs, and `Zappa_` write-key format remain compatibility identifiers, not the customer-facing Zappa wordmark. Configure the project's exact hostname, the write key shown in the dashboard, and the collector URL shown in the dashboard. Before a project accepts events, it must prove domain ownership with a DNS TXT record (`Zappa-site-verification=<token>`) at `_Zappa-verification.<domain>`; the dashboard shows the token and a check button. See [SDK usage and limitations](sdk/README.md). The write key authenticates writes for one project, but it is embedded in client code; treat collector data as untrusted and rotate the key if it leaks.

The dashboard can also create a GitHub pull request for a static HTML file, regardless of hosting provider. This requires a **separate GitHub App**, independent of Clerk account sign-in. Register it in GitHub Developer Settings with callback `http://localhost:3000/api/github-app/callback`, repository permissions Contents: read/write and Pull requests: read/write, and metadata read. Disable webhooks if unused. Set the GitHub App slug, client ID, client secret, and a generated Fernet key in `backend/.env` (see `.env.example`); restart the API. Install the app on selected repositories, then authorize it separately from Clerk account sign-in; repository access is requested only for the selected GitHub App installation. The app user token is encrypted in an HTTP-only browser cookie for one hour; configure HTTPS and `COOKIE_SECURE=true` outside local development. Repository enumeration is limited to 1,000 installations and 1,000 repositories per installation.

Before creating a pull request, deploy Zappa to a publicly reachable HTTPS origin where `/Zappa.js` and `/api/events` work and set `Zappa_PUBLIC_ORIGIN` once on the server. The pull request adds a consent-gated snippet: the site must dispatch `Zappa:consent` after any required consent. Creating the pull request writes a new branch to GitHub; it does not merge or deploy it. Only a root `index.html` is supported currently. Next.js and other non-HTML entry points, Netlify account connections, and edge injection are not implemented yet.

## Publish the npm package

The reusable client package lives in [`packages/Zappa-analytics`](packages/Zappa-analytics). It exports a framework-neutral `init()` API and a Next.js `<Analytics />` component.

Before publishing, sign in to the npm account or organization that owns the `@Zappa` scope:

```bash
npm login
```

Check the package contents and publish a public release:

```bash
cd packages/Zappa-analytics
npm pack --dry-run
npm publish --access public
```

After publishing, Next.js applications can install it with `npm i @Zappa/analytics` and add the component below to their root layout:

```tsx
import { Analytics } from '@Zappa/analytics/next';

<Analytics projectId="YOUR_Zappa_PROJECT_ID" writeKey="Zappa_YOUR_PROJECT_WRITE_KEY" />
```

For a JavaScript site, import `init` from `@Zappa/analytics`, pass the project ID and write key, and call `track()` for custom events. Only initialize analytics when the site's consent policy permits it.

### Vercel Git settings (experimental)

Register a separate connectable-account integration in Vercel with Project read/write access and redirect URL `http://localhost:3000/api/vercel/callback` for local testing. Set `VERCEL_INTEGRATION_SLUG`, `VERCEL_INTEGRATION_CLIENT_ID`, `VERCEL_INTEGRATION_CLIENT_SECRET`, and an independently generated `VERCEL_TOKEN_KEY` in `backend/.env`, then restart the API. Use the Vercel panel in Zappa to authorize the integration and link a project. Access tokens are encrypted server-side. Disconnecting removes Zappa's stored token and project mappings but does not uninstall the integration at Vercel. Settings are read and written against the linked Vercel project. Inherited team settings are identified separately from project overrides. Project discovery is currently limited to the first 100 projects. Deploy hooks use Vercel's project API, but the published integration scope list does not explicitly include those endpoints; Vercel may deny access. Hook URLs are secrets shown only at creation. Concurrent edits in Vercel can race with Zappa updates. This integration needs a real Vercel integration registration and end-to-end verification before production use.

## Tests

```powershell
node --test sdk/Zappa.test.cjs
cd backend
$env:TEST_DATABASE_URL='postgresql://user:password@localhost:5432/Zappa_test'
python -m unittest test_api -v
```

The backend suite creates an isolated PostgreSQL schema per run and drops it afterward. It refuses to run against the production `DATABASE_URL` or SQLite.

## Current limitations

See [collector API behavior](docs/api.md), [migration status and rollout steps](docs/migrations.md), and the [production deployment checklist](docs/production-checklist.md) before changing the live service.

Country is unknown until the Vercel proxy and `GEO_FORWARD_SECRET` are configured; public ingestion always ignores country headers. Sessions are computed server-side: a new session starts after 30 minutes without an event from the same visitor (`SESSION_IDLE_MINUTES`, default `30`) or at a UTC day boundary. A client-supplied session ID is ignored for that decision. The API records session start/last activity, entry/exit path, and pageview count. Session duration remains approximate. Changing retention updates the setting; `python backend/expire.py` and `POST /internal/retention` delete expired events and session summaries and log counts per project. The API also runs a pass 30 seconds after startup and every 24 hours (`RETENTION_INTERVAL_HOURS`, default `24`), so the hosted deployment needs no external cron. Event ingestion uses durable fixed-window counters in the shared database: `RATE_LIMIT_IP_PER_MINUTE` defaults to `120` and `RATE_LIMIT_PROJECT_PER_MINUTE` defaults to `600`. Ingestion drops requests whose `User-Agent` identifies a crawler, monitor, or automation client (`FILTER_BOTS`, default `true`). Alembic baseline migrations are present; run `alembic upgrade head` before starting the API. Security review, Vercel integration, and full OAuth/production deployment verification remain outstanding. Custom event properties are indexed per event and filterable by key/value through `/api/projects/{id}/events` and `/api/projects/{id}/summary`; `/api/projects/{id}/properties` lists observed keys, types, and top values. A basic two-step, ordered-session funnel is available through `/api/projects/{id}/funnel` and the dashboard Funnel section. Backups need a deletion and retention policy. Public analytics collection requires a per-project write key, but the key ships in client code, so it cannot prevent a determined caller from forging events for that project. Project creation is restricted to authenticated users. Domains must pass DNS TXT ownership verification before their events are accepted; add the TXT record at `_Zappa-verification.<domain>` (existing root TXT records remain supported). Verification checks are limited to 5 per user and project per minute by default (`VERIFY_LIMIT_PER_MINUTE`); once verified, a project stays verified until it is deleted.


### Country geolocation deployment

The Next.js `/api/events` route forwards SDK batches to Render. Set `BACKEND_URL` on Vercel to the HTTPS Render origin, and set the same high-entropy `GEO_FORWARD_SECRET` as a server-only environment variable on Vercel and Render (generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`). Never use a `NEXT_PUBLIC_` name. Other `/api/*` paths continue to use the Next.js rewrite. The Render `/internal/events` endpoint requires the secret and applies the same project, origin, write-key, payload, and rate-limit checks as public ingestion. Direct `/api/events` requests always store Unknown. Missing country also stores Unknown; invalid country is rejected.

Country is trusted by default on the internal route because that route authenticates `GEO_FORWARD_SECRET` before reading the header. Set `TRUST_VERCEL_GEO=false` only if an untrusted party can hold the secret. Confirm on the deployed Vercel site that requests reach the route through Vercel's edge and that client-supplied `X-Vercel-IP-Country` and `X-Vercel-Forwarded-For` are overwritten, including when location is unavailable and when any upstream proxy is present. The secret authenticates the forwarding function, not the original header. Verify route precedence, CORS, rate limiting, and a spoofed-header request end to end. Rotate the shared secret on both services if exposed. Do not forward it to browsers or logs. Local development without the secret uses public ingestion and stores Unknown.
