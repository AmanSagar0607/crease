# Clerk and Supabase implementation notes

**Checked:** 2026-11-18. These are provider facts, not a substitute for project-specific configuration.

## Clerk Hobby plan

Clerk's pricing page currently lists Hobby at $0, with 50,000 retained users per app and up to three social connections. Passwords and email methods are included. Google and GitHub consume two of those social connections, within the published limit. Hobby session duration is fixed at seven days. Custom email templates, MFA, passkeys and enterprise SSO are not included. Google/GitHub still require the site's provider setup; Clerk's deployment guide says production needs social OAuth credentials for each provider. Do not promise those providers work until their configuration is completed.

Source: https://clerk.com/pricing

Clerk's official quickstart for Next.js 16 uses `@clerk/nextjs`, wraps the app in `ClerkProvider`, and uses root-level `proxy.ts` with `clerkMiddleware()`. The middleware does not protect routes by default; protection is explicit. Prebuilt auth/account components are supported.

Source: https://clerk.com/docs/nextjs/getting-started/quickstart

Clerk session tokens are JWTs available in the `__session` cookie on same-origin requests or in an Authorization header. The backend must validate the signature, expiration/not-before, expected algorithm and authorized-party origin. The official docs show public-key/JWKS verification and require `authorizedParties` to reduce CSRF risk.

Source: https://clerk.com/docs/guides/sessions/manual-jwt-verification

## Native Clerk–Supabase third-party integration

Clerk's current guide requires activating Supabase compatibility in the Clerk dashboard, then adding Clerk under Supabase Authentication → Third-Party Providers. Supabase CLI local development uses `[auth.third_party.clerk] enabled = true` plus the Clerk domain. This integration does not synchronize user-profile rows; use explicit synchronization only when the app actually needs those records.

The current client flow passes the normal Clerk session token into `@supabase/supabase-js` via the Supabase `accessToken` callback (e.g. a Clerk session's `getToken()` result). The old `getToken({ template: 'supabase' })` JWT-template approach is deprecated and must not be used. Supabase RLS can identify the Clerk principal using `auth.jwt()->>'sub'`. Clerk user IDs are strings and must not be stored in UUID-only columns.

Sources:
- https://clerk.com/docs/guides/development/integrations/databases/supabase
- https://supabase.com/docs/guides/auth/third-party/clerk

The repository does not contain a Supabase project URL, Clerk keys, a Clerk domain, sender domain, or authorized database export. No live integration, production switch, DNS change, real email send, or data migration has been performed. The plan is code/schema scaffolding and tests first, followed by an owner-configured provider connection, export verification, RLS isolation tests, and an explicit cutover approval.
