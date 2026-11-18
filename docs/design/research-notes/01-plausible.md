# Reference 01 — Plausible Analytics

**Reference:** [plausible.io](https://plausible.io/)

## Positioning

Plausible positions itself as an easy-to-use, privacy-friendly alternative to Google Analytics: “powerful, lightweight analytics” focused on useful insights without complexity. Its homepage emphasizes a one-page-at-a-glance experience, real-time reporting, goals/custom events, funnels, revenue tracking, and acquisition contexts such as AI referrals, SEO, UTM campaigns, and landing pages. These are stated product claims, not independent validation. [1]

The company states that it is independent, open source, EU-based, self-funded, and subscription-funded. [4]

## Observed product and layout patterns

- The public product narrative is organized around a direct CTA, live demo, a short list of concrete jobs-to-be-done, trust proof, then plan comparison. This is an observed information hierarchy from the homepage, not a recommendation to reproduce its copy or layout. [1]
- The product promise is “essential insights” and an aggregated view rather than a large report-builder surface. This supports a Zappa overview that is a decision surface, while detailed acquisition and revenue screens remain evidence/report surfaces. [1][2]
- The feature set is presented as compact, named capabilities: real-time dashboard, automatic scroll depth, campaign/channel analysis, goals, revenue tracking, funnels, journeys, and bot filtering. For Zappa, adapt the principle of explicit capability labels and scannable report sections, not Plausible’s exact UI or wording. [1]
- The public site makes a live dashboard demo directly available. A comparable Zappa trust pattern would be a clearly labeled product preview or documented sample state; it must never be presented as real customer data. [1][2]

## Trust and privacy signals

Plausible states that it does not use cookies, persistent identifiers, cross-site or cross-device tracking, or personal-data collection; that data is not sold, shared, or used for ads; and that customers own their website data. It also states that hosted visitor data is processed on European-owned infrastructure in the EU. These are Plausible’s stated policies and should not be generalized to Zappa without implementation and legal verification. [2][4]

The strongest adaptable pattern is privacy clarity near the product promise: explain what is collected, what is not collected, retention/ownership, and the operational boundary in plain language. For Zappa, this should complement—not replace—its existing Clerk-only auth, Supabase RLS, SDK/API contracts, and Vercel hosting disclosures.

## Pricing/access facts

Plausible documents a 30-day free trial with no credit card required, monthly or yearly billing, and no long-term contracts. Plans are based on total pageviews and custom events across a team, with feature/team-size differences between tiers. The docs say all trial users receive Business features and limits during the trial; Enterprise is contact-led. [3] The homepage currently displays Starter, Growth, Business, and Enterprise tiers and lists revenue attribution, Stats API, and related capabilities under Business. [1]

## Relevance to Zappa

Use Plausible as a reference for calm, low-noise analytics positioning; a clear live-demo/product-preview path; capability-led information architecture; and privacy explanations that are visible before or alongside conversion prompts. Adapt the underlying principles to Zappa’s developer-first revenue/acquisition focus, warm cream and near-black direction, single orange-red accent, Geist Sans/Mono, restrained 150–200ms motion, and existing analytics/reporting contracts. Do not copy Plausible’s logo, wording, assets, exact layout, or distinctive visual treatment.

## Limitations

This is one competitor/reference review, not a usability audit of Plausible’s authenticated dashboard. The opened public pages support product and policy claims, but screenshots or marketing statements do not independently prove implementation quality, legal compliance, data accuracy, or uptime. Pricing and counts can change; the pricing documentation was last updated October 29, 2026. Plausible is web analytics, while Zappa’s core scope includes developer-first acquisition and revenue attribution, so feature parallels are partial.

## Sources

[1] [Plausible Analytics homepage](https://plausible.io/) — positioning, stated features, homepage information hierarchy, live demo, and displayed plan features.

[2] [Privacy-focused web analytics](https://plausible.io/privacy-focused-web-analytics) — stated privacy model, data collection, identifiers, ownership, hosting, open source, and trial claims.

[3] [Plausible pricing and subscription plans](https://plausible.io/docs/subscription-plans) — trial/access terms, billing model, plan segmentation, usage basis, and enterprise access.

[4] [About Plausible](https://plausible.io/about) — stated independence, open-source status, subscription funding, company positioning, and privacy intent.
