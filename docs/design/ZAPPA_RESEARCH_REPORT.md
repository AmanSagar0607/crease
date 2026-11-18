# Zappa product-design research

## Market fit

Zappa serves independent SaaS founders and developers who need to connect acquisition sources and product actions to paying customers, so a calm analytics workspace that makes the path to revenue understandable fits the product’s audience [1] [5] [13] [16]. Across the analytics products reviewed, a useful pattern is to explain analytics in plain language, connect top-line measures to acquisition and conversion evidence, and show product UI rather than asking people to trust abstract claims [1] [10] [14] [17] [21] [29]. Zappa can differentiate through developer-legible setup and evidence-aware attribution, provided every privacy, accuracy, and security statement describes verified Zappa behavior rather than borrowing a competitor’s claims.

## Trust checklist

This is a design and product review checklist; it does not assert that Zappa already meets these conditions.

- [ ] Explain what Zappa collects, why, where it is processed and stored, retention, deletion, and third-party processing using verified implementation and policy details. Put the explanation near setup and relevant data controls.
- [ ] Make data provenance visible: distinguish observed source, attributed source, unknown source, and verified revenue. Never imply causation or fabricate missing data. The [previous Zappa design baseline](ZAPPA_DESIGN_SYSTEM.md) says revenue should remain absent or unavailable until defensible server-to-server monetary data and linkage exist.
- [ ] Describe SDK/API event inputs, identity/linkage behavior, attribution windows, and limitations in developer docs. Explain privacy and attribution trade-offs together; DataFast’s docs illustrate why identifier mode affects what can be linked [15].
- [ ] Make access and sharing boundaries legible: who can see a project/report, whether a link is public or private, permissions, revocation, and expiry/password controls where supported. Fathom documents concrete sharing controls [8].
- [ ] Provide account/project controls for access, export/deletion, and key management only where supported; explain consequences before destructive actions.
- [ ] Keep loading, empty, unavailable, permission-denied, and error states distinct. Clearly label sample data and never imply that demo figures are actual Zappa events.
- [ ] State Zappa’s actual pricing, usage limits, retention, trial/card terms, and upgrade consequences once confirmed. Competitor terms are mutable and are not a pricing recommendation [3] [6] [11] [18] [22] [25] [31] [34].
- [ ] Publish only Zappa security, privacy, compliance, hosting, and certification claims that have been verified. Competitor statements are not evidence of Zappa controls [2] [7] [12] [19] [23] [27] [30].
- [ ] Target WCAG 2.2 AA with accessible contrast, visible focus, keyboard operation, screen-reader descriptions and chart alternatives, announced form errors, reduced motion, and color-independent status.

## Eight design decisions

1. **Use warm cream for marketing and light-theme surfaces, near-black for the app and inverse sections, and orange-red for meaningful emphasis.** This follows the requested direction and the broad visual cues in the supplied Zernio screenshot without copying its layout, text, or assets. Trade-off: a shared semantic token system must make the marketing and application surfaces feel related without flattening light/dark differences.
2. **Use Geist Sans and Geist Mono with tabular numerals.** Keep the user’s requested 72/44px responsive H1, 17px body text, 15px navigation/controls, and 13px minimum text except 12px chart axes. Trade-off: the scale needs fluid line wrapping on smaller screens; Mono belongs in code and technical data, not long prose.
3. **Organize reports around an evidence path: acquisition → behavior/conversion → revenue.** Competitor pages and docs emphasize practical tasks such as traffic sources, funnels, goals, and monetary outcomes [1] [10] [14] [16] [21]. Trade-off: this hierarchy must not hide existing reports or overstate causal attribution.
4. **Show real Zappa UI early on the landing page and link summary metrics to report evidence.** A live preview or labeled sample view makes the product tangible; several references expose demos or concrete reporting workflows [1] [20] [29]. Trade-off: previews need maintenance, clear sample-data labels, and no fabricated customer proof.
5. **Keep the application shell attached and stable: 248px/64px sidebar, 56px topbar, one project switcher, and a pinned account menu.** This supports dense reporting while preserving room for the centered 1120px content frame. Trade-off: smaller laptop widths need a clear compact state, a single navigation scroll region, and a usable mobile drawer.
6. **Use a 1080px marketing frame and a 1120px app frame with fluid gutters.** Keep the floating glass marketing navigation and product-led page rhythm, then reduce columns before text or charts become cramped. Trade-off: wide-screen balance must not create horizontal overflow at 375px or 768px.
7. **Standardize controls and data states using shadcn/ui, shadcn charts, and Lucide.** Use the same accessible button, field, popover, chart, table, empty, loading, and error patterns across pages. Trade-off: components need Zappa semantic styling and explicit state QA; do not substitute native selects or invented primitives.
8. **Use Motion and next-themes for controlled feedback and system/light/dark preference.** Use the requested short spring interactions, press feedback, one-time fade-up, count-up, and chart draw only when they aid orientation; respect reduced motion. Trade-off: motion must never imply live data changes or delay task completion.

## Reference comparison notes

- **Plausible:** plain-language analytics positioning, capability grouping, privacy explanations, and a discoverable demo are useful ideas. Its privacy, hosting, and business-model statements are specific to Plausible [1] [2] [4].
- **Fathom:** links practical analytics tasks to filters, campaigns, events, monetary values, and documented sharing controls. Its product and privacy claims are not Zappa claims [5] [8].
- **Umami:** groups its public capability story around acquisition, behavior, conversion/revenue, privacy, collaboration, and deployment. This is useful information architecture, not a basis for transferring its policies or pricing [9] [10] [11] [12].
- **DataFast:** uses a revenue-first narrative and a setup → revenue connection → funnel-analysis path. Its tracking docs make attribution trade-offs explicit; no price amount is asserted because the pricing page content was not extractable in this research [13] [14] [15].
- **PostHog:** suggests an evidence trail from a trend or funnel to deeper investigation, and explicitly documents event inputs and access surfaces. Its broad product scope and policies are not Zappa requirements [16] [17] [19].
- **Zernio:** is a developer-oriented API reference, not an analytics competitor. The user-supplied full-page screenshot shows a warm-light marketing canvas, orange-red emphasis, repeated product UI examples, and a dark code/API section; its official API page also foregrounds setup, platform coverage, and developer resources [20] [21]. Treat screenshot-only observations as visual direction, not product facts.
- **Linear:** shows a concise capability narrative and explicit security/privacy documentation. Apply the clarity, not its issue-management model or its security claims [24] [26] [27].
- **Stripe:** is a reference for decision-oriented reports, filters, configurable surfaces, and paths from summaries to evidence. Its scale, controls, payment workflows, and commercial terms do not transfer to Zappa [28] [29] [30].
- **Mobbin:** is a reference library rather than a competitor. Its public pages describe browsing screens, UI elements, and flows in context [32] [33]. The Mobbin screen-search connector itself returned a paid-plan restriction in this session; no upgrade was made and no specific Mobbin screen is cited or claimed to have been inspected.

## No-copy note

Use the sources only for general interaction and information-architecture principles. Do not reproduce competitors’ wording, marks, illustrations, assets, distinctive layouts, or sample metrics. Zappa’s own brand direction, real product data, verified policies, and existing technical contracts govern the implementation. The attached Zernio screenshot is a visual reference only; its text and assets are not to be copied. No research source failed; DataFast pricing details were not extractable, and Mobbin’s screen-search connector was unavailable on the current plan.

## References

[1]: https://plausible.io/ "Plausible Analytics homepage"
[2]: https://plausible.io/privacy-focused-web-analytics "Plausible privacy-focused web analytics"
[3]: https://plausible.io/docs/subscription-plans "Plausible subscription plans"
[4]: https://plausible.io/about "About Plausible"
[5]: https://usefathom.com/features "Fathom Analytics features"
[6]: https://usefathom.com/pricing "Fathom Analytics pricing"
[7]: https://usefathom.com/legal/privacy "Fathom privacy policy"
[8]: https://usefathom.com/docs/features/shared-dashboards "Fathom shared dashboards"
[9]: https://umami.is/ "Umami homepage"
[10]: https://umami.is/platform "Umami platform overview"
[11]: https://umami.is/pricing "Umami cloud pricing"
[12]: https://umami.is/security "Umami security and data protection"
[13]: https://datafa.st/ "DataFast homepage"
[14]: https://datafa.st/docs/conversion-funnels "DataFast conversion funnels documentation"
[15]: https://datafa.st/docs/gdpr-cookieless-tracking "DataFast cookieless tracking documentation"
[16]: https://posthog.com/product-analytics "PostHog product analytics"
[17]: https://posthog.com/docs/product-analytics "PostHog product analytics documentation"
[18]: https://posthog.com/pricing "PostHog pricing"
[19]: https://posthog.com/privacy "PostHog privacy policy"
[20]: https://zernio.com/ "Zernio homepage"
[21]: https://zernio.com/social-media-api "Zernio social media API"
[22]: https://zernio.com/pricing "Zernio pricing"
[23]: https://zernio.com/privacy-policy "Zernio privacy policy"
[24]: https://linear.app/ "Linear homepage"
[25]: https://linear.app/pricing "Linear pricing"
[26]: https://linear.app/security "Linear security"
[27]: https://linear.app/privacy "Linear privacy policy"
[28]: https://stripe.com/sigma "Stripe Sigma"
[29]: https://docs.stripe.com/dashboard/basics "Stripe web Dashboard"
[30]: https://docs.stripe.com/security "Stripe security"
[31]: https://stripe.com/pricing "Stripe pricing and fees"
[32]: https://mobbin.com/ "Mobbin homepage"
[33]: https://mobbin.com/explore/web "Mobbin web exploration"
[34]: https://mobbin.com/pricing "Mobbin pricing"
