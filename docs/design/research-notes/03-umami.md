# Umami Analytics — design reference evidence

**Reference:** Umami Analytics (`umami.is`), a privacy-oriented web and product analytics platform. Use this as one reference only; Mobbin is a pattern library, not a competitor. The evidence below distinguishes Umami’s stated product facts from page-structure observations. No wording, logos, assets, or signature layouts should be copied.

## Verified product facts

Umami describes itself as open-source, privacy-first web and product analytics. Its stated capabilities span traffic and campaigns, custom events, funnels, journeys, retention, revenue, session replay, and heatmaps; it says standard analytics works without cookies or personal data. These are Umami’s claims, not assumptions about Zappa’s capabilities. [1]

Its platform page presents the work in a clear progression: **Acquisition** (“where traffic comes from”), **Behavior** (“what people do”), **Conversion and revenue**, then **Privacy**, **Collaboration**, and **Deployment**. Supporting capabilities are grouped beneath each area. This is an observed information hierarchy, not proof of a particular in-product dashboard layout. [2]

Umami states its self-hosted edition is free and MIT-licensed. Its current cloud pricing page lists Hobby at $0/month (up to 100K events/month), Pro at $20/month, Business at $200/month, and custom Enterprise. Plan entitlements differ: examples include event limits, retention, website/team counts, API access, and replay/heatmap access. These are Umami-specific and should not be imported into Zappa’s commercial terms. [3]

On its security page, Umami describes data minimization, least privilege, defense in depth, and transparency. It says standard analytics does not use cookies, track visitors across sites, or use analytics data for advertising. The page qualifies that optional features can collect additional information, and that session replay is off by default with input masking. It also explicitly says Umami is not SOC 2 or ISO 27001 certified and has not completed an independent penetration test. These trust claims apply to Umami, not Zappa. [4]

## Adaptation to Zappa

Safely borrow the clarity of an acquisition → behavior → conversion/revenue story, with a compact, scannable grouping of real report surfaces and clearly labeled states. Put privacy explanations near collection/setup and report context; distinguish standard collection from any optional or sensitive-data feature. Make data access, retention, and permissions understandable rather than relying on broad “secure/private” badges. Use the product’s real charts and tables as evidence, not promotional dashboard mock data.

These principles complement Zappa’s existing design baseline: warm cream and near-black surfaces, a single orange-red accent, Geist Sans/Mono, restrained motion, and evidence-aware acquisition/revenue reporting. Preserve Zappa’s existing analytics, acquisition reporting, revenue attribution, SDK/API contracts, Clerk-only authentication, Supabase RLS, and Vercel hosting. Do not infer or promise Umami’s cookie-free behavior, anonymization model, compliance status, hosting options, or capabilities for Zappa.

## Limits / unavailable context

The attached Zernio screenshot was not present in the task’s available files; the visible images found in the workspace were Zappa screenshots/assets. No screenshot text or screenshot-only detail is used here. The public sources inspected are marketing, pricing, and security pages. Their written structure supports the hierarchy observations above, but does not establish actual dashboard interaction behavior or independent verification of vendor claims.

## Sources

[1]: https://umami.is/ "Umami official homepage"
[2]: https://umami.is/platform "Umami official platform overview"
[3]: https://umami.is/pricing "Umami official cloud pricing"
[4]: https://umami.is/security "Umami official security and data protection"
