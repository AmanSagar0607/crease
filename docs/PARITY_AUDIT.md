# Parity audit

Audit date: 2026-11-16. Scope: close the table-stakes gap with Cloudflare Web Analytics and Vercel Analytics. This audit reflects the actual working tree on `deploy/Zappa-mvp` at commit `50d8191`.

## Capability table

| Capability | Status | Evidence | Notes |
| --- | --- | --- | --- |
| One-line install | Partial | `README.md:55-63`; `packages/Zappa-analytics/next.js:5-10` | The Next.js component is one line, but it requires a project write key and consent-gated startup. The npm package is not published. |
| Pageviews and top pages | Has | `sdk/Zappa.js:54-61`; `backend/main.py:638`, `backend/main.py:649`; `app/dashboard/DashboardView.tsx:1333-1340` | Pageviews are sent on initial load and History API transitions; top pages come from the summary breakdown. |
| Referrers and UTM campaigns | Partial | `sdk/Zappa.js:46-47`, `sdk/Zappa.js:57-60`; `backend/main.py:575`; `backend/main.py:649` | Referrer hostnames are captured and shown, but there is no UTM capture, no campaign breakdown, and normalization is only a lowercase/regex check. SPA transitions set the referrer to the site's own hostname. |
| Country, device, browser, OS | Partial | `backend/main.py:572-574`; `backend/main.py:649`; `app/dashboard/DashboardView.tsx:1349-1363` | Country is available only with trusted Vercel headers and is `Unknown` otherwise. Device is a naive `mobile`/`desktop` string. Browser and OS are not stored or shown. |
| Real-time visitors | Lacks | No `realtime` route in `backend/main.py`; no five-minute query in `backend/main.py:595-649` | No last-five-minutes endpoint, dashboard view, or supporting index. |
| Core Web Vitals | Lacks | No `web-vitals` or `PerformanceObserver` use in `sdk/Zappa.js` or `packages/Zappa-analytics/index.js` | LCP, INP, and CLS are not collected, stored, or displayed. |
| Trusted data writes | Has | `backend/main.py:69-70`, `backend/main.py:411-417`, `backend/main.py:549-576`; `sdk/Zappa.js:33`, `sdk/Zappa.js:70` | Per-project write keys are hashed at rest, required on ingestion, rotatable, and checked against the project. The key is public client code, so it scopes writes but cannot make public events unforgeable. |
| Custom events | Has | `sdk/Zappa.js:38-53`; `backend/main.py:506-593`; `backend/main.py:651-697`; `app/dashboard/DashboardView.tsx:1140-1163` | Named events, numeric/boolean properties, a property registry, filters, and a recent-event list exist. String, null, and array properties are not indexed or filterable. |
| Funnels and retention | Has | `backend/main.py:699-723`; `backend/expire.py:1-57`; `app/dashboard/DashboardView.tsx:1367-1450` | A two-step ordered-session funnel exists. Retention deletes events, indexed properties, and session summaries. The job is runnable but no scheduler is configured in the repository. |

## Baseline test results

Commands run on 2026-11-16:

```powershell
node --test sdk/Zappa.test.cjs
cd backend
$env:TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:5433/Zappa_test'
python -m unittest test_api
```

| Command | Result |
| --- | --- |
| `node --test sdk/Zappa.test.cjs` | 5 tests pass |
| `python -m unittest test_api` | 29 tests pass |

SDK gzip size before this phase: `sdk/Zappa.js` 2,020 bytes; `packages/Zappa-analytics/index.js` 1,918 bytes (raw 5,772 and 5,228 bytes).

## Problems found

1. **Core Web Vitals are missing.** There is no LCP, INP, or CLS collection, no storage convention, and no dashboard view.
2. **UTM campaigns are missing.** The SDK sends only a referrer hostname, and the backend has no campaign columns or breakdown.
3. **Referrer normalization is weak.** The backend lowercases and regex-checks a hostname but does not strip `www.`, ports, or the project's own hostname. SPA route changes use the site's own hostname as the referrer, which pollutes the referrer breakdown.
4. **Browser and OS are not reported.** Device is inferred with a substring check for `mobile`, so tablets, bots, and browsers are indistinguishable.
5. **Real-time visitors are missing.** There is no five-minute active-visitor query and no index dedicated to it.
6. **Custom properties are limited to numeric and boolean values.** Strings, nulls, and arrays are dropped by both SDKs and rejected by the collector. This is acceptable for the parity items but limits developer analytics.
7. **Retention is not scheduled.** The job exists and is safe to retry, but nothing runs it on Render.
8. **The npm package is not published.** The one-line install path is therefore not usable from npm yet.

## Blocking assessment

- **Trusted writes are already present.** No work is required in Step 2 for write keys; this item is resolved and should remain a launch gate.
- **Core Web Vitals, UTM campaigns, browser/OS, and real-time visitors are implementable without new infrastructure.** They reuse PostgreSQL and the existing event pipeline.
- **Country reporting remains dependent on deployment topology.** The Vercel-to-Render path does not overwrite `X-Vercel-IP-Country`, so country stays `Unknown` until a trusted proxy or edge header source is configured. This audit does not claim country coverage.

## Step 2 order

1. Core Web Vitals.
2. Referrers and UTM campaigns.
3. Device, browser, and OS.
4. Real-time visitors.
5. Trusted writes (already done; verify only).
