# Revenue-first transformation: audit and phased plan

## Current state and preservation

Zappa uses Next.js 16/React, FastAPI, SQLAlchemy, Alembic and PostgreSQL. Projects belong to users; ingestion requires a verified domain, a per-project public write key, and a matching origin, and persists deduplicated event batches and server-assigned sessions. The standalone and npm trackers use first-party identifiers, batch/retry, and require consent-aware initialization. Existing dashboards, GitHub/Vercel connections, event ingestion, project ownership, and retention remain supported. The write key is public and browser events are untrusted, never proof of payment. Geolocation remains disabled unless the authenticated forwarding path and edge header handling are verified.

Current limitations: no durable acquisition history, payment model, provider verification, visitor-to-customer association, revenue queries, campaign costs, or revenue dashboard. Event paths omit query strings; current session identifiers are hints, not authority. There is no reliable historic UTM information to backfill. The npm package has not been confirmed published. Retention is a manually scheduled job.

## Phase 1: attribution foundation

- Add migration `0003_attribution_touchpoints`, with a project-scoped event foreign key, UTC timestamp, visitor and server session IDs, landing path, validated referrer host and bounded UTM fields, plus visitor/time and retention indexes. Do not backfill missing historical campaigns or perform production migrations.
- Capture allowed UTM keys only from consent-enabled page views in both SDKs. Exclude arbitrary query parameters, limit values and reject punctuation such as @ and URL delimiters. Values can still contain personal information, so document that publishers must not put personal data or credentials in UTMs. Keep current collection for non-attribution events and old SDKs.
- Persist one immutable touchpoint per accepted pageview with a visitor ID. Only use actual event time, server-assigned session, validated host and submitted fields; leave missing values unknown. Duplicate events must not add touchpoints. Same-site referrers are direct, without deleting earlier touches. Add matching retention/project deletion.
- Keep attribution evidence separate from any future payment. Do not create customer identities or infer revenue.
- Validate using isolated PostgreSQL migrations and tests for tenant isolation, direct/UTM/referrer, ordering, replay, deletion, consent and SDK behavior. Document that public events are forgeable and attribution is directional, not an authenticated identity.

## Later phases (separate reviewed changes)

2. Introduce provider-independent encrypted connection records, verified webhook inbox, normalized integer-minor-unit payments/refunds with unique provider transaction IDs, reconciliation, and a single provider verified against real sandbox webhooks. Record event timestamps and source currency without silently converting.
3. Link verified payments only through explicit, project-scoped, server-verified customer/visitor associations. Select first touch, last touch and last non-direct within a configurable UTC lookback window; keep missing links unattributed. Define refund, disputes, late-arrival and timezone semantics before reporting.
4. Build revenue and acquisition endpoints from real tenant-scoped queries and redesign the dashboard around trustworthy results; separate currencies until an explicit exchange-rate policy exists.
5. Add bounded multi-step funnels, saved segments, campaign costs/imports, customer timelines, and evidence-backed insight rules with sample thresholds.
6. Add remaining verified providers and integrations, export, self-hosting and MCP capabilities in independently tested releases.

## Rollout and rollback

Upgrade a fresh and existing production-like clone and validate event counts, consent behavior, tenant isolation, retention and query plans. Back up first. Apply Alembic separately before deploying the backend; no automatic production migration. Deploy backend before SDKs, monitor failures, and roll back SDKs/backend first if needed. The migration downgrade removes only new touchpoints and loses their data; export if needed. Never execute production migrations automatically.
