# Production deployment checklist

This checklist records known work before a broad public launch. The tracker and backend accept untrusted public browser events; a public project write key is visible in client code and is not proof that an event is genuine.

## Before deploying schema changes

- [x] Establish reviewed Alembic migrations for PostgreSQL and local SQLite workflows. Baseline is in `backend/migrations`; SQLite is no longer accepted by the API, but the migration was verified on an empty SQLite file.
- [ ] Confirm production migration status and backup recovery plan before the new session queries depend on `analytics_sessions`.
- [ ] Ensure the retention scheduler runs on Render and deletes both expired events and expired session rows.
- [x] Run SDK and API regression suites against isolated databases; the API suite now uses an isolated PostgreSQL schema.

## Before broad public launch

- [ ] Complete tenant isolation, write-key rotation, CORS/preflight, request size, quotas, and abuse testing.
- [ ] Verify SPA navigation and session expiry for the standalone SDK and npm package in real supported frameworks.
- [ ] Validate event counts and session definitions against real traffic without labeling approximations as exact.
- [ ] Keep country `Unknown` unless a trusted proxy overwrites the geolocation header and direct API access cannot spoof it.
- [ ] Complete Vercel project discovery and report useful authorization/scope errors while preserving manual domain setup.
- [ ] Add safe custom-property filters with parameterized queries; do not expose arbitrary SQL execution.
- [ ] Document retention, account deletion, integration credential cleanup, and backup deletion limitations.
- [ ] Review dependency licenses, advisories, access scopes, secrets handling, and production logs.

## Deployment status for this change

The SPA/session SDK updates, CORS header adjustment, API session aggregation, Alembic baseline, and retention job are local only. No production configuration was changed and no deployment was triggered. API integration tests pass against an isolated local PostgreSQL schema; production migration and scheduler setup remain pending.
