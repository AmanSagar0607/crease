# Collector API

The FastAPI service exposes its interactive OpenAPI reference at `/docs` and the OpenAPI schema at `/openapi.json` when the API is running.

## Ingest events

`POST /api/events` accepts a JSON batch of up to 20 events. Send `Content-Type: application/json` and `X-Crease-Key: <project write key>`. The collector checks the write key, verified project domain, allowed origin, payload shape, and event timestamp. The project ID is public and is not an authentication credential.

Each event contains `id`, `name`, `timestamp`, `path`, optional `visitorId`, optional `sessionId`, `referrer`, and numeric or boolean `properties`. Reusing an event ID within one project is idempotent. Event paths exclude query strings and fragments. The SDK sends `schemaVersion: 1`; older clients may omit it.

The collector responds with `{ "accepted": n }`, where `n` is the number of newly stored events. It may return 401 for an invalid write key, 403 for an unverified project or rejected origin, 404 for an unknown project, 413 for an oversized request, 422 for an invalid event, or 429 when a configured shared database rate limit is reached. Transient delivery remains best effort; SDKs retry network errors and server/rate-limit responses.

For cross-origin browser requests, the preflight allows `Content-Type` and `X-Crease-Key`. Origin checks reduce accidental cross-site use but do not authenticate a visitor and do not make public browser events unforgeable.

## Project APIs

Authenticated project routes require the Crease session cookie and check project ownership server-side. The current routes include project CRUD, `/api/projects/{id}/summary?days=7|30|90`, write-key rotation, retention configuration, domain verification, GitHub repository installation, and Vercel integration settings. See the OpenAPI schema for request and response details from the running version.

## Session interpretation

The SDK shares a visitor ID and session ID across tabs. It rotates sessions after 30 minutes of inactivity or 24 hours. The collector creates one `analytics_sessions` record per project/session, with earliest and latest received event timestamps, entry and exit paths, and pageview count. Duration is only an approximation of received event time; it is not a guarantee that every event during a visit was delivered.
