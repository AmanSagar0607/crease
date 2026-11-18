# PostHog — reference evidence

**Reference:** PostHog (posthog.com), reviewed 2026-11-18. One official product reference; the supplied Zernio screenshot was inspected only as visual context and is not a PostHog source or basis for product claims.

## Positioning and verifiable facts

PostHog presents Product Analytics as a way to turn product behavior into actionable answers. Its official page describes autocapture for pageviews, clicks, and form submissions, alongside trends, funnels, retention, paths, SQL, dashboards, and links from data points to session recordings. It names engineers, product managers, growth engineers, founders, and support engineers as relevant roles. The docs say insights can be saved/shared on dashboards and alerts set on metrics; the same events, persons, and properties are shared across related products, and users can work in the web app, MCP clients, or API. [1] [2]

Pricing is published as usage-based by product. The pricing page currently states a monthly free allowance including 1M analytics events, no credit card for free signup, one project and one-year event retention on the free plan, plus usage controls; these are PostHog-specific facts and should not be implied for Zappa. [3]

PostHog’s privacy policy states it collects technical and visit information, including IP/device information and viewed/interacted content, and says it does not use third-party cookies. It also describes aggregate usage collection from self-managed instances with an opt-out. This is a description of PostHog’s own practices, not a privacy assurance that can be transferred to Zappa. [4]

## Observed patterns and safe adaptation

The product page’s information architecture moves from a clear product proposition and primary install/get-started actions to audience/use cases, interaction surfaces, concrete feature explanations, a comparison section, FAQ/help routes, and another conversion point. It exposes action routes near relevant content (docs, demo, install) and describes drill-through from a metric/funnel step to supporting session evidence. The documentation organizes analytics around data inputs (events, autocapture, identity, properties) and output/work surfaces (web app, MCP, API). These are observed content/layout patterns, not claims about the exact in-app dashboard UI.

For Zappa, adapt the scannable progression from metric → breakdown/funnel → underlying evidence, explicit source/event semantics, and clear help/API routes. Keep Zappa’s real dashboard and acquisition/revenue reports primary, preserve its SDK/API contracts, Clerk-only auth, Supabase RLS, and Vercel hosting. Use its signed-off cream/near-black palette, restrained orange-red accent, Geist Sans/Mono, and purposeful low-motion feedback. Make privacy and attribution limits explicit in Zappa’s own terms; do not import PostHog’s autocapture, product bundling, pricing, analytics scope, or privacy practices as assumptions. Do not reproduce PostHog wording, marks, assets, or distinctive compositions.

## Limitations

Official pages were accessible and opened. Product page and docs support the product claims; pricing and privacy are mutable first-party pages. The screenshot contextualizes a separate Zernio site only; its text was not used as factual evidence. The research establishes no PostHog claims about Zappa or Zernio. Design observations are from the accessible product/docs page structure, not a live authenticated application review.

## References

[1]: https://posthog.com/product-analytics "PostHog Product Analytics"
[2]: https://posthog.com/docs/product-analytics "PostHog Product Analytics Docs"
[3]: https://posthog.com/pricing "PostHog Pricing"
[4]: https://posthog.com/privacy "PostHog Privacy Policy"
