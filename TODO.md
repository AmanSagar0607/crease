# Zappa implementation outcomes

This list tracks actual product outcomes. “Complete” requires implemented behavior and evidence; a screen, schema stub, or documentation alone is not completion. No production deployment, production data writes, destructive migrations, paid resources, DNS changes, or real customer email are authorized by this task.

## Brand and product documentation

- [ ] Customer-facing product name, app title/metadata, account/auth pages, workspace/dashboard shell, onboarding, documentation, and new product copy consistently say **Zappa**.
- [ ] Preserve compatibility-sensitive identifiers and behavior: `public/Zappa.js`, `sdk/Zappa.js`, `@aman-sagar06077/zappa-analytics`, existing collector routes and payloads, `Zappa_` write-key format, existing project IDs and stored records, bookmarks/hash behavior, GitHub/Vercel integration APIs, and analytics semantics. Document any necessary exception before changing one.
- [ ] Keep the revenue analytics product promise focused on observed visitor → session → behavior → conversion → customer → verified revenue; never invent data.
- [ ] Store the evidence-based DataFast reference audit, existing repository audit, Zappa product specification, Zappa design system, migration notes, and current environment-variable documentation in the repository.

## Clerk authentication and account lifecycle

- [ ] Clerk is the only identity/authentication provider; do not add or retain Supabase Auth as a second system.
- [ ] Email/password signup and login work; users can verify email, recover/reset passwords, use supported Google and GitHub social sign-in, sign out securely, and manage their profile/account through Clerk-supported flows.
- [ ] Use the official Clerk Next.js SDK and accessible prebuilt authentication components; customize their appearance to Zappa’s dark interface.
- [ ] Protect dashboard routes and verify user identity and authorization on the server. Keep secrets out of browser code and source control.
- [ ] Handle workspace membership and role authorization with database-backed membership, using TEXT Clerk IDs rather than UUID assumptions. Avoid relying on paid Clerk-only role capabilities.
- [ ] Define and test user deletion/account-lifecycle behavior, including owned workspace/project data policy and Clerk-to-database deletion coordination; do not delete production data during this task.
- [ ] Document Hobby/free-plan limits and do not use paid features or duplicate Clerk-owned verification/password-reset emails.

## Supabase PostgreSQL, Clerk tokens, RLS and migration

- [ ] Supabase PostgreSQL is the target primary/authoritative application database, clearly distinguished from the existing documented Neon deployment until a safe cutover is approved and completed.
- [ ] Use Clerk’s official native Supabase third-party auth integration; pass the authenticated Clerk session token to Supabase. Do not use deprecated JWT templates.
- [ ] Include only necessary Supabase schema/migrations with TEXT Clerk IDs, foreign keys, useful indexes, project/workspace ownership and data retention/deletion behavior.
- [ ] Enable RLS on every exposed customer-data table; policies use `auth.jwt()->>'sub'` and workspace/project membership to isolate records. Frontend checks are not the sole authorization boundary.
- [ ] Provide allowed and denied isolation tests for multiple accounts/workspaces, including attempts to read, update, export, or delete another tenant’s project data by altering IDs.
- [ ] Prepare a non-destructive migration plan from existing PostgreSQL data. Do not assume duplicate/stale local databases are authoritative. Do not execute a production migration without explicit approval, a backup/rollback plan, and independent access-isolation verification.
- [ ] Use environment variables; only publishable Supabase configuration may be exposed client-side. Never expose Clerk secret keys, Supabase secret keys, service-role credentials, database URLs/passwords, Resend keys, or ingestion secrets.

## Workspace, projects, navigation and onboarding

- [ ] Users can create/select/rename/delete their own websites/projects and manage team workspace membership/roles without cross-workspace access.
- [ ] Dashboard routes remain protected and navigation is consistent. Show only destinations that have real behavior; unsupported features state the missing capability clearly.
- [ ] Tracking setup collects an allowed domain, provides the existing script and NPM/Next/React/generic integration instructions, copy controls, public project key/write-key semantics, and privacy/consent guidance.
- [ ] Domain ownership and actual event receipt are separate states. Tracking is not called active just because instructions were displayed. Verification reports a real event and provides clear waiting/error/empty states.
- [ ] Responsive navigation preserves access to key routes on mobile, tablet, laptop and desktop.

## Tracking, ingestion, privacy and acquisition reporting

- [ ] Preserve the existing SDKs, browser tracker, batching/retry behavior, SPA pageviews, custom events, opt-out/consent behavior, project-scoped visitor identity, domain/origin checks, write-key checks, event-size validation, deduplication, rate limits and bot filtering.
- [ ] Keep public tracking identifiers non-secret; browser events, visitor IDs, UTMs and referrers are untrusted evidence and cannot prove identity or payment.
- [ ] Collect only documented, consent-permitted fields; omit raw IP addresses and sensitive URL parameters, avoid fingerprinting/session replay, and label geolocation as approximate/unknown where appropriate.
- [ ] Preserve actual date-filtered visitors, sessions, pageviews, event counts, pages, referrers, devices, countries, event detail, custom property filters, retention and deletion semantics. Sessions remain distinct from visitors; only valid pageviews count as pageviews.
- [ ] Preserve overview period comparison, date range, attribution model, conversion event, chart, source/campaign/landing-page reports, refresh/loading/error/empty states, search/sort/pagination, and formula-safe CSV export. Report definitions and limits remain visible where relevant.
- [ ] Preserve first-touch, last-touch and last-non-direct acquisition reporting as observed touchpoint evidence. Missing source is not labeled confirmed direct. Attribution never manufactures a journey when identity cannot be reliably matched.
- [ ] Preserve consent-aware collection, sensitive-field filtering, domain ownership and domain deletion policy; retention removes raw and derived analytics together.

## Goals, funnels, visitors and revenue

- [ ] Goals use actual previously observed event names and real event counts. Create/edit/disable/delete and reporting behavior state the metric definition; revenue is not inferred.
- [ ] Funnels use actual events in deterministic chronological order with 2–5 steps, clear drop-off/conversion definitions, date windows, and no fabricated counts.
- [ ] Visitor exploration only displays collected, privacy-conscious fields, supports filtering/pagination, and never shows raw IP. Journey matching is not fabricated.
- [ ] Until trustworthy authenticated server-to-server revenue ingestion, idempotency, transaction/currency/status/refund support, audit trail and verified visitor/customer linkage are implemented and tested, revenue stays explicitly unavailable with a setup explanation. No Stripe or other payment-provider connection is part of this phase.
- [ ] If generic revenue ingestion is implemented, it authenticates private server credentials, is idempotent, validates payload/amount/currency/timestamps/status, records refunds/cancellations, separates gross/net and currencies, and never trusts client-supplied payment claims.

## Transactional email and integrations

- [ ] Resend is used only for server-side application notifications that are actually needed (for example, workspace invitations); authentication emails remain with Clerk.
- [ ] Email uses a configured verified sender, HTML and plain-text alternatives, safe variables, failure handling and delivery logging; development/test mode cannot send real customer mail accidentally.
- [ ] Preserve GitHub repository connection/install-PR review flow as an integration, not an auth provider; preserve optional Vercel integration and honest failure/no-project states. Never merge repository PRs or silently install tracking.
- [ ] Cloudflare, Vercel and other infrastructure use only authorized existing free-tier configuration; DNS, WAF, paid resources and deployment changes remain gated.

## Accessibility, performance and testing

- [ ] Target WCAG 2.2 AA with semantic landmarks, accessible labels, keyboard operation, visible focus, logical tab order, focus management, reduced-motion behavior, status not represented by color alone, chart descriptions/data alternatives and readable 200% zoom.
- [ ] Desktop/laptop/tablet/mobile layouts avoid unintended horizontal overflow; tables and charts remain usable with touch-friendly controls and do not solve overflow by making text unreadable.
- [ ] Avoid fabricated analytics, unbounded history scans, redundant libraries, redundant auth/database systems and costly infrastructure without measured need.
- [ ] Automated tests cover auth/authorization, multi-tenant RLS, event validation/deduplication, attribution determinism and missing-source semantics, sessions/time windows, goals/funnels, revenue/refunds if implemented, deletion/retention and email failure handling where applicable.
- [ ] Run existing and added unit/integration tests plus TypeScript/build checks. Run browser and responsive visual QA for desktop/tablet/mobile and important safe workflows; record exact limits and unresolved failures.
- [ ] Update setup/deployment instructions and `.env.example`; keep real credentials out of Git. State clearly which external settings, credentials, project linkage, migrations or approvals remain for the owner.
