# Crease improvement audit

Date: 2026-11-13
Branch audited: `deploy/crease-mvp` (working tree included the cat-mascot wiring and a new `recharts` dependency)
Scope: README claims, backend ingestion, dashboard, SDK, and current test coverage.

## Baseline test results (before any change)

### `node --test sdk/crease.test.cjs`

```
# tests 2
# pass 2
# fail 0
```

Both SDK tests pass: consent/activation gating, query-string stripping, sensitive-property rejection, and opt-out cleanup.

### `python -m unittest test_api -v`

```
Ran 16 tests in 0.333s
FAILED (failures=1)
```

15 of 16 pass. The failing test is pre-existing and environment-dependent:

```
FAIL: test_github_oauth_creates_session_and_rejects_reused_state
AssertionError: 'https://crease-bice.vercel.app/api/auth/callback'
                != 'http://localhost:3000/api/auth/callback'
```

`backend/.env` sets `PUBLIC_API_URL` to the production origin, so the test's hard-coded localhost expectation fails. The test passes only when that variable is unset. This is a test-isolation defect, not a product regression.

No frontend unit tests, no type-check script, and no CI workflow exist.

## README limitations: confirmed, contradicted, or unverifiable

| README claim | Verdict | Evidence |
| --- | --- | --- |
| Country is unknown by default; `TRUST_VERCEL_GEO` must only be set behind a trusted proxy | Confirmed | `backend/main.py` reads `x-vercel-ip-country` only when `TRUST_VERCEL_GEO` is true; otherwise stores `NULL`. |
| Sessions follow tab storage rather than an inactivity window | Confirmed for `sdk/crease.js`; contradicted for the npm package | The browser SDK stores `crease_session` in `sessionStorage`. `packages/crease-analytics/index.js` stores it in `localStorage`, so it survives across tabs and is not a tab session either. |
| Retention runs when the setting changes and can be enforced with `python backend/expire.py` | Confirmed | `PATCH /api/projects/{id}/retention` deletes inline; `backend/expire.py` is a one-shot script with no scheduler. |
| The in-memory rate limiter is per-process | Confirmed | `hits = defaultdict(deque)` in `backend/main.py`, keyed only by client IP, 120 requests/minute. No per-project limit. |
| Durable migrations are outstanding; tables are created on startup | Confirmed | `setup()` executes `CREATE TABLE IF NOT EXISTS` at import time. No Alembic directory or migration history. |
| Shared abuse protection is outstanding | Confirmed | Same in-process limiter; no shared counter or store. |
| Security review is outstanding | Not verifiable | No review artifact or threat model in the repo. |
| Vercel integration needs end-to-end verification | Partially confirmed | Endpoints and tests exist, but Vercel calls are mocked; `NEXT_AGENT_CONTEXT.md` records project discovery returning no projects. |
| OAuth and production deployment verification remain outstanding | Contradicted by `NEXT_AGENT_CONTEXT.md`, not verifiable from code | The handoff says Render and Vercel were confirmed live; the local test suite cannot verify production. |
| Custom event properties are stored but not filterable | Confirmed | `properties` is a JSON `TEXT` column; there is no key index and no query endpoint. |
| Public analytics collection can be forged | Confirmed | `POST /api/events` authenticates only `projectId` plus an `Origin` header matching the project domain. There is no write key. |
| Domains are not ownership-verified | Confirmed | `create_project` validates hostname syntax only; no DNS/meta token exists. |
| Backups need a deletion and retention policy | Not verifiable | No backup code or documented policy in the repo. |
| `sdk/README.md`: “No ingestion endpoint or dashboard is implemented yet” | Contradicted | Both the collector and dashboard exist. This README is stale and should be updated. |
| PRD: “Verify installation by receiving a valid event” | Partial | `github-install/status` returns `event_count` and `latest_event`, but the Installation tab never polls and never shows a Connected/Waiting state. |
| `public/crease.js` matches the documented SDK | Confirmed | `public/crease.js` is byte-identical to `sdk/crease.js`. |

## Dashboard features the README does not mention

- KPI cards for visitors, page views, sessions, and events, each with previous-period delta and a sparkline.
- 7/30/90-day range switcher, manual refresh, and “Updated …” timestamp.
- Traffic-over-time chart with visitors and page-view series.
- Breakdown cards for top pages, referrers, devices, and countries.
- Per-project tabs: Analytics, Installation, Integrations, Settings.
- Installation tab already renders the exact snippet with the project ID filled in.
- Settings tab: retention control (1–90 days), project deletion, and project metadata.
- GitHub App flow: repository connection, installation PR creation, status checks, and event-count/latest-event reporting.
- Vercel integration: project linking, Git settings, and deploy hooks.
- Workspace project list with 7-day visitor/event counts.
- Dark/light theme, standalone pricing page, and (uncommitted at audit time) the living-cat mascot.

## Coverage gaps relevant to this plan

Backend has no tests for: event write authentication, domain verification, rate-limit sharing, retention as a job, inactivity-based sessions, geolocation spoofing, custom-property filtering, events listing, or funnels. Ingestion validation beyond origin/dedup is untested.

SDK has no tests for batching/retry, SPA navigation beyond `popstate`, the consent gate in the npm package, or `packages/crease-analytics` at all.

Frontend has no automated tests for the dashboard, empty states, error states, or setup verification.

## Delivery blockers

- **GitHub PR creation is blocked on this machine.** `gh` is not installed, so branches and commits can be produced but PRs cannot be opened automatically. Each item will be committed on its own branch with the PR description in the commit body.
- **PostgreSQL verification** requires an ephemeral container. Docker 28.1.1 and `psql` are available, so this can be done locally.
- **The pre-existing OAuth test failure** is caused by `backend/.env`; fixes must not depend on that file being absent.

## Planned order

Step 2 backend items in the requested order, then Step 3 dashboard items. Each item gets its own branch and commit. If an item cannot be completed, the blocker is appended to this file instead of being worked around.
