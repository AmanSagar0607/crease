# Backend authentication

Zappa accounts authenticate with Clerk only. The FastAPI backend verifies Clerk's default `__session` cookie and `Authorization: Bearer <JWT>` for API clients using the Clerk JWKS, RS256, `CLERK_ISSUER`, expiration/not-before checks, and exact `azp` membership in `CLERK_AUTHORIZED_PARTIES`. Set `CLERK_JWKS_URL` to an HTTPS JWKS endpoint only when needed; otherwise it is derived from the configured HTTPS issuer. Missing configuration, unreachable JWKS, malformed tokens, and failed checks deny access. Never put secrets in logs or commit credentials.

`session_user` exposes Clerk `sub` as `id` and `clerk_id`, and a sanitized display handle. Verified identities are persisted in the additive `clerk_profiles` table. Existing legacy project owner IDs are intentionally untouched. No email-based account matching or project transfer is performed. Users whose project owners predate Clerk may need an explicit, owner-authorized mapping before those projects appear under a new Clerk subject.

GitHub OAuth account sign-in and legacy `Zappa_session` auth are removed. GitHub App repository integration remains a separate OAuth authorization; users must first pass Zappa project ownership checks. `/api/clerk-webhook` verifies Svix-signed Clerk deliveries using `CLERK_WEBHOOK_SECRET`; `user.deleted` tombstones the profile only, preserving projects and analytics until a retention policy explicitly authorizes other action.

Run `alembic upgrade head` before deploying. Required configuration is `DATABASE_URL`, `CLERK_ISSUER`, and `CLERK_AUTHORIZED_PARTIES`; Clerk webhook processing additionally requires `CLERK_WEBHOOK_SECRET`.
