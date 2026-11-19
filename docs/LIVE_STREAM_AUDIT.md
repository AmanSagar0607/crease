# Live analytics stream audit

## Existing behavior

- The browser SDK batches analytics events and sends them to `POST /api/events`; the API validates the project write key, verified domain, and request origin before storing events in PostgreSQL.
- Historical activity is read from the owner-scoped `GET /api/projects/{project_id}/events` endpoint.
- The Live Activity dashboard previously polled that historical endpoint every 15 seconds. The overview is loaded on demand; setup status has a separate 10-second check.
- The API is a persistent FastAPI service backed by Postgres. There is no existing Redis pub/sub, Supabase Realtime subscription, SSE stream, or WebSocket event broadcaster. An in-process emitter would not work across worker processes/restarts.

## Streaming decision

Use Server-Sent Events (SSE) from the persistent FastAPI API, backed by indexed Postgres cursor polling every two seconds. SSE fits the one-way event feed and reuses the existing HTTP auth and project ownership model. It introduces no broker or vendor. The database cursor is monotonic at ingestion time, so late-arriving events and client timestamps cannot reorder or hide events. Historical queries remain separate.

The stream is `GET /api/events/stream?projectId=...&after=...`; it accepts the standard `Last-Event-ID` header as a reconnect cursor too. The dashboard uses the query parameter because browser `EventSource` cannot set a custom request header. New connections receive a `ready` event with a current baseline, then only events inserted after that cursor. Reconnects resume from the last received sequence. Heartbeats run every 15 seconds, results are capped at 100 per database poll, and each stream closes after 50 minutes so clients reconnect cleanly. Disconnects stop database polling. There are no unbounded per-connection queues.

The URL is deliberately `/api/events/stream`, rather than `GET /api/events`: the app has an exact Next route at `/api/events` for POST ingestion. The existing catchall external rewrite sends the stream subpath to the persistent API, avoiding a long-lived Vercel Route Handler. The Next proxy still requires a Clerk session for `/api/*`, and FastAPI independently authenticates the session and checks project ownership before opening the stream.

## Operations and limits

- No new environment variables or services are needed. The event cursor migration is required before the new stream runs.
- A database-backed poll costs one indexed query per connected viewer every two seconds. This is simple and horizontally safe at current scale, but a very large number of concurrent dashboards should move to Postgres notifications or a managed pub/sub broker after load measurements.
- Server-Sent Events are one-way. Use WebSockets only if the product later requires bidirectional, interactive sessions. Supabase Realtime is not in the current storage path; adopting it would add a second data/control plane.
- The browser retries with exponential backoff capped at 30 seconds. Pausing closes the connection. Historical data and date range stay separate; the live list drops events outside the selected range.
- Render Free services can sleep while idle and are not an availability guarantee; users may see a delayed first reconnect after an idle period. Stream lifetime is intentionally below Render's documented 100-minute response limit.

## DataFast endpoint note

`GET https://data.fa.st/api/user/websites/<id>/has-events` returning HTTP 200 is not evidence of a streaming subscription. The public DataFast API docs distinguish realtime visitor data from their other API families; the supplied status check does not establish event transport behavior. See [DataFast API docs](https://datafa.st/docs/api).

## Write-key rotation

The per-project write key is a public browser credential, not a secret: every installed script must include it. The dashboard can reveal a key only in the browser that generated/stored it. If it is unavailable in another browser, an owner can explicitly rotate and reveal a replacement. Rotation invalidates the previous key immediately, so every deployed installation must be updated.
