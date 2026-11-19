# Improvement audit

Audit and implementation record for the Zappa backend and dashboard. The audit started from the working tree on 2026-11-13; all implementation work below is on `deploy/Zappa-mvp` as of 2026-11-16.

## Scope and method

- Reviewed `backend/main.py`, `backend/expire.py`, the Alembic migration directory, `backend/test_api.py`, the dashboard under `app/dashboard/`, the browser SDK (`sdk/Zappa.js`, `public/Zappa.js`), and the npm client (`packages/Zappa-analytics/index.js`).
- Ran the backend suite against a local PostgreSQL instance (port 5433) because the API intentionally rejects SQLite, the SDK suite with `node --test`, and the dashboard with `npx tsc --noEmit` and `npm run build`.
- Verified the API and dashboard against a seeded local database, including property filters, the funnel, retention cleanup, and the migration backfill.
- Kept the consent-gated design. No cookies, fingerprinting, or session replay were added. The SDK sources remain byte-identical.

## Baseline findings

These describe the repository before the implementation work:

- Ingestion accepted public project IDs without a write credential, so anyone who knew a project ID could inject events.
- Project creation required authentication, but no ownership proof was required for the project domain.
- Rate limiting was database-backed in the inspected code, but the limits were per-process defaults and lacked a durable cross-instance test.
- The schema was created and altered on API startup; there were no Alembic migrations.
- Retention was applied when settings changed and by the runnable `backend/expire.py`, with no scheduler in the repository and no deletion logging.
- Sessions trusted the SDK's `sessionId`, which is tab-scoped and client-controlled.
- Country came from `X-Vercel-IP-Country` without a documented trust boundary.
- Custom event properties were stored as JSON text and could not be filtered or listed.
- The dashboard had 7/30/90-day metrics, charts, period comparisons, and page/device/country/referrer breakdowns. It had no first-event setup polling, no property filters, no funnel, and no explicit unverified/empty/error states.
- The README claimed custom properties were not filterable and that only root `index.html` was supported for GitHub installation; the latter was already incomplete because Next.js App Router layouts were supported.

## Implemented items

Each item was developed on its own branch and merged locally with `--no-ff`. `gh` is not installed and no GitHub connector was available, so no pull requests were opened; the branch, commit, and PR body are recorded here instead. Every commit body lists the change, tests, and commands.

### Backend

1. **Authenticated event writes** — `feat/event-write-keys`, commit `7f7e3e1`, merge `c4f9ed1`.
   - Adds a hashed per-project write key, requires `X-Zappa-Key` on ingestion, supports rotation, and keeps the public project ID non-secret.
   - Tests cover missing, invalid, rotated, and cross-project keys.
   - Risk: a browser-embedded write key is visible to visitors and cannot prevent forged events from that origin; it only scopes writes to a project.

2. **Domain ownership verification** — `feat/domain-verification`, commit `fe78107`, merge `c5514e1`.
   - Requires a DNS TXT record or root meta tag before ingestion, persists verification, and exposes a verification endpoint and dashboard panel.
   - Tests cover meta-tag and DNS verification, unverified rejection, and ownership isolation.
   - Risk: verification proves control at check time, not ongoing control; a domain can change hands later.

3. **Durable rate limiting** — commit `c938fdc` (applied directly to the base branch).
   - Uses shared PostgreSQL fixed-window counters with per-IP and per-project limits and documented defaults (`RATE_LIMIT_IP_PER_MINUTE=120`, `RATE_LIMIT_PROJECT_PER_MINUTE=600`).
   - Tests cover shared counters and limit responses.
   - Risk: fixed windows allow bursts at window boundaries; counters add a database write per request.

4. **Alembic migrations** — `feat/alembic-migrations`, commit `ec9717b`, merge `fdcd4ae`.
   - Adds `0001_baseline`, removes startup schema creation, and makes tests run `alembic upgrade head`.
   - Verified on an empty SQLite file and a fresh PostgreSQL database.
   - Risk: the existing production database must be stamped with `alembic stamp 0001_baseline` before `alembic upgrade head`; this has not been run against production.

5. **Scheduled retention** — `feat/scheduled-retention`, commit `fd29dca`, merge `8483c50`.
   - Moves deletion into `backend/expire.py`, logs per-project deletion counts, and stops deleting inline from the retention settings endpoint.
   - Tests cover old-event deletion and recent-event retention.
   - Risk: no scheduler is configured in this repository; production must run the job (for example, a cron or platform scheduled task).

6. **Server-side inactivity sessions** — `feat/inactivity-sessions`, commit `38a727e`, merge `d7e79dc`.
   - `resolve_session()` assigns sessions server-side: a new session starts after 30 minutes idle or at a UTC day boundary; the client `sessionId` is ignored.
   - Tests cover 29/31-minute gaps and the new-day boundary.
   - Risk: the day boundary is UTC, which may not match a customer's local reporting day. `SESSION_IDLE_MINUTES` defaults to `30`.

7. **Geolocation trust** — `feat/geolocation-trust`, commit `ad20b7c`, merge `21dd33d`.
   - Country is read from `X-Vercel-IP-Country` only when `TRUST_VERCEL_GEO=true`, and is otherwise stored as unknown.
   - Adds a spoofed-header test and documents the trusted-proxy requirement.
   - Risk: enabling trust without a proxy that overwrites the header allows spoofing.

8. **Filterable custom properties** — `feat/property-filters`, commit `e6b6a5d`, merge `46fa46d`.
   - Adds `0002_property_filters` with indexed `event_properties` and a per-project `project_property_keys` registry. Ingestion indexes numeric and boolean properties and maintains the registry.
   - Adds `GET /api/projects/{id}/properties`, `GET /api/projects/{id}/events`, and property/value filters on the summary endpoint.
   - Filters reject unknown keys and partial `property`/`value` input. Numeric filters match equivalent values (`3` matches `3.0`). Project deletion and retention remove indexed rows.
   - PostgreSQL backfills existing `events.properties` during the migration; SQLite applies the schema without the backfill.
   - Tests cover registry types (`number`, `boolean`, `mixed`), filtering, validation, ownership, deletion cleanup, and retention cleanup.
   - Risk: only numeric and boolean properties are indexed; string properties remain in JSON and are not filterable. Historical backfill depends on valid JSON in the text column.

### Dashboard

1. **Setup verification polling** — `feat/dashboard-setup-polling`, commit `3f0cd23`, merge `3d82950`.
   - The installation tab polls `/api/projects` every 10 seconds while the selected project has no events, shows a waiting/verified panel with the last-check time, and offers a manual check.
   - Checks: `npx tsc --noEmit`.
   - Risk: polling stops once an event exists and does not continue to confirm ongoing delivery.

2. **Inactivity-aware session labels** — `feat/dashboard-session-labels`, commit `24d76da`, merge `d6b9daf`.
   - Adds the 30-minute/UTC-day definition to the overview subtitle, the Sessions KPI hint, and project details.
   - Checks: `npx tsc --noEmit`.

3. **Custom property filters** — `feat/dashboard-property-filters`, commit `462fc95`, merge `4b88a3f`.
   - Loads the property registry, adds key/value selectors that filter the summary and the newest 25 events, shows property chips, and makes refresh reload summary, properties, and events together.
   - Unknown or partial filters are not sent; clearing restores the unfiltered view.
   - Checks: `npx tsc --noEmit`, `npm run build`.

4. **Basic funnel view** — `feat/dashboard-funnel`, commit `b6dfadc`, merge `fd177ec`.
   - Adds `GET /api/projects/{id}/funnel` (ordered sessions, first event then second at the same or a later timestamp) and `event_names` to the summary response.
   - The dashboard gains a Funnel section with two event selectors, step counts, conversion, and empty/loading states.
   - Tests cover ordered and out-of-order sessions and `event_names`; 29 backend tests pass.
   - Checks: `npx tsc --noEmit`, `npm run build`.
   - Risk: only two steps are supported and funnels ignore property filters.

5. **Empty, error, and unverified states** — `feat/dashboard-empty-states`, commit `bc0a1f4`, merge `b9104c0`.
   - Shows a domain-unverified warning with a setup action, an inline analytics error with Retry, and a first-event empty state that adapts to active filters. Empty projects hide zeroed charts, and project cards and the meta row show verification status.
   - Checks: `npx tsc --noEmit`, `npm run build`.

## Test and verification results

| Command | Result |
| --- | --- |
| `cd backend; python -m unittest test_api` with `TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5433/Zappa_test` | 29 tests pass |
| `node --test sdk/Zappa.test.cjs` | 5 tests pass |
| `npx tsc --noEmit` | passes |
| `npm run build` | passes |
| `alembic upgrade head` on a fresh SQLite file | passes |
| `alembic upgrade head` on a fresh PostgreSQL database | passes |
| PostgreSQL backfill of pre-existing `events.properties` | typed rows and registry entries produced |
| Local demo database upgrade (`stamp 0001_baseline` then `upgrade head`) | reaches `0002_property_filters` |
| Seeded API checks (`/properties`, `/summary` with a filter, `/funnel`) | correct counts and shapes |
| Browser dashboard check | Overview, property filter, Funnel, and Events render; no console errors |

## Summary table

| # | Item | Status | Tests added | Open risks |
| --- | --- | --- | --- | --- |
| B1 | Authenticated event writes | Done | Missing/invalid/rotated/cross-project key cases | Browser key is public; does not stop forged events |
| B2 | Domain ownership verification | Done | Meta and DNS verification, unverified rejection | Proves control only at check time |
| B3 | Durable rate limiting | Done | Shared counter and limit responses | Fixed-window bursts; one database write per request |
| B4 | Alembic migrations | Done | Empty SQLite and fresh PostgreSQL upgrades | Production needs `stamp 0001_baseline` first |
| B5 | Scheduled retention | Done | Old deleted, recent kept, deletion logging | No scheduler is configured in the repo |
| B6 | Server-side inactivity sessions | Done | 29/31-minute gaps and new-day boundary | UTC day boundary; idle default is 30 minutes |
| B7 | Geolocation trust | Done | Spoofed header ignored by default | Trust requires a proxy that overwrites the header |
| B8 | Filterable custom properties | Done | Registry types, filters, validation, cleanup | Only numeric/boolean indexed; backfill needs valid JSON |
| D1 | Setup verification polling | Done | Manual browser check; typecheck | Stops after the first event |
| D2 | Inactivity-aware session labels | Done | Manual browser check; typecheck | Copy must stay in sync with `SESSION_IDLE_MINUTES` |
| D3 | Custom property filters | Done | Manual browser check; build | Only observed keys/values are offered; 25-event cap |
| D4 | Basic funnel view | Done | Ordered/out-of-order sessions, `event_names` | Two steps only; ignores property filters |
| D5 | Empty/error/unverified states | Done | Manual browser check; build | None known |

## Open risks and follow-ups

- **Production rollout is pending.** The Alembic baseline, `0002_property_filters`, and the retention job have not been applied or scheduled against production. Stamp the existing production database with `alembic stamp 0001_baseline` before `alembic upgrade head`.
- **PRs were not opened.** `gh` is unavailable in this environment, so the work exists as local branches and commits on `deploy/Zappa-mvp`. Push the branches and open PRs manually.
- **Geolocation depends on deployment topology.** `TRUST_VERCEL_GEO=true` is safe only when every request passes through a Vercel deployment that overwrites `X-Vercel-IP-Country`.
- **Session boundaries are UTC.** Customers who need local-day reporting will see sessions split at UTC midnight.
- **Funnels are minimal.** Two ordered steps, no property filters, and no time-to-convert breakdown.
- **Property filtering is partial.** Only numeric and boolean values are indexed; string properties and non-JSON historical rows are not filterable.
- **Retention needs an external scheduler.** The repository provides the job and logging but not the schedule.
- **Rate limiting is fixed-window.** Boundary bursts are possible, and the counters add database load.
- **The browser write key is not a secret.** It scopes writes to a project but cannot make public browser events unforgeable; origin checks are only a deterrent.

## Local MVP continuation — 2026-11-18

- Added project-scoped event-count goals using the existing FastAPI/Postgres service: `GET /goal-events`, `GET /goals`, `POST /goals`, `PATCH /goals/{goal_id}`, and `DELETE /goals/{goal_id}` under `/api/projects/{project_id}`. Every route checks project ownership; event names must already exist for that project; goal targets are positive bounded integers; duplicate names return `409`.
- Added Alembic revision `0005_project_goals`. Progress counts observed occurrences of the selected event inside the requested UTC date window and is capped at the target for display. Revenue is not inferred.
- Added the Goals dashboard section with create/edit/delete, loading/error/empty states, responsive overflow handling, and observed-event choices.
- Removed hardcoded sample analytics values and charts from the landing and sign-in previews; they now explain that project values only appear after tracking is verified.
- The linked Neon integration is connected, but its reported schema contains only Neon Auth tables. It does not match the existing Zappa API database, so this change uses the established API database boundary and does not create parallel analytics tables in the linked integration.
- Verification at this checkpoint: `npx tsc --noEmit`, Python syntax compilation, and `git diff --check` passed. Backend integration tests could not run because this workspace has neither `TEST_DATABASE_URL` nor a local PostgreSQL listener. Revision `0005_project_goals` is source only; no production migration, push, or deploy was performed.
- Continued funnel work: added `GET /api/projects/{id}/funnel/multi` for two to five ordered event steps per session. The legacy two-step endpoint remains intact. Each step counts distinct sessions that completed the preceding sequence; query values are parameterized and constrained to 2–5 event names. Saved funnels, step-level property filters, and funnel tests against PostgreSQL remain pending.
