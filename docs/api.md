# Collector API

The FastAPI service exposes its interactive OpenAPI reference at `/docs` and the OpenAPI schema at `/openapi.json` when the API is running.

## Ingest events

`POST /api/events` accepts a JSON batch of up to 20 events. Send `Content-Type: application/json` and `X-Zappa-Key: <project write key>`. The collector checks the write key, verified project domain, allowed origin, payload shape, and event timestamp. The project ID is public and is not an authentication credential.

Each event contains `id`, `name`, `timestamp`, `path`, optional `visitorId`, optional `sessionId`, `referrer`, and numeric or boolean `properties`. Reusing an event ID within one project is idempotent. Event paths exclude query strings and fragments. The SDK sends `schemaVersion: 1`; older clients may omit it. `sessionId` is accepted for compatibility but the collector assigns the authoritative session server-side.

The collector responds with `{ "accepted": n }`, where `n` is the number of newly stored events. It may return 401 for an invalid write key, 403 for an unverified project or rejected origin, 404 for an unknown project, 413 for an oversized request, 422 for an invalid event, or 429 when a configured shared database rate limit is reached. Transient delivery remains best effort; SDKs retry network errors and server/rate-limit responses.

For cross-origin browser requests, the preflight allows `Content-Type` and `X-Zappa-Key`. Origin checks reduce accidental cross-site use but do not authenticate a visitor and do not make public browser events unforgeable.

Country is resolved by the API from the request IP using a local MaxMind GeoLite2 Country database; no country header is read, and the IP itself is not stored. For requests sent through the Vercel app proxy, the proxy forwards the client IP in `X-Zappa-Client-IP` over `/internal/events`, which requires the same `GEO_FORWARD_SECRET` on Vercel and the API. Vercel's standard `X-Forwarded-For` supplies the client IP; the country lookup itself is local and independent of Vercel's country geolocation. Direct `/api/events` requests use the connected client IP when available.

Set `GEOIP_DATABASE_PATH` to the deployed `GeoLite2-Country.mmdb` file. To let the API install and update it automatically, set server-only `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY`; updates run locally on the API host and default to every seven days. MaxMind requires an account and license key to download GeoLite databases; keep the database updated and follow its license/attribution terms. The backend `/health` response reports `ingestion.client_ip_forwarding`, `ingestion.geoip_database`, and `ingestion.geoip_auto_update` so missing setup is visible. If forwarding or the database is unavailable, new event country values remain null. Previously stored null values cannot be reconstructed from events.

Requests whose `User-Agent` matches a known crawler, uptime monitor, or automation client are acknowledged with `{ "accepted": 0, "filtered": "bot" }` and are not stored. Set `FILTER_BOTS=false` only while debugging.

## Retention job

`POST /internal/retention` deletes events, session summaries, touchpoints, event properties, and (when those tables exist) expired payment rows for every project according to its `retention_days`. It requires `X-Zappa-Retention-Secret` to match `RETENTION_SECRET`; when the secret is unset the route returns 401. The response reports `projects`, `events`, and `sessions` totals. The API also runs retention in-process 30 seconds after startup and every `RETENTION_INTERVAL_HOURS` (default 24), which covers hosts without a cron service. Set `RETENTION_INTERVAL_HOURS=0` to disable the loop and schedule `python backend/expire.py` yourself.

## Project APIs

Authenticated project routes require the Zappa session cookie and check project ownership server-side. The current routes include project CRUD, `/api/projects/{id}/summary?days=7|30|90`, `/api/projects/{id}/properties`, `/api/projects/{id}/events`, `/api/projects/{id}/funnel`, `/api/projects/{id}/funnel/multi`, project-scoped goals, write-key rotation, retention configuration, domain verification, GitHub repository installation, and Vercel integration settings. See the OpenAPI schema for request and response details from the running version.

## Property filters

Ingested numeric and boolean properties are indexed in `event_properties` and each project keeps a declared-key registry in `project_property_keys`. `GET /api/projects/{id}/properties` returns each key with its type (`number`, `boolean`, or `mixed`), first/last seen timestamps, event count, distinct value count, and up to 20 top values.

`GET /api/projects/{id}/events` returns recent events newest-first and accepts `days=7|30|90`, `event`, `path`, `property`, `value`, and `limit` (1-200). `GET /api/projects/{id}/summary` accepts the same `property` and `value` filters and applies them to metrics, series, breakdowns, and average session duration. `property` and `value` must be supplied together, and the key must exist in the project's registry or the API returns 422. Numeric filters match equivalent numeric values (`3` matches `3.0`). Property filters never span projects.

## Funnels

`GET /api/projects/{id}/funnel?first=<event>&second=<event>&days=7|30|90` remains available for two-step clients. It counts sessions that contain the first event and then the second at the same or a later timestamp within the range. The response includes `first_count`, `second_count`, `conversion` (second divided by first, rounded to four decimals), and the selected names and range.

`GET /api/projects/{id}/funnel/multi?steps=<event>&steps=<event>[&steps=<event>...]` powers the dashboard and accepts 2–5 repeated `steps` parameters, plus either `days=7|30|90` or both `start` and `end` dates. Each step counts distinct sessions that completed the preceding sequence in timestamp order; counts cannot exceed the prior step. The response includes `steps` entries with `event_name`, `count`, and `conversion_from_previous`, as well as the resolved date range. Event names are parameterized and limited to 64 characters. The session must belong to the requested project. Summary responses also include a bounded `event_names` list for funnel selectors.

## Event goals

`GET /api/projects/{id}/goal-events` lists up to 100 event names already observed for the owned project. Goal definitions use `GET` and `POST /api/projects/{id}/goals`; `PATCH` and `DELETE /api/projects/{id}/goals/{goal_id}` update or remove one definition. Create/update bodies contain `name` (1–80 characters), `event_name` (an event already observed for this project), and positive integer `target_count` (maximum 1,000,000,000). Names are unique per project. Unobserved events and invalid targets return 422; duplicate names return 409.

Goal progress is the raw occurrence count of that event within the selected reporting window—not unique visitors or inferred conversions. The goal list accepts `days=7|30|90` or both `start` and `end` dates, returns each goal with its current count and capped progress ratio, and applies the selected dates in UTC. All goal reads and writes are scoped to the project owner.

## Session interpretation

The collector assigns sessions server-side from the visitor ID and event time: a new session starts after 30 minutes without an event from that visitor or when the UTC day changes. A client-supplied `sessionId` is ignored for this decision. The collector creates one `analytics_sessions` record per project/session, with earliest and latest received event timestamps, entry and exit paths, and pageview count. Duration is only an approximation of received event time; it is not a guarantee that every event during a visit was delivered. `SESSION_IDLE_MINUTES` defaults to `30`.

## Attribution evidence

After consent-enabled initialization, the SDK captures only `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term` on pageviews. Values must be 1–128 ASCII letters, digits, spaces, underscores, hyphens, or periods, beginning with a letter or digit; invalid values are omitted by the SDK and rejected by the API. Do not place email addresses, personal identifiers, credentials, or other sensitive information in campaign parameters or URL paths. Other query parameters and full referrer URLs are not stored. Referrers are reduced to hostnames, and the project's own hostname and its `www` alternative are recorded as direct (no external referrer).

A successfully inserted pageview with a visitor ID records a project-scoped touchpoint containing its server-assigned session, timestamp, path, referrer hostname, and accepted campaign fields. Replayed event IDs cannot create extra touchpoints. Touchpoints follow the associated project's retention and deletion policy. First- and last-touch reporting, a configurable attribution window, customer linking, and revenue attribution are not implemented yet. Old events have no inferred campaign history; missing evidence remains unknown. Browser events and identifiers are untrusted, may be forged, and are not proof of payment. Identity is first-party and project-scoped; this release does not support cross-domain identity.
