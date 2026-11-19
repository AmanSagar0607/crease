# Zappa implementation plan

## Product and delivery decision

The task targets the existing repository `https://github.com/AmanSagar0607/Zappa`, currently checked out at commit `ca9f049` on `main`. The customer-facing product name is **Zappa**. Preserve existing analytics behavior, SDK/API contracts, and integrations; do not rename public `Zappa.js`, `@Zappa/analytics`, `Zappa_` write keys, existing URLs, or database identifiers in this pass because those are compatibility contracts. Keep all product copy and new UI branded Zappa. Do not deploy, touch production data, change DNS, send real email, run destructive migrations, create paid resources, or push to a deployment-triggering branch without approval.

## Design decisions

- **Design read:** founder/developer analytics web app; laptop-first decision workspace; redesign-preserve of the existing dark, compact, project-focused dashboard with the customer-facing brand changed to Zappa.
- **Positioning questions:** The primary view is a data/decision surface, not a marketing hero. It is primarily scanned from laptop distance. It should feel measured and trustworthy rather than celebratory. KPIs, trend, acquisition, and pages must fit a dense but orderly viewport without competing cards.
- **Calibration:** visual variance 3/10; motion 2/10; information density 8/10; asset dependence 2/10; existing visual-system fidelity 7/10, with the explicitly approved name/wordmark change.
- **Palette and typography:** continue the dark analytics surface already used by the dashboard: near-black base, warm off-white primary text, restrained coral as the ownable emphasis, muted gray secondary text, and low-contrast borders. Reuse Geist already shipped in the app unless repository verification shows otherwise. Keep semantic tokens for status and charts; do not encode status by color alone.
- **Layout and components:** retain the project sidebar, top-level controls, overview hierarchy, compact metrics, chart, and scannable report tables. Use an 8/12/16/24/32px rhythm, 6–8px control radii, minimal shadow, clear keyboard focus, and reduced-motion-safe 150–200ms state transitions.
- **Brand expression:** use the user-approved Zappa text wordmark treatment; no decorative dashboard illustrations.

## Current architecture and migration approach

The existing app is Next.js 16/React 19 with a Python FastAPI API, a PostgreSQL database documented as Neon in production, and three tracking surfaces: `public/Zappa.js`, `sdk/Zappa.js`, and `packages/Zappa-analytics`. This implementation must not create a second auth provider or a second analytics source of truth.

Clerk is the only authentication provider for signup, email/password, verification, supported Google/GitHub social sign-in, password recovery, sessions, profile/account management, and logout. Use the official Next.js SDK and prebuilt Clerk auth/account components, customized to the existing dark visual system. Database user IDs are Clerk IDs stored as text. The database owns workspace membership and roles in its own membership tables; do not assume paid Clerk custom roles or Clerk Organizations are necessary. Email verification and password-reset messages remain Clerk-owned; Resend is reserved for application notifications and invitations where actually implemented.

Supabase PostgreSQL is the target authoritative application database. Configure the official native Clerk third-party authentication integration and pass Clerk session tokens to Supabase clients. Apply RLS to customer-data tables using `auth.jwt()->>'sub'` and workspace/project membership, not frontend-only checks. Keep publishable Supabase values public only where required and all secret keys server-side. Do not introduce the deprecated Clerk JWT-template integration.

The checked-in app currently points at an external FastAPI/PostgreSQL boundary; this environment has no authorized Supabase project credentials and must not migrate or alter production data. Implement only changes that are safe in source: Clerk integration scaffolding, documented environment placeholders, reviewed additive Supabase schema/policies and code paths that can be tested locally. Keep the old collector/SDK contracts intact. Any database ownership cutover requires a user-supplied Supabase project, tested non-destructive data migration, verification of RLS from at least two accounts, and explicit production approval. Until cutover is verifiable, clearly describe the current data source and do not claim Supabase-backed production operation.

## Implementation sequence

1. Record the repository and public-reference audits, product specification, design tokens, plan, and outcome-based TODO.
2. Inspect current Next.js 16 documentation and installed APIs before edits. Add only needed dependencies and documented environment placeholders; configure TypeScript diagnostics before the first source-code batch.
3. Rebrand visible UI, metadata, login/onboarding/docs copy and non-compatibility assets to Zappa while preserving routes, SDK public interfaces, collection semantics and existing empty/loading/error states.
4. Integrate Clerk as the single identity/session layer, protect dashboard server routes, replace GitHub OAuth-as-auth while retaining GitHub repository authorization as a separate integration, and provide signup/login/profile/logout/account-lifecycle flows.
5. Add Supabase client integration that forwards the Clerk session token and reviewed migrations for profiles/workspaces/members/projects and analytics tables with text Clerk IDs and RLS. Do not apply migrations to a live database.
6. Preserve and test the existing real-data overview, acquisition models, campaign/page reports, goals, funnels, visitor/event exploration, installation verification, retention, exports, and project isolation. Do not add fabricated metrics. Keep revenue explicitly unavailable until trustworthy authenticated server-side revenue ingestion and identity attribution exist; no payment-provider integration is included.
7. Add Resend only for approved application email cases, with server-only credentials, verified sender configuration, HTML/plain text, and a safe non-sending development mode. Do not duplicate Clerk authentication emails.
8. Run source checks and tests, then the requested browser/viewport/accessibility QA on safe local or preview data only. Resolve failures and document blockers; do not publish or deploy.

## Project structure and responsibilities

- `app/`: Next.js routes and pages, Clerk-protected dashboard and Clerk authentication pages.
- `app/dashboard/`: existing real-data dashboard, reporting sections and project onboarding; retain API contracts while moving auth context.
- `app/api/`: existing ingestion and application route handlers; request validation and safe API boundaries.
- `components/`: existing accessible shadcn/Radix primitives, extended only where needed.
- `lib/`: server/client auth, Supabase token-aware clients, validation, and email helpers.
- `supabase/migrations/`: additive PostgreSQL schema, indexes, RLS policies, and test fixtures; never applied to production by this task.
- `backend/`: existing FastAPI ingestion/reporting and integrations; retain until replacement paths have tested equivalent behavior.
- `public/`, `sdk/`, `packages/Zappa-analytics/`: compatibility-critical tracker assets and packages; preserve their public contracts.
- `docs/research/`, `docs/implementation/`, `docs/design/`, `docs/product/`: evidence-based audit, migration notes, implementation requirements and design tokens.
- `emails/` or `lib/email/`: only server-side transactional application email templates and send helpers, if implemented.

## Material constraints

The repository’s existing production configuration and deployed services are outside the permitted scope. No Clerk/Supabase/Resend credentials were supplied for the selected app, and no Supabase project is documented as the live source of analytics data. Current plans and provider features will be verified against official sources. Clerk Hobby includes up to three social connections and supports passwords/email methods; Google and GitHub fit within that cap. Custom Clerk email templates, MFA, and some advanced account/team features are plan-gated, so do not depend on them. Do not activate paid services.

## Relevant structure observed

Current product code lives in `app/dashboard/`, the FastAPI application in `backend/main.py`, analytics definitions in `backend/overview_reporting.py`, and the tracking SDK in `public/Zappa.js`, `sdk/Zappa.js`, and `packages/Zappa-analytics/`. Migrations currently live under `backend/migrations/versions/`; the Supabase schema will be a separate, additive Supabase migration path until an approved cutover is complete.
