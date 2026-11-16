# Database connection and migrations

## Production database

Neon is the source of truth for the deployed Crease account. The production database contains one user, one project, and 16 analytics events. The local Windows SQLite snapshot is stale, has different internal IDs, and has no analytics events, so no SQLite rows were copied.

The API requires `DATABASE_URL` and rejects SQLite URLs. Set the Render service's `DATABASE_URL` to the existing Neon PostgreSQL connection URL. The URL must remain a secret and must not be committed or included in logs. `/health` returns `{"status":"ok","database":"connected"}` only after a `SELECT 1` succeeds.

## Alembic baseline

`backend/migrations/versions/0001_baseline.py` matches the schema that existed when Alembic was introduced: users, sessions, OAuth state, projects, repository/Vercel connections, events, analytics session summaries, and durable rate-limit counters.

Run migrations from `backend` before starting the API:

```powershell
$env:DATABASE_URL='postgresql+psycopg://user:password@host:5432/crease'
alembic upgrade head
```

The API no longer creates or alters tables on startup. A fresh database must be upgraded first.

## Existing production database

The existing Neon database already has the pre-Alembic tables. Do not run the baseline migration against it; mark the baseline as applied instead, then apply any later migrations normally:

```powershell
alembic stamp 0001_baseline
alembic upgrade head
```

Take a backup or a Neon branch before stamping or upgrading production. Verify `/health` after the release.

## Property filter tables

`0002_property_filters` adds `event_properties` (indexed property values) and `project_property_keys` (per-project declared-key registry). Apply it with `alembic upgrade head`. New events populate both tables during ingestion. On PostgreSQL the migration also backfills numeric and boolean properties from the existing `events.properties` JSON text so historical events are filterable; SQLite runs the schema changes without the backfill.

## Adding schema changes

Create a new revision with `alembic revision -m "describe change"`, review the generated SQL, and test it against a disposable PostgreSQL database (and SQLite where the change is portable) before releasing it.
