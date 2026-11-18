# Zappa product specification

## Product

**Name:** Zappa\
**Positioning:** Revenue Analytics for SaaS Founders\
**Tagline:** Know what drives your growth.\
**Audience:** SaaS founders, indie hackers and developers.

Zappa helps users understand where visitors arrive from, what they do, which become leads/signups/customers, and which acquisition activities create verified revenue. Product reasoning must follow the evidence chain: marketing source → visitor → session → behavior → conversion → customer → revenue.

## Product principles

- Revenue-first, but never fabricate monetary results.
- Simple by default, deeper reports when needed.
- Developer-friendly tracking and installation.
- Explainable attribution based on observed first-party evidence.
- Privacy-conscious collection and clear consent controls.
- Affordable infrastructure and open-source packages where practical.
- Real backend-connected features only; unavailable features must say what is missing.

## Authentication and authorization

Clerk is the sole identity provider. Use its official Next.js SDK and prebuilt accessible components for email/password sign-up and sign-in, email verification, password recovery, Google and GitHub social connections, session management, user profile/account management and secure logout. Google and GitHub fit within Clerk Hobby’s published maximum of three social connections, subject to the app’s own provider credentials and setup. Keep Clerk-owned verification/password-reset mail with Clerk; do not build another auth-email system.

Workspace membership and roles belong to database tables and server/database policies. Use TEXT Clerk user IDs. Dashboard/API access checks must happen server-side and at RLS. Do not assume Clerk’s paid-only custom role features. User deletion needs an explicit cascade/anonymization policy and coordination with Clerk account lifecycle events.

## Database and application architecture

Target Next.js 16/React 19 on Vercel; Clerk for auth; Supabase PostgreSQL for application and analytics records; Supabase RLS for data authorization; Cloudflare for DNS/security and only justified ingestion infrastructure; Resend for server-side application notifications. Clerk’s native Supabase third-party integration forwards session tokens. Use `auth.jwt()->>'sub'` plus workspace/project membership in RLS. Never use Supabase Auth or the deprecated Clerk JWT-template integration.

Current repo and deployment documentation identify a working FastAPI/PostgreSQL (Neon) service. Existing source is preserved while an additive Supabase schema and safe migration are developed. Neon remains the existing operational source until Supabase is configured, migrated without loss, and isolated access is verified. Do not report the target state as deployed before then.

## Working product areas to preserve

- Project/workspace list and project detail route.
- Manual domain setup, DNS ownership verification and actual first-event confirmation.
- Existing browser script, npm SDK, SPA navigation/pageviews, custom event API, batching/retries, consent/opt-out and privacy filters.
- Overview, UTC date windows, equivalent prior-period comparison, visitor/session/pageview/event metrics, charts, acquisition, campaign and landing-page summaries, pages/events, filters, recent activity, live polling, CSV export and truthful empty/error states.
- First-touch, last-touch, last-non-direct acquisition calculations and disclosures about incomplete/browser-supplied evidence.
- Event-based goals and ordered 2–5 step funnels based on received data.
- Existing project settings, retention, GitHub repository PR flow and optional Vercel integration.

Do not treat a setup instruction as proof of active tracking. Do not show raw IPs or inferred identities.

## Revenue scope

No provider-specific payment connection (including Stripe) is part of this phase. Only verified server-to-server monetary records with idempotency, transaction/currency/status/timestamp, refund/cancellation handling, audit trail and reliable visitor/customer matching can support “verified revenue.” If those behaviors are not fully implemented and tested, keep revenue unavailable and explain the next step. Client-side custom events, signups and goals cannot create revenue values.

## Notifications

Resend may send application notifications such as workspace invitations, usage warnings or user-configured alerts after those functions exist and have notification preferences. Keep keys server-side, use only a configured verified sender, supply HTML/plain-text templates, log delivery outcomes, and default development/test to no delivery. Authentication mail remains with Clerk.

## Provider limits and dependencies

Clerk Hobby is published as $0 with 50,000 retained users per app and up to three social connections. Email/password and standard email methods are included. Custom email templates, MFA and some advanced plan capabilities are excluded. Do not use paid add-ons or enterprise SSO without the user’s approval. Verify current limits at implementation time and document plan-gated features rather than relying on them.

## Success state

The product is complete when core auth, workspaces, isolation, setup, tracking, observed analytics, attribution, goals/funnels and tested infrastructure are real; public marketing/demo data never becomes production analytics; docs and environment examples match the actual code; responsive/accessibility/browser checks pass or unresolved limits are named. Production data cutover, external credentials, DNS changes, real email and deployment remain approval-gated.
