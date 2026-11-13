# Database connection and migration status

## Production database

Neon is the source of truth for the deployed Crease account. The production database contains one user, one project, and 16 analytics events. The local Windows SQLite snapshot contains an older copy of that same GitHub identity and site domain, has different internal IDs, and has no analytics events. Importing those rows would create duplicate/orphaned records, so no SQLite rows were copied. Existing Neon analytics data remains intact.

The API now requires `DATABASE_URL` and rejects SQLite URLs. Set the Render service's `DATABASE_URL` to the existing Neon PostgreSQL connection URL. The URL must remain a secret and must not be committed or included in logs. `/health` returns `{"status":"ok","database":"connected"}` only after a `SELECT 1` succeeds.

## Current schema upgrade

`backend/main.py` still applies additive, idempotent schema changes during API startup rather than using Alembic. Startup creates missing `analytics_sessions` and `rate_limits` tables and indexes, adds missing project verification columns, and backfills session summaries from retained events. The backfill uses an upsert that replaces each aggregate from source events, so restarting the service does not double-count page views. Existing event, user, and project rows are not deleted or rewritten.

The production Neon database was checked read-only: it has the current account/project/events tables and 16 events; `analytics_sessions` and `rate_limits` are not present yet. The next successful Render startup with the updated code creates these structures and backfills eight session summaries from existing events. The local SQLite database was not migrated because it is stale and duplicates the production identity/site.

## Follow-up

This startup migration is a temporary mechanism. Before adding more schema changes, introduce versioned Alembic migrations, test them on a disposable Neon branch, and run production upgrades as a controlled release step. Keep startup from mutating the schema after versioned migrations are established.
