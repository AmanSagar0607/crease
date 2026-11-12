# Crease: product requirements

## Product

Crease is a free, developer-focused analytics platform. A developer creates an account, connects a website, installs a small tracking script, and views that site's traffic and product events. Each account can manage multiple projects. The platform owns its tracking SDK, ingestion pipeline, data, and dashboard; it does not embed a hosted analytics product.

The first release targets indie developers with sites hosted anywhere, including Vercel. Country reporting is approximate IP-based geolocation, not a record of a visitor's precise location. The service is free to users, subject to published usage and retention limits that keep operating costs sustainable.

## First public release

1. **Accounts and projects:** GitHub sign-in; create, rename, and delete projects; configure allowed production domains. Every dashboard and management request must check project membership on the server.
2. **Installation:** provide a project-specific public identifier and a copyable script, with instructions for common frameworks. Verify installation by receiving a valid event. Projects can use a manual domain regardless of host.
3. **Collection:** capture page views, client-side navigation, and explicitly named custom events. Batch events without blocking rendering; enforce payload and rate limits and deduplicate retries. The public project identifier is not a secret and does not authenticate a visitor.
4. **Dashboard:** date-filtered visitors, sessions, page views, top pages, referrers, device categories, and countries, with unknown values represented honestly. Show event counts and a recent-event view without inventing data.
5. **Privacy and control:** support consent-aware activation and opt-out; minimize captured properties, strip sensitive URL parameters, and avoid collecting input contents or raw IPs by default. Allow project data deletion and configurable retention within published limits. Do not fingerprint visitors.
6. **Optional Vercel integration:** let a developer authorize a connection and select accessible projects to discover domains. Manual setup remains available. Connecting does not automatically install the tracker; display the installation step explicitly. Request only permissions required for discovery, support disconnect, and protect provider tokens.

## Proposed user journey

Sign in with GitHub → create or select a project → enter a domain or connect Vercel → install the script → receive the first event → explore the dashboard. Clearly distinguish an unverified installation, an empty date range, and an ingestion failure.

## Initial architecture

- A standalone browser SDK sends versioned events to a public ingestion endpoint. Project IDs are public; validate origins as an abuse signal, not as proof of authorization.
- The ingestion service validates and limits batches, derives approximate country from a trusted edge provider, and stores events against a project. Direct requests must not be allowed to spoof trusted proxy headers.
- PostgreSQL is the initial source of truth for accounts, memberships, projects, events, sessions, and daily aggregates. Index by project and time and enforce tenant scope on every query. Use UTC for event timestamps and an explicit project reporting timezone.
- The authenticated dashboard queries project-scoped APIs. Apply rate limits and quotas per project and at the edge, cap payloads, and monitor usage and rejection rates.
- Generate random first-party visitor and session identifiers only when the configured consent policy allows. Define session expiry and metrics before presenting them as authoritative; cross-device identity is outside the first release.
- Delete project data through a controlled, auditable workflow covering raw events, aggregates, backups according to their documented lifecycle, and disconnected integration credentials. Retention jobs must apply the same policy across derived data.

These are design decisions to validate against hosting, dependency research, and representative load before production. Domain allowlists and public identifiers reduce accidental misuse but cannot prevent event forgery; dashboards must treat collected events as untrusted.

## Acceptance criteria

- Two accounts cannot read, modify, export, or delete one another's projects or data, including by changing project IDs in requests.
- A developer can add a domain and install the script without a Vercel connection; SPA navigation and a custom event appear only in the intended project.
- A retry of the same event does not inflate counts. Invalid, oversized, and rate-limited requests return documented responses.
- Country reports use trusted server-side geolocation and handle missing values; they never promise exact location or complete coverage.
- Opt-out prevents collection; sensitive fields and disallowed URL parameters do not reach storage. Project deletion and retention remove corresponding data and derived aggregates.
- Vercel connection can be declined or revoked without preventing manual setup; tokens stay server-side.
- The dashboard shows real data, the applicable timezone, and honest empty states. Tests cover tenant isolation, ingestion, identity/session boundaries, privacy, deletion, and aggregation.

## Later releases

Product analytics (funnels, retention, paths and saved insights), session replay and heatmaps, performance and error tracking, then feature flags, experiments and surveys. Each requires separate privacy, security, dependency, and operational review. Optional GitHub repository automation can propose tracker changes via a pull request; it must not silently modify user repositories.

## Open decisions before implementation

Choose the application framework and hosting, authentication approach, PostgreSQL provider, geolocation source, free-tier limits, consent defaults, retention bounds, and reporting definitions. Evaluate dependencies for current maintenance, license, advisories, bundle impact, and need before adopting them. Vercel Marketplace publication is a later integration milestone subject to its review requirements.
