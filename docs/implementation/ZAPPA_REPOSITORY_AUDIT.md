# Zappa repository audit

**Audit date:** 2026-11-18\
**Source:** `https://github.com/AmanSagar0607/Zappa`, branch `main`, commit `ca9f049` (clean checkout at audit). The separate shared `Zappa` repository URL initially present in project context contains only a license; the user then supplied this Zappa repository as the intended source. User confirmed Zappa is the customer-facing name and Clerk the only auth provider.

## Current architecture

- **Frontend:** Next.js 16.4.6 App Router, React 19.2, TypeScript, CSS modules/global CSS, Tailwind v4 utilities, shadcn/Radix UI primitives, lucide icons and Recharts. Current dashboard is a client-rendered surface in `app/dashboard/DashboardView.tsx` and calls same-origin `/api/*` endpoints.
- **API/backend:** Python FastAPI in `backend/main.py`, SQLAlchemy and Alembic migrations. The Next.js API includes event collection/proxy handling. A checked-in Cloudflare Python Worker experiment exists, but repository handoff states the active API is Render because the worker exceeded free-tier CPU limits.
- **Database:** PostgreSQL. Repository handoff/deployment documentation identifies Neon as the production source for the existing service; no Supabase schema/client/integration is present. The repository has Alembic revisions `0001_baseline` through `0006_waitlist`. Do not apply them or change database ownership in production as part of this audit.
- **Authentication:** custom GitHub OAuth callback and opaque, hashed server-side session token in an HTTP-only cookie. FastAPI checks project ownership by the existing user ID. This is the sole current product auth flow, but it conflicts with the confirmed Clerk-only target and must be replaced without retaining Supabase Auth.
- **Analytics flow:** consent-gated browser SDK and npm wrapper send batches to the API. The API validates project write key, verified domain, origin, payload, event time, limits and duplicate IDs before storage; session assignment is server-side. Trusted geography requires authenticated internal forwarding. The dashboard queries real API responses.
- **Integrations:** GitHub repository integration supports an explicit, reviewable installation pull request. Vercel account/project settings integration is present but has a documented project-discovery limitation. Keep these distinct from sign-in and do not automatically merge/install.

## Existing implemented functionality

- Project workspace and individual project routing, project CRUD, manual domains and DNS ownership verification.
- Standalone tracker `public/Zappa.js`, `sdk/Zappa.js`, and `packages/Zappa-analytics` with page views, SPA route detection, custom event capture, consent-aware initialization/opt-out, batching and retry behavior. Public compatibility identifiers must remain stable.
- Event ingestion, project write-key generation/rotation, per-project origin/domain checks, idempotency, payload checks, fixed-window database-backed rate limiting, bot filtering and data retention scheduling.
- Dashboard overview with actual visitors, sessions, pageviews, previous period, time series, acquisition model selection, conversion event selection, campaign/landing page summaries, recent activity, property filters and UTC period selection.
- Acquisition reports for first touch, last touch, last non-direct touch. Documentation explicitly distinguishes observed touchpoint visitors from revenue or confirmed direct traffic.
- Pages, events, live-activity polling (not a stream), device/country/referrer reports, property filtering, event-count goals and ordered two-to-five-step funnel reporting.
- Installation onboarding, script copy, domain check and actual event-receipt verification; empty/error/unverified states exist.
- GitHub repository and Vercel integrations, CSV export, marketing/landing/docs/pricing/waitlist routes.
- Tests exist for the SDK, package, CSV behavior and Next event route. Backend integration tests require a disposable PostgreSQL service and test database.

## Incomplete or known risks

- The auth system is still custom GitHub OAuth, with no email/password, email verification, password recovery, Google provider, Clerk prebuilt account management, or workspace roles.
- Supabase is not connected; no Clerk–Supabase native integration, Supabase RLS migration, or multi-account RLS isolation tests exist. Production database is documented as Neon. Database cutover must be staged and non-destructive.
- The current ownership schema appears single-user/project owner rather than shared workspace membership. Multi-member role-based authorization is incomplete.
- Revenue reporting is intentionally unavailable in the overview. There is no demonstrated generic verified revenue-ingestion API or robust customer/visitor identity association in the active product. Previous local Stripe foundation work is excluded by the current brief; do not treat it as production-ready or enable a payment integration.
- User deletion/account-lifecycle coordination, verified Zappa brand assets, and Clerk/Resend production configuration are not present.
- Documentation describes environment variables and provider setup, but does not yet document the selected Clerk-only/Supabase target or its plan limits.
- Previous notes report unresolved Vercel project discovery, no completed review of all tenant-security risks, and absent auth/browser validation across all screens. Country remains unknown in production until the approved geo-forwarding secret/topology is configured.
- No `.env` or deployment secrets were read. This checkout has no `node_modules`, so the local Next 16 documentation is not yet available; install from the checked-in lockfile before implementing Next-specific APIs.

## Reuse and protected contracts

Keep the existing dashboard’s reporting components, date/attribution semantics, collection validation, ingestion endpoint, visitor/session privacy behavior, retention, tests, onboarding verification, GitHub/Vercel installation behavior, and compatibility-sensitive SDK routes/names. Reuse established CSS modules and shadcn primitives. Do not rewrite working features just to match a reference screenshot.

## Migration decision

The target architecture is Next.js with Clerk as the only identity provider and Supabase PostgreSQL as the future application database. Pass Clerk session tokens through the official Supabase third-party integration. Keep Clerk user identifiers in `TEXT`; RLS must enforce membership and project isolation using `auth.jwt()->>'sub'` and membership records. An additive, reviewed Supabase migration and test environment are prerequisites for any data path cutover.

No Supabase project credentials or current data export/cutover authorization were supplied. Therefore, no production migration or destructive source change is authorized. Preserve the existing FastAPI/Neon source until the equivalent Clerk-authenticated Supabase paths, mapping and RLS are verified with multiple accounts. No push to `main` or deployment is included.

## Architecture and data-flow sketch

Current: browser SDK → Next `/api/events`/FastAPI → PostgreSQL (documented Neon) → FastAPI project APIs → same-origin dashboard fetches.

Target: Clerk session → protected Next.js dashboard/API → Supabase publishable client with Clerk session token → Supabase PostgreSQL RLS; browser SDK → validated ingestion endpoint → the same authoritative analytics database. The latter connection and production data cutover remain gated until a real Supabase project is configured and the tenant-isolation tests pass.
