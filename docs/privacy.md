# Crease Privacy Policy

Last updated: 12 November 2026

Crease is operated by Aman Sagar. For privacy questions or requests, contact [amansagar0307@gmail.com](mailto:amansagar0307@gmail.com).

## What Crease processes

Crease is a website analytics application under development. When enabled by a site operator, its tracking script can send page paths, event names and numeric or boolean event properties, timestamps, random visitor and session identifiers, and the referring website's hostname. The server can derive a broad device category and, when configured with a trusted geolocation provider, an approximate country. Page query strings and URL fragments are excluded by the current SDK; site operators must avoid putting sensitive data in URL paths or event names.

When you sign in, Crease receives your GitHub account ID and username. If you connect a GitHub App or Vercel integration, Crease processes the project and repository information needed to provide those features. Vercel access tokens are stored encrypted on the server. GitHub App authorization tokens are held in an encrypted, HTTP-only browser cookie with a one-hour lifetime. Vercel's Project read/write permission can allow creation, modification and deletion of projects; review the permissions on Vercel's consent screen before connecting.

IP addresses are present in network requests. Crease's current event database schema does not include a raw IP field. Hosting, network and security providers may process IP addresses and request logs as part of delivering the service; their retention and handling depend on the eventual deployment configuration.

## Why data is used

Crease uses this information to provide analytics, authenticate accounts, operate connected integrations, prevent abuse, and respond to support requests. Site operators should enable tracking only after obtaining any consent required for their visitors. They control which sites they connect and what custom events they send.

## Service providers and transfers

GitHub is used for sign-in and repository access. Vercel may be used for frontend hosting and connected project settings. Neon and Cloudflare are planned for database and backend infrastructure. Data processed by those providers is subject to their respective policies and the configured hosting locations. This policy should be updated when the production deployment and providers are finalized.

## Retention and deletion

Crease currently offers a per-project event-retention setting between 1 and 90 days. Changing the setting deletes events older than the selected period. Ongoing enforcement requires a scheduled retention job, which is not yet configured for production. Deleting a project through Crease deletes its associated events and project links from the application database. Backup and infrastructure log retention depend on the final deployment and must be documented before production use.

Disconnecting Vercel in Crease deletes the stored connection token and project links in Crease; it does not uninstall the integration from Vercel. You can manage GitHub App and Vercel integration permissions through those providers. Contact the email above to request access, correction, or deletion of data associated with your account.

## Changes

This policy may change as Crease is developed and its hosting and data practices are finalized. The date above identifies this version.
