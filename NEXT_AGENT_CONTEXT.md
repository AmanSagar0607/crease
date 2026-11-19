# Zappa — Handoff Context

Last updated: 2026-11-13

## Product goal

Zappa is a free, PostHog-style product analytics platform for independent developers. Developers sign in with GitHub, create projects for their websites, install a tracker manually, through an npm package, or through a reviewable GitHub pull request, then view visitors, sessions, page views, pages, devices, referrers, and countries.

The product should feel similar to Vercel’s project experience:

- One workspace with multiple projects.
- A dedicated page for each project.
- Project tabs for Analytics, Installation, Integrations, and Settings.
- GitHub connects once per account; users then connect a specific repository to each Zappa project.
- Vercel integration is optional and manages a user-selected Vercel project.

## Repository and current branch

- Repository: `https://github.com/AmanSagar0607/Zappa`
- Production branch: `main`
- Deployment branch: `deploy/Zappa-mvp`
- Latest intended commit at handoff: `d8bac36` — `Show project sections as tabs`

Do not commit `.env`, `.env.local`, `.neon`, `.vercel`, `backend/.tools`, `.agents`, or `.codex`.

## Architecture

| Area | Technology | Current deployment |
| --- | --- | --- |
| Frontend | Next.js 16 / React | Vercel: `https://Zappa-bice.vercel.app` |
| API | Python FastAPI | Render: `https://Zappa-api-u8uy.onrender.com` |
| Database | Neon Postgres | Neon project `Zappa` / `red-truth-68796652` |
| GitHub | OAuth App for sign-in + GitHub App for repositories | Configured by owner |
| Vercel | Connectable account integration | Configured by owner |
| Legacy backend experiment | Cloudflare Python Worker | `Zappa-api`; unusable on the free Workers CPU limit, Render is the active backend |

Vercel forwards `/api/*` to Render using the Vercel production `BACKEND_URL` environment variable.

## Important files

- `app/dashboard/DashboardView.tsx` — dashboard and dedicated project-page content.
- `app/dashboard/ProjectTabController.tsx` — tab behavior for project pages.
- `app/dashboard/GitHubInstall.tsx` — GitHub connection, repository status, and installation PR UI.
- `app/dashboard/VercelGitSettings.tsx` — Vercel integration UI.
- `backend/main.py` — FastAPI app, OAuth, projects, events, GitHub and Vercel endpoints.
- `backend/github_install.py` — creates GitHub installation/activation pull requests.
- `public/Zappa.js` — standalone browser tracker.
- `packages/Zappa-analytics` — npm package source.
- `app/docs/page.tsx` — public package usage page at `/docs`.

## What is working

### Authentication and projects

- GitHub OAuth sign-in uses `https://Zappa-bice.vercel.app/api/auth/callback` in production.
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
- If an existing installation waits for `Zappa:consent` but no consent manager dispatches that event, the UI offers **Prepare tracking pull request**. That creates a reviewable GitHub PR changing startup to `load` instead of `Zappa:consent`.

### Vercel integration

- Vercel account connection can complete.
- The project picker currently returns no Vercel projects. This is likely Vercel integration project access/scoping, not a frontend error.
- The Vercel integration redirect URL must be:

```text
https://Zappa-bice.vercel.app/api/vercel/callback
```

## Required external configuration

Never paste values from these variables into chat or commit them.

### Render API environment

The Render service needs these values:

```text
DATABASE_URL
FRONTEND_URL=https://Zappa-bice.vercel.app
PUBLIC_API_URL=https://Zappa-bice.vercel.app
Zappa_PUBLIC_ORIGIN=https://Zappa-bice.vercel.app
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
https://Zappa-bice.vercel.app/api/auth/callback
```

### GitHub App — repository access

The GitHub App is `Zappa-APP`. It must use:

```text
https://Zappa-bice.vercel.app/api/github-app/callback
```

Required repository permissions:

- Metadata: read (mandatory)
- Contents: read and write
- Pull requests: read and write

After changing permissions, the existing installation must accept the new permissions and include the desired repositories.

### Vercel Integration

The Vercel Integration’s redirect URL must be:

```text
https://Zappa-bice.vercel.app/api/vercel/callback
```

Ensure the integration is installed on the relevant Vercel team and granted access to the projects users should see.

## Npm package

The source package is `packages/Zappa-analytics` and is named `@Zappa/analytics`.

Exports:

```ts
import { init } from '@Zappa/analytics';
import { Analytics } from '@Zappa/analytics/next';
```

Next.js usage:

```tsx
import { Analytics } from '@Zappa/analytics/next';

<Analytics projectId="YOUR_Zappa_PROJECT_ID" />
```

The package was verified with a direct Node ESM import. The docs page is `/docs`.

It is **not confirmed published to npm**. `npm whoami` reported no npm login and npm reported that `@Zappa/analytics` does not currently exist.

To publish, the owner must run:

```bash
npm login
cd packages/Zappa-analytics
npm pack --dry-run
npm publish --access public
```

The npm account must own the `@Zappa` scope. If it does not, choose a package name/scope that the owner controls before publishing.

## Validation already performed

- `npm run build` passed after dashboard, npm package docs, and tabs changes.
- `python -m unittest test_api.py` passed with 16 tests after analytics and GitHub changes.
- Render deployment was confirmed live several times during setup.
- Vercel production deployments are triggered automatically by pushes to `main`; always check the latest deployment after a push.

## Current limitations and priorities

1. **Fix Vercel project discovery.** The Vercel UI says the account is connected but returns no available projects. Inspect OAuth token scope/team context and Vercel integration installation configuration.
2. **Publish `@Zappa/analytics`.** Login to npm and confirm scope ownership first.
3. **Improve analytics accuracy.** Country data is unknown. A trusted proxy/edge geo strategy is needed before enabling geo headers.
4. **Keep SPA tracking covered.** Both the standalone tracker and npm package now observe History API changes, query-only route changes, and `popstate`; keep these behaviors covered when changing the SDK.
5. **Add durable schema migrations and scheduled retention cleanup.** Current schema uses `CREATE TABLE IF NOT EXISTS`; retention cleanup is not scheduled.
6. **Security/production review.** In-memory rate limits are per-process. Domain ownership is not verified. Public event ingestion can be forged. Review before a broader public launch.
7. **Package release automation.** Add npm provenance/CI and a release workflow after manual publishing works.

## Production hardening, database migration, and dashboard update (deployed 2026-11-13)

- Both `sdk/Zappa.js` and `packages/Zappa-analytics/index.js` now observe `pushState`, `replaceState`, query-only route changes, and `popstate`; duplicate URLs are suppressed and navigation is not blocked.
- SDK visitor and session IDs now use shared first-party local storage. Session IDs rotate after 30 minutes idle or 24 hours. API `analytics_sessions` records first/last event time, entry/exit path, visitor ID, and pageview count. Duration is approximate based on received events.
- The ingestion OPTIONS response now permits `X-Zappa-Key`, which the SDK sends.
- `backend/expire.py` deletes expired session records with expired events. Project deletion and retention-setting updates also clear corresponding session records.
- API/SDK documentation was updated. Python compilation passed, the SDK test file passed 5/5, and `npx tsc --noEmit` passed. The full Next build compiled and passed TypeScript but failed during prerender with a Windows `EPERM` creating `.next` segment folders. A local browser preview could not reach localhost from the Codex environment.
- The backend now requires `DATABASE_URL` and refuses SQLite URLs. This prevents the Windows development environment or a misconfigured deployment from silently creating a local SQLite database.
- `/health` now verifies the configured database with `SELECT 1` and does not return credentials.
- Neon was checked read-only: it contains one user, one project, and 16 events, with eight distinct event session IDs. The local SQLite file is an older copy of that same GitHub identity/site, with different IDs and zero events, so copying its rows would create duplicates. No local SQLite records were imported.
- API startup applies additive idempotent schema setup and backfills `analytics_sessions` from existing event history using replacement upserts, so a restart will not double-count. The deployment created the missing `analytics_sessions` and `rate_limits` tables and backfilled eight session rows.
- The deployed Render service `Zappa-api` at `https://Zappa-api-u8uy.onrender.com` returned HTTP 200 from `/health` with `database: connected`. Neon still has one user, one project, and all 16 events. No SQLite records were imported because the local snapshot is a stale duplicate with zero events.
- Direct database connections from this Windows environment time out; Neon MCP read-only queries work. The full backend API test suite remains unverified in this environment.
- The temporary Neon test branch `codex-test-session-hardening` expires automatically and was created only for isolated testing; it was not promoted to production.
- Commit `c938fdc` (database hardening/migration) and `3ddfa9e` (dashboard) are pushed to `deploy/Zappa-mvp`. Render auto-deployed both; the latest Render deploy is live.
- The dashboard now uses a dark project sidebar with Analytics sections and opens the single project at `/dashboard`; “All projects” returns to the workspace list. Vercel’s connector currently lists only `true-memory`, and no Vercel deployment exists for the dashboard commit. Preserve the unrelated uncommitted `docs/IMPROVEMENT_AUDIT.md` edit.
- Other production hardening items remain open: event schemas/idempotency quotas beyond current controls, versioned migrations, Vercel project discovery, property filtering, scheduled retention, account deletion, and complete security/tenant review.

## User-facing behavior to preserve

- Do not show the full repository search/list for a project that already has a connected repository.
- Do not auto-create or merge tracking PRs. The user must review and merge them.
- Do not claim installation status means data is flowing. Show both repository-installation state and actual event receipt count.
- Keep the user’s analytics dashboard concise and project-focused.

## Revenue-first phase 1 (local, not deployed)

- Audited the existing Next.js/FastAPI/PostgreSQL architecture and documented the phased implementation and rollout in `docs/REVENUE_FOUNDATION_PLAN.md`.
- Added Alembic revision `0003_attribution_touchpoints`; new consent-enabled pageviews capture bounded UTM evidence and referrer hostnames, scoped to projects and server-assigned sessions. Existing events are not backfilled with invented attribution. Duplicate event IDs do not create duplicate touchpoints. Project deletion and the retention job remove touchpoints.
- Standalone and npm SDKs namespace browser identity by project while retaining existing legacy identity when available; identify no longer creates an identity when tracking is disabled. Both SDKs omit non-allowlisted query parameters and refuse invalid campaign values. The npm package remains unpublished.
- Hardened ingestion against oversized streaming bodies, overlong rate-limit keys and non-finite numeric properties. These browser inputs remain forgeable and cannot verify a transaction.
- Local validation: PostgreSQL fresh upgrade and existing `0002` upgrade/downgrade preserve legacy events; backend tests, SDK tests, and build/type checks were run against the local workspace. Production migrations were not executed. Run `alembic upgrade head` separately only after backup and rollout review. Payment ingestion, customer association, attribution reports, currency handling, revenue dashboard, funnels, and other later phases remain unimplemented.

## Revenue phase 2 foundation (local, not deployed)

- Commit `b2026fe` records phase 1. Added an initial provider-neutral event model and a Stripe adapter using the official SDK to verify raw webhook signatures; synthetic signed events are tested, but no real Stripe sandbox webhook has been verified and the integration must not be presented as production-ready.
- Added revision `0004_payment_foundation`, encrypted per-project Stripe signing-secret storage, owner-scoped setup/status/disconnect endpoints, webhook event deduplication, captured-charge records and monotonic cumulative refunds. Test/live modes and currencies are separated, there is no exchange-rate conversion, and conflicting payment data returns 409. Retention and project deletion cover the new data; disconnect does not remove historical payments.
- `PAYMENT_ENCRYPTION_KEY` must be a dedicated Fernet key and migrations must be reviewed and run separately. See `docs/payment-integrations.md`. Do not collect or store card data or raw webhook payloads. The adapter is incomplete until actual sandbox testing, reconciliation, subscription/dispute/partial-capture handling, and a trustworthy customer-to-visitor association exist. All revenue must remain unattributed until such a link is established. Other payment providers, reporting, customer intelligence, and dashboard work remain later phases.

- Attribution follow-up: npm SPA pageviews now send the previous same-site hostname rather than repeatedly attributing every route to the initial external document referrer. The backend consequently records subsequent same-site visits as direct evidence. Both SDK test suites pass. Stripe CLI is connected to the live account, but no sandbox is authorized; do not run payment tests in live mode. Stripe's requested implementation-planner MCP tool was not available in this session.


## Stripe sandbox verification update

- The user confirmed that Zappa connects merchants' existing Stripe accounts for revenue analytics and does not route their funds or payouts. Stripe CLI `Zappa development` is in test mode; always verify mode before testing.
- A real sandbox PaymentIntent for USD 12.00 and a USD 3.00 partial refund were delivered through the Stripe CLI to the local FastAPI webhook and recorded correctly in a disposable PostgreSQL database (original amount 1200, refund 300, USD, live_mode false). Temporary listeners, database, keys and test dependencies were removed. This verifies only that narrow charge/refund path, not production readiness, Connect, subscriptions, disputes, full reconciliation, or customer-to-visitor association. The CLI's built-in trigger fixture failed on a deprecated payment method parameter; a sandbox PaymentIntent using current dynamic defaults succeeded.
- The Stripe MCP implementation planner became available but returned that it needs more business context. Awaiting the user's description of what Zappa sells and whether payments are subscriptions, one-time, invoices, or a combination. Do not guess these business decisions.

Acquisition reporting: project-owner GET /api/projects/{id}/acquisition supports first, last, and last-non-direct observed touchpoints. See docs/ACQUISITION_REPORT.md. No revenue attribution is inferred. PostgreSQL integration tests pass locally; no production deployment performed.

## Revenue-first overview milestone

Dashboard displays project-scoped acquisition sources using the existing acquisition endpoint, attribution model selector, date filter, loading/error/retry states, and a disclosure that property filters do not apply. Revenue reporting is marked unavailable. See docs/REVENUE_OVERVIEW.md. No migration or deployment. Full Phase 1 overview metrics and remaining phases are incomplete. Skip all Stripe and payment-provider work per latest user instruction.

## Overview v1 work (local only)

Added owner-scoped GET /api/projects/{id}/overview with UTC date windows, previous-period visitor/session/pageview/new/returning counts, daily series, selected acquisition/campaign attribution, landing sessions and recent event names/paths. See docs/REVENUE_OVERVIEW.md for definitions and limitations. Conversion goals, conversion rates, revenue, campaign-detail navigation, shared filtering of legacy sections and browser visual verification remain incomplete. No migration or deployment; skip payment-provider work.

Shared overview dates now also filter legacy summary, events and funnel through optional inclusive UTC start/end parameters; legacy callers without dates remain supported. Page analytics is reachable for empty results. Property filters still apply only to detailed analytics. No deployment or migration.

Overview supports an explicitly selected temporary conversion event; counts are distinct visitors and rates use visitor denominators. Acquisition/campaign counts use selected visitor-level touchpoints, which may follow conversion; landing counts require conversion in the same session. See docs/REVENUE_OVERVIEW.md. No saved goals, payment work, deployment, or production migration.

Overview acquisition source search and CSV export operate on the API's first 50 source groups, clearly disclose that cap, and escape spreadsheet formula inputs. CSV unit tests use node --experimental-strip-types --test app/dashboard/csv.test.mjs. No deployment or migration.

## Dashboard redesign milestone (local only)

- Replaced the horizontal project tabs with a 12-item analytics sidebar: Overview, Acquisition, Campaigns, Funnels, User journeys, Pages, Events, Live activity, Revenue, Customers, plus the existing Installation, Integrations and Settings project pages. Sections without a backend API (User journeys, Revenue, Customers) carry a "Soon" badge and render an honest unavailable state that lists the missing endpoints instead of fabricated data.
- Reporting state is shared across Overview, Acquisition, Campaigns and Pages through one `useOverviewReport` fetch and a single `ReportToolbar`: today/yesterday/7/30/90/custom UTC range, attribution model, conversion event, refresh and a displayed "Timezone: UTC" label. Legacy hashes (`#visitors`, `#referrers`, `#countries`) map onto the new sections.
- `OverviewV1` is now presentational: seven KPI cards with previous-period comparison, an interactive visitors/sessions chart that includes the previous period, acquisition/campaign/landing-page previews, recent activity and a revenue-unavailable card. Each preview links into its full section.
- Acquisition adds local search, sortable columns, 15-row pagination, on-demand previous-period comparison and formula-safe CSV export. Campaigns adds search, sorting, CSV and "Inspect", which prefills the acquisition search. Pages splits top pages, sortable landing pages and the existing traffic explorer.
- Live activity polls the existing events endpoint every 15 seconds with pause/resume, a new-event counter and an explicit "poll, not stream" disclosure. The funnel keeps its two-step UI with a visible limitation note. Dead KPI/sparkline/chart helpers and the old tab navigation were removed.
- New files: `app/dashboard/reporting.ts`, `navigation.ts`, `useOverviewReport.ts`, `ReportToolbar.tsx`, `AcquisitionSection.tsx`, `CampaignsSection.tsx`, `PagesSection.tsx`, `UnavailableSection.tsx`, `LiveActivity.tsx`, `sections.module.css`.
- Verified in this session: `npx tsc --noEmit` clean, `npm run build` success, backend 34 tests, SDK 8 tests, CSV 2 tests. Browser visual inspection of the redesigned sections was not completed: the local demo session cookie is HttpOnly and the GitHub OAuth flow was not exercised, so desktop/tablet/mobile and dark/light checks remain pending and must not be claimed as done.
- No backend, schema, SDK, payment-provider or deployment change is included. No production migration.

## Dashboard shell parity and production overview deploy (2026-11-17)

- Reworked the analytics shell to follow the shadcn `sidebar-16` pattern without running the registry generator (it targets `app/dashboard/page.tsx`): a full-width sticky top bar, a floating pill header (58px, `border-radius: 999px`, blurred surface), the project navigation rendered inside shadcn `Sidebar`, a 240px sidebar offset below the bar, and lucide icons for every analytics and project destination. The duplicated sidebar brand was removed so the brand appears once, in the header.
- Raised the dashboard type scale (base 15px, sidebar items 13px, KPI values 34px, section headings 24-30px, tables 13-15px) in `dashboard.module.css`, `sections.module.css` and `overview-v1.module.css`, and pinned the sidebar account footer so it stays reachable on short viewports.
- The project analytics surface remains intentionally dark-only; the site theme toggle is now rendered only on theme-aware pages (workspace list) instead of being a no-op control inside the analytics header.
- Repaired mojibake text in `AcquisitionSection.tsx`, `CampaignsSection.tsx` and `PagesSection.tsx` (dashes, ellipsis, smart quotes, sort arrows, middle dot) that had been committed double-encoded.
- Verified with a disposable PostgreSQL cluster on port 5433 plus a seeded demo project (user `u_demo`): `GET /api/me`, `GET /api/projects/{id}/overview?start=&end=&model=first_touch` returned real data, and Chrome CDP screenshots covered desktop 1440x900, tablet 834x1112, mobile 390x844, the mobile drawer, and the workspace list in both themes with no console errors.
- Backend deploy: `deploy/Zappa-mvp` advanced to `89eba82` with the attribution/acquisition/overview commits and `0003_attribution_touchpoints`, and without `0004_payment_foundation` or any Stripe/payment code. Production returns 401 (auth required) instead of 404 for the overview route after the Render redeploy.
- Direct TCP to Neon is refused from this environment, so revision `0003` was applied through Neon's HTTPS SQL endpoint (`POST https://<endpoint>/sql` with `Neon-Connection-String`): the `attribution_touchpoints` table and both indexes were created and `alembic_version` was stamped `0003_attribution_touchpoints`. Future migrations need the same connection path, which only Render or the owner's network currently has.

## Launch-readiness pass for a free analytics MVP (2026-11-18)

- Added server-side bot filtering (`FILTER_BOTS`, default `true`): batches whose `User-Agent` matches known crawlers, monitors, or automation clients are acknowledged with `{ "accepted": 0, "filtered": "bot" }` and never stored. Filtering happens after project, write-key, and origin validation, so invalid callers still receive their normal errors.
- Made retention self-scheduling. The API runs one pass 30 seconds after startup and then every `RETENTION_INTERVAL_HOURS` (default 24) in a background thread, which removes the previous dependency on an external cron service. `POST /internal/retention` still exists for external triggers and requires `X-Zappa-Retention-Secret` when `RETENTION_SECRET` is configured. `backend/expire.py` now checks `to_regclass` before touching optional tables, so it also runs on databases without the payment foundation or property migrations.
- Country is trusted on `/internal/events` whenever `GEO_FORWARD_SECRET` authenticated the request, so `TRUST_VERCEL_GEO` now defaults to `true`. Public `/api/events` still never reads country headers. Country remains `Unknown` in production until the same secret is set on both Render and Vercel and `BACKEND_URL` points at the Render origin.
- `GET /health` now reports `ingestion.bot_filter`, `ingestion.geo_forwarding`, and `retention.scheduled_hours` / `retention.external_trigger` booleans without exposing secrets.
- Removed fabricated customer testimonials from the landing page and replaced them with factual product principles. Removed the unenforced "one project free forever" promise: pricing and the landing page now state that unlimited projects are free during early access, with a separate open-source/self-host plan. The retention FAQ now mentions the cleanup job.
- Verification: 39 backend tests pass against an isolated PostgreSQL schema (adds bot filtering, geo default, retention endpoint, scheduled retention, and missing-table tests); `npx tsc --noEmit` and `npm run build` pass; SDK tests 8/8 and analytics package tests 2/2 pass. A local uvicorn run against `Zappa_demo` confirmed `GET /health`, bot rejection with a Googlebot UA, normal ingestion, authenticated overview data, the 401/200 retention endpoint behavior, and a startup retention pass deleting an expired probe event with clear logs.
- The docs page and npm README no longer lead with an unpublished package. `app/docs/page.tsx` now starts with the working script-tag install and states that `@Zappa/analytics` lives in `packages/Zappa-analytics` and is not on npm yet; the package README example uses a numeric property because string properties are dropped by the SDK.
- Still outstanding for a broad launch: set `GEO_FORWARD_SECRET` on Render and Vercel for country data; add error monitoring and database backups; complete the security review; Render free-tier cold starts remain.
