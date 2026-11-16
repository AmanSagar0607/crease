# Collector API

The FastAPI service exposes its interactive OpenAPI reference at `/docs` and the OpenAPI schema at `/openapi.json` when the API is running.

## Ingest events

`POST /api/events` accepts a JSON batch of up to 20 events. Send `Content-Type: application/json` and `X-Crease-Key: <project write key>`. The collector checks the write key, verified project domain, allowed origin, payload shape, and event timestamp. The project ID is public and is not an authentication credential.

Each event contains `id`, `name`, `timestamp`, `path`, optional `visitorId`, optional `sessionId`, `referrer`, and numeric or boolean `properties`. Reusing an event ID within one project is idempotent. Event paths exclude query strings and fragments. The SDK sends `schemaVersion: 1`; older clients may omit it. `sessionId` is accepted for compatibility but the collector assigns the authoritative session server-side.

The collector responds with `{ "accepted": n }`, where `n` is the number of newly stored events. It may return 401 for an invalid write key, 403 for an unverified project or rejected origin, 404 for an unknown project, 413 for an oversized request, 422 for an invalid event, or 429 when a configured shared database rate limit is reached. Transient delivery remains best effort; SDKs retry network errors and server/rate-limit responses.

For cross-origin browser requests, the preflight allows `Content-Type` and `X-Crease-Key`. Origin checks reduce accidental cross-site use but do not authenticate a visitor and do not make public browser events unforgeable.

Country is unknown by default. Public `/api/events` never trusts country headers. The Vercel server route forwards a country to `/internal/events` using `GEO_FORWARD_SECRET`; the backend authenticates it and checks ISO 3166-1 alpha-2. See the deployment instructions in the README before enabling `TRUST_VERCEL_GEO`.

## Project APIs

Authenticated project routes require the Crease session cookie and check project ownership server-side. The current routes include project CRUD, `/api/projects/{id}/summary?days=7|30|90`, `/api/projects/{id}/properties`, `/api/projects/{id}/events`, `/api/projects/{id}/funnel?first=&second=&days=7|30|90`, write-key rotation, retention configuration, domain verification, GitHub repository installation, and Vercel integration settings. See the OpenAPI schema for request and response details from the running version.

## Property filters

Ingested numeric and boolean properties are indexed in `event_properties` and each project keeps a declared-key registry in `project_property_keys`. `GET /api/projects/{id}/properties` returns each key with its type (`number`, `boolean`, or `mixed`), first/last seen timestamps, event count, distinct value count, and up to 20 top values.

`GET /api/projects/{id}/events` returns recent events newest-first and accepts `days=7|30|90`, `event`, `path`, `property`, `value`, and `limit` (1-200). `GET /api/projects/{id}/summary` accepts the same `property` and `value` filters and applies them to metrics, series, breakdowns, and average session duration. `property` and `value` must be supplied together, and the key must exist in the project's registry or the API returns 422. Numeric filters match equivalent numeric values (`3` matches `3.0`). Property filters never span projects.

## Funnels

`GET /api/projects/{id}/funnel?first=<event>&second=<event>&days=7|30|90` counts sessions that contain the first event and then the second event at the same or a later timestamp within the range. Both event names are required. The response includes `first_count`, `second_count`, `conversion` (second divided by first, rounded to four decimals), and the selected names and range. A session that performs the second event before the first does not count toward the second step. Summary responses also include `event_names`, a bounded list of event names and counts used to populate the dashboard funnel selectors.

## Session interpretation

The collector assigns sessions server-side from the visitor ID and event time: a new session starts after 30 minutes without an event from that visitor or when the UTC day changes. A client-supplied `sessionId` is ignored for this decision. The collector creates one `analytics_sessions` record per project/session, with earliest and latest received event timestamps, entry and exit paths, and pageview count. Duration is only an approximation of received event time; it is not a guarantee that every event during a visit was delivered. `SESSION_IDLE_MINUTES` defaults to `30`.
