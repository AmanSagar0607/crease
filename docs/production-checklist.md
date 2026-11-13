# Production deployment checklist

This checklist records known work before a broad public launch. The tracker and backend accept untrusted public browser events; a public project write key is visible in client code and is not proof that an event is genuine.

## Before deploying schema changes

- [ ] Establish reviewed Alembic migrations for PostgreSQL and local SQLite workflows.
- [ ] Confirm production migration status and backup recovery plan before the new session queries depend on `analytics_sessions`.
- [ ] Ensure the retention scheduler runs on Render and deletes both expired events and expired session rows.
- [ ] Run SDK and API regression suites against isolated databases; resolve the current Windows SQLite test hang first.

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

The SPA/session SDK updates, CORS header adjustment, API session aggregation, and retention cleanup changes are local only. No production configuration was changed and no deployment was triggered. API integration tests did not complete in the current Windows environment.
