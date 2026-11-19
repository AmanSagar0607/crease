# Database connection and migrations

## Production database

Neon is the source of truth for the deployed Zappa account. The production database contains one user, one project, and 16 analytics events. The local Windows SQLite snapshot is stale, has different internal IDs, and has no analytics events, so no SQLite rows were copied.

The API requires `DATABASE_URL` and rejects SQLite URLs. Set the Render service's `DATABASE_URL` to the existing Neon PostgreSQL connection URL. The URL must remain a secret and must not be committed or included in logs. `/health` returns `{"status":"ok","database":"connected"}` only after a `SELECT 1` succeeds.

## Alembic baseline

`backend/migrations/versions/0001_baseline.py` matches the schema that existed when Alembic was introduced: users, sessions, OAuth state, projects, repository/Vercel connections, events, analytics session summaries, and durable rate-limit counters.

Run migrations from `backend` before starting the API:

```powershell
$env:DATABASE_URL='postgresql+psycopg://user:password@host:5432/Zappa'
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

## Phase 1 attribution touchpoints

Revision `0003_attribution_touchpoints` adds a project-scoped table linked to `events` and `projects` with cascading foreign keys and project/visitor/time indexes. Only accepted, unique pageviews with a visitor ID create touchpoints. No historical UTM data is invented. Test a fresh upgrade and an upgrade from `0002_property_filters` on an isolated PostgreSQL database before separately applying the migration. The API still does not migrate on startup, so apply it before deploying code that reads the table. Rollback to `0002_property_filters` removes the new table and its collected touchpoints, while preserving existing events; export touchpoints first if required.

Production was upgraded to `0003_attribution_touchpoints` on 2026-11-17 alongside the overview deployment. Direct TCP to Neon is refused from the development machine, so the revision was applied through Neon's HTTPS SQL endpoint over the same connection string; both indexes were created and `alembic_version` was stamped. Apply future revisions through a connection path that Render or the owner's network can reach, and verify `/health` and the owning endpoint afterwards.

## Payment foundation (not deployed)

Revision `0004_payment_foundation` adds encrypted integration credentials, a deduplicated webhook ledger, and currency-separated payment records. It cascades project deletion; disconnect deletes the integration and event ledger while retaining payments. Test upgrades and downgrades on isolated PostgreSQL first. Downgrading deletes all payment data and integration credentials in these new tables, so export and back up first. No production migrations are automatic.

## Clerk identity migration

Revision `0007_clerk_profiles` is additive: it creates `clerk_profiles` keyed by Clerk subject (text), with a display handle and an optional deletion tombstone. It widens existing owner-key columns to 255 characters without rewriting their values; it does not remap legacy owners. Existing project ownership remains on its original legacy ID until an owner-approved mapping has been designed; never infer identity from email. New verified Clerk subjects receive a profile on first API authentication. Apply the migration before deploying the Clerk backend.

The backend accepts Clerk's `__session` cookie or a Bearer JWT. Configure `CLERK_ISSUER`, `CLERK_AUTHORIZED_PARTIES` (comma-separated exact frontend origins), and optionally `CLERK_JWKS_URL` (otherwise derived from an HTTPS issuer). Tokens require RS256, valid issuer/time claims, a subject and an exact authorized-party match. JWKS/configuration failures deny access. No Clerk shared secret, token template, custom session cookie, or GitHub sign-in is used. Set `CLERK_WEBHOOK_SECRET` from the Clerk webhook endpoint signing secret; `/api/clerk-webhook` verifies Svix signatures and only tombstones profiles for `user.deleted`. Deletion does not remove projects or analytics; retention/deletion requires a separate explicit policy. GitHub App connections remain independent authorization and are available only after project ownership is verified.

## Live analytics cursor

Revision `0008_event_ingest_cursor` adds a Postgres-generated `events.ingest_seq` and project/cursor index for resumable SSE delivery. Existing rows receive cursor values during the additive migration; new rows receive one at insert time. The live feed code must not be deployed to the active API until this revision has been applied to its database. Apply with the usual backup/branch and migration review, then verify the schema and test the owner-scoped `/api/events/stream` endpoint. No production migration is run automatically. See [the live streaming audit](LIVE_STREAM_AUDIT.md) for the endpoint contract and capacity notes.
