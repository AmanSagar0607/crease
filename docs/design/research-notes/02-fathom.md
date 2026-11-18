# Fathom Analytics reference — evidence note

**Reference:** Fathom Analytics ([usefathom.com](https://usefathom.com/))
**Use:** One reference for Zappa’s analytics-product redesign. Fathom is an analytics product, not a design template to reproduce.

## Verified product facts

Fathom positions itself as easy-to-understand, privacy-respecting website analytics. Its official feature page describes real-time reporting, filtered drill-downs, saved views, date comparisons, milestones, campaign/UTM reporting, events with monetary values, CSV export and an API. These are Fathom’s claims and feature descriptions, not evidence that its implementation or legal claims transfer to Zappa. [1]

The public pricing page currently presents a 7-day trial and $15/month entry tier for up to 100,000 monthly pageviews, with 50 sites included; it says a card is required and billing begins after the trial unless cancelled. Plans include event and revenue tracking, API, exports and shared dashboards. [2]

Fathom’s privacy policy describes its business model as funded by paying customers rather than selling or renting personal data, and lays out data-subject rights and processing practices. The policy covers Fathom’s own legal and operational context; do not borrow its compliance language as a Zappa claim. [3]

## Observed / adaptable design direction

The official site’s product presentation emphasizes a live dashboard/demo as a way to inspect the product, and organizes the story around concrete analytics tasks rather than abstract platform claims. Feature descriptions connect filters, campaigns, events and outcomes in a single dashboard. This is a useful information-architecture cue, not a layout to copy. [1]

The official help page documents sharing controls with private-by-default access, individually revocable share links, optional password and expiry, and viewer-only scope. This is evidence of explicit access-state design in the product documentation, not a claim about Zappa’s available permissions. [4]

Adapt the evidence-first explanation style: define what is counted, show how acquisition filters lead to conversion evidence, and make privacy/data handling discoverable near relevant controls. For Zappa, label attribution as observed/derived and explain revenue linkage boundaries; do not imply Fathom-style anonymous pageview collection or cookie/legal outcomes. Keep Zappa’s existing product contract and design baseline authoritative: analytics, acquisition reporting, revenue attribution, SDK/API compatibility, Clerk-only auth, Supabase RLS and Vercel hosting remain unchanged. Its baseline already specifies Geist, restrained motion, near-black/warm neutrals and coral; the requested cream-forward direction should be treated as a visual redesign, not evidence sourced from Fathom.

## Limits

No Zernio screenshot was available among the supplied files, so it could not be inspected. Official pages were opened and used; no screenshot-only detail is treated as a Fathom fact. This note records product and interaction cues, not a pixel-level audit of Fathom’s live app.

## Sources

[1]: https://usefathom.com/features "Website Analytics Features"
[2]: https://usefathom.com/pricing "Pricing — Fathom Analytics"
[3]: https://usefathom.com/legal/privacy "Privacy policy for Fathom Analytics"
[4]: https://usefathom.com/docs/features/shared-dashboards "Share a dashboard"
