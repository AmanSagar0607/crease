# Production deployment checklist

This checklist records known work before a broad public launch. The tracker and backend accept untrusted public browser events; a public project write key is visible in client code and is not proof that an event is genuine.

## Before deploying schema changes

- [x] Establish reviewed Alembic migrations for PostgreSQL and local SQLite workflows. Baseline is in `backend/migrations`; SQLite is no longer accepted by the API, but the migration was verified on an empty SQLite file.
- [ ] Confirm production migration status and backup recovery plan before the new session queries depend on `analytics_sessions`.
- [x] Retention runs in-process: one pass 30 seconds after startup and every 24 hours (`RETENTION_INTERVAL_HOURS`). Expired events, session rows, properties, touchpoints, and (when present) payment rows are deleted. `POST /internal/retention` remains available for an external scheduler when `RETENTION_SECRET` is set.
- [x] Run SDK and API regression suites against isolated databases; the API suite now uses an isolated PostgreSQL schema.

## Before broad public launch

- [ ] Complete tenant isolation, write-key rotation, CORS/preflight, request size, quotas, and abuse testing.
- [ ] Verify SPA navigation and session expiry for the standalone SDK and npm package in real supported frameworks.
- [ ] Validate event counts and session definitions against real traffic without labeling approximations as exact.
- [ ] Install and update the GeoLite2 Country database on the API host, configure `GEOIP_DATABASE_PATH`, and verify `ingestion.geoip_database` is true. Set the same `GEO_FORWARD_SECRET` on Vercel and the API so `/internal/events` can receive the client IP from `X-Forwarded-For`; verify a new production event stores an ISO country code without storing the IP.
- [ ] Complete Vercel project discovery and report useful authorization/scope errors while preserving manual domain setup.
- [ ] Add safe custom-property filters with parameterized queries; do not expose arbitrary SQL execution.
- [ ] Document retention, account deletion, integration credential cleanup, and backup deletion limitations.
- [ ] Review dependency licenses, advisories, access scopes, secrets handling, and production logs.

## Deployment status for this change

The SPA/session SDK updates, CORS header adjustment, API session aggregation, Alembic baseline, and retention job are local only. No production configuration was changed and no deployment was triggered. API integration tests pass against an isolated local PostgreSQL schema; production migration and scheduler setup remain pending.
