# Crease — Handoff Context

Last updated: 2026-11-13

## Product goal

Crease is a free, PostHog-style product analytics platform for independent developers. Developers sign in with GitHub, create projects for their websites, install a tracker manually, through an npm package, or through a reviewable GitHub pull request, then view visitors, sessions, page views, pages, devices, referrers, and countries.

The product should feel similar to Vercel’s project experience:

- One workspace with multiple projects.
- A dedicated page for each project.
- Project tabs for Analytics, Installation, Integrations, and Settings.
- GitHub connects once per account; users then connect a specific repository to each Crease project.
- Vercel integration is optional and manages a user-selected Vercel project.

## Repository and current branch

- Repository: `https://github.com/AmanSagar0607/crease`
- Production branch: `main`
- Deployment branch: `deploy/crease-mvp`
- Latest intended commit at handoff: `d8bac36` — `Show project sections as tabs`

Do not commit `.env`, `.env.local`, `.neon`, `.vercel`, `backend/.tools`, `.agents`, or `.codex`.

## Architecture

| Area | Technology | Current deployment |
| --- | --- | --- |
| Frontend | Next.js 16 / React | Vercel: `https://crease-bice.vercel.app` |
| API | Python FastAPI | Render: `https://crease-api-u8uy.onrender.com` |
| Database | Neon Postgres | Neon project `crease` / `red-truth-68796652` |
| GitHub | OAuth App for sign-in + GitHub App for repositories | Configured by owner |
| Vercel | Connectable account integration | Configured by owner |
| Legacy backend experiment | Cloudflare Python Worker | `crease-api`; unusable on the free Workers CPU limit, Render is the active backend |

Vercel forwards `/api/*` to Render using the Vercel production `BACKEND_URL` environment variable.

## Important files

- `app/dashboard/DashboardView.tsx` — dashboard and dedicated project-page content.
- `app/dashboard/ProjectTabController.tsx` — tab behavior for project pages.
- `app/dashboard/GitHubInstall.tsx` — GitHub connection, repository status, and installation PR UI.
- `app/dashboard/VercelGitSettings.tsx` — Vercel integration UI.
- `backend/main.py` — FastAPI app, OAuth, projects, events, GitHub and Vercel endpoints.
- `backend/github_install.py` — creates GitHub installation/activation pull requests.
- `public/crease.js` — standalone browser tracker.
- `packages/crease-analytics` — npm package source.
- `app/docs/page.tsx` — public package usage page at `/docs`.

## What is working

### Authentication and projects

- GitHub OAuth sign-in uses `https://crease-bice.vercel.app/api/auth/callback` in production.
- Users can create projects and get dedicated URLs such as `/dashboard/projects/:id`.
- Each project page now has real tabs. Only the selected tab’s content is displayed.

### Analytics ingestion

- Events persist in Neon.
- The `aman` / `amansagar.in` project (`752c8641-2616-4a38-88f3-2dade631f6d3`) is receiving data.
- At last observation it showed 5 page views, 2 visitors, and 2 sessions.
- Event ingestion permits the configured hostname and its `www.` counterpart because `amansagar.in` redirects to `www.amansagar.in`.
- Country is currently `Unknown` because trusted edge geo headers are not enabled for the Render path.

### GitHub repository integration

- The GitHub account connection is stored encrypted in Postgres, instead of only in a one-hour browser cookie.
- Project repositories are stored in `project_repositories`.
- The UI hides repository search once the project already has a repository connected.
- The API inspects the repository’s default branch and reports:
  - `installed`
  - `not_installed`
  - `different_project`
- Installation status no longer polls continuously. It checks once on load and when the user presses **Check again**.
- Installation status includes received analytics event count and latest event time.
- Static HTML and Next.js App Router layouts are supported:
  - `index.html`
  - `src/app/layout.tsx`
  - `src/app/layout.jsx`
  - `app/layout.tsx`
  - `app/layout.jsx`
- Existing tracking code for `amansagar.in` is present in `src/app/layout.tsx`.
- If an existing installation waits for `crease:consent` but no consent manager dispatches that event, the UI offers **Prepare tracking pull request**. That creates a reviewable GitHub PR changing startup to `load` instead of `crease:consent`.

### Vercel integration

- Vercel account connection can complete.
- The project picker currently returns no Vercel projects. This is likely Vercel integration project access/scoping, not a frontend error.
- The Vercel integration redirect URL must be:

```text
https://crease-bice.vercel.app/api/vercel/callback
```

## Required external configuration

Never paste values from these variables into chat or commit them.

### Render API environment

The Render service needs these values:

```text
DATABASE_URL
FRONTEND_URL=https://crease-bice.vercel.app
PUBLIC_API_URL=https://crease-bice.vercel.app
CREASE_PUBLIC_ORIGIN=https://crease-bice.vercel.app
COOKIE_SECURE=true
PYTHON_VERSION=3.12.11
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_APP_SLUG
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_TOKEN_KEY
VERCEL_INTEGRATION_SLUG
VERCEL_INTEGRATION_CLIENT_ID
VERCEL_INTEGRATION_CLIENT_SECRET
VERCEL_TOKEN_KEY
```

The Neon URL was accidentally shared in chat during setup. The owner should rotate the Neon password, then update `DATABASE_URL` in Render and local `backend/.env`.

### GitHub OAuth App — sign-in

The OAuth App client ID is configured in Render as `GITHUB_CLIENT_ID`.

Production callback:

```text
https://crease-bice.vercel.app/api/auth/callback
```

### GitHub App — repository access

The GitHub App is `CREASE-APP`. It must use:

```text
https://crease-bice.vercel.app/api/github-app/callback
```

Required repository permissions:

- Metadata: read (mandatory)
- Contents: read and write
- Pull requests: read and write

After changing permissions, the existing installation must accept the new permissions and include the desired repositories.

### Vercel Integration

The Vercel Integration’s redirect URL must be:

```text
https://crease-bice.vercel.app/api/vercel/callback
```

Ensure the integration is installed on the relevant Vercel team and granted access to the projects users should see.

## Npm package

The source package is `packages/crease-analytics` and is named `@crease/analytics`.

Exports:

```ts
import { init } from '@crease/analytics';
import { Analytics } from '@crease/analytics/next';
```

Next.js usage:

```tsx
import { Analytics } from '@crease/analytics/next';

<Analytics projectId="YOUR_CREASE_PROJECT_ID" />
```

The package was verified with a direct Node ESM import. The docs page is `/docs`.

It is **not confirmed published to npm**. `npm whoami` reported no npm login and npm reported that `@crease/analytics` does not currently exist.

To publish, the owner must run:

```bash
npm login
cd packages/crease-analytics
npm pack --dry-run
npm publish --access public
```

The npm account must own the `@crease` scope. If it does not, choose a package name/scope that the owner controls before publishing.

## Validation already performed

- `npm run build` passed after dashboard, npm package docs, and tabs changes.
- `python -m unittest test_api.py` passed with 16 tests after analytics and GitHub changes.
- Render deployment was confirmed live several times during setup.
- Vercel production deployments are triggered automatically by pushes to `main`; always check the latest deployment after a push.

## Current limitations and priorities

1. **Fix Vercel project discovery.** The Vercel UI says the account is connected but returns no available projects. Inspect OAuth token scope/team context and Vercel integration installation configuration.
2. **Publish `@crease/analytics`.** Login to npm and confirm scope ownership first.
3. **Improve analytics accuracy.** Country data is unknown. A trusted proxy/edge geo strategy is needed before enabling geo headers.
4. **Add SPA route tracking.** The standalone `public/crease.js` tracker needs deliberate History API handling; the npm package currently tracks initial page view and `popstate`.
5. **Add durable schema migrations and scheduled retention cleanup.** Current schema uses `CREATE TABLE IF NOT EXISTS`; retention cleanup is not scheduled.
6. **Security/production review.** In-memory rate limits are per-process. Domain ownership is not verified. Public event ingestion can be forged. Review before a broader public launch.
7. **Package release automation.** Add npm provenance/CI and a release workflow after manual publishing works.

## Production hardening work in progress (local, not deployed)

- Both `sdk/crease.js` and `packages/crease-analytics/index.js` now observe `pushState`, `replaceState`, query-only route changes, and `popstate`; duplicate URLs are suppressed and navigation is not blocked.
- SDK visitor and session IDs now use shared first-party local storage. Session IDs rotate after 30 minutes idle or 24 hours. API `analytics_sessions` records first/last event time, entry/exit path, visitor ID, and pageview count. Duration is approximate based on received events.
- The ingestion OPTIONS response now permits `X-Crease-Key`, which the SDK sends.
- `backend/expire.py` deletes expired session records with expired events. Project deletion and retention-setting updates also clear corresponding session records.
- API/SDK documentation was updated. The current API test suite stalls during the first focused API test in this Windows environment; no API test result should be assumed. The SDK test file passes five tests.
- The backend now requires `DATABASE_URL` and refuses SQLite URLs. This prevents the Windows development environment or a misconfigured deployment from silently creating a local SQLite database.
- `/health` now verifies the configured database with `SELECT 1` and does not return credentials.
- Neon was checked read-only: it contains one user, one project, and 16 events, with eight distinct event session IDs. The local SQLite file is an older copy of that same GitHub identity/site, with different IDs and zero events, so copying its rows would create duplicates. No local SQLite records were imported.
- API startup applies additive idempotent schema setup and backfills `analytics_sessions` from existing event history using replacement upserts, so a restart will not double-count. Production still lacks `analytics_sessions` and `rate_limits` until the new backend starts against Neon. This is not versioned Alembic migration yet.
- Render service `crease-api` exists on `deploy/crease-mvp`, uses `https://crease-api-u8uy.onrender.com`, and auto-deploys on commits. The available Render connector does not expose a safe read-only check of secret environment-variable presence. Verify `DATABASE_URL` is configured in Render without printing its value.
- Direct database connections from this Windows environment time out; the Neon MCP read-only query path works. Full backend tests remain unverified here. SDK tests passed 5/5 and Python compilation passed before the last database guard/backfill edits; rerun compilation after them.
- The temporary Neon test branch `codex-test-session-hardening` expires automatically and was created only for isolated testing; it was not promoted to production.
- These code changes are not pushed or deployed. The current branch is `deploy/crease-mvp`; preserve existing unrelated edits, especially `docs/IMPROVEMENT_AUDIT.md`.
- Other production hardening items remain open: event schemas/idempotency quotas beyond current controls, versioned migrations, Vercel project discovery, property filtering, scheduled retention, account deletion, and complete security/tenant review.
- The requested `/dashboard` visual update based on the attached dark sidebar analytics screenshot is still unimplemented.

## User-facing behavior to preserve

- Do not show the full repository search/list for a project that already has a connected repository.
- Do not auto-create or merge tracking PRs. The user must review and merge them.
- Do not claim installation status means data is flowing. Show both repository-installation state and actual event receipt count.
- Keep the user’s analytics dashboard concise and project-focused.
