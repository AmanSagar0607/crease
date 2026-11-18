# Zernio — design reference evidence

**Use as:** one developer-first SaaS reference for Zappa’s presentation and product communication—not an analytics competitor. Zernio describes its product as a developer-first REST API and hosted MCP server for publishing, scheduling, and analyzing content across platforms, with a common authentication model and request shape. Its homepage foregrounds quick start, API resources, authentication, and pricing, making the integration surface legible to technical buyers. [1]

**Observed design patterns:** The user-supplied full-page screenshot shows a long, mostly warm-light marketing page, orange-red emphasis, repeated product UI examples, a dark code/API section, and later trust/social-proof and FAQ content. It suggests a sequence from positioning to product proof to implementation. These are broad visual observations only; no screenshot text is transcribed or treated as official product facts. Zernio’s API landing page, opened directly, likewise presents a short promise and action links, then platform coverage, a three-step onboarding walkthrough, feature examples, and FAQ. The page contains UI examples and sample metrics; do not present them as independently verified customer data. [2]

**Stated product and access facts:** Zernio’s homepage states that its API provides per-post and per-account engagement, reach, and follower metrics. It also documents Bearer API keys and OAuth 2.1 with PKCE for third-party apps. [1] Pricing states two connected accounts free, no credit card, then usage-based account pricing; the page says features are not gated by plans and distinguishes custom enterprise terms. These are Zernio-specific commercial facts, not a model to import into Zappa. [3]

**Trust/privacy evidence:** The privacy policy names the Spanish operating company, describes categories of collected account, usage, and connected-platform data, and says payment details are handled by third-party processors rather than stored by Zernio. It says personal information is not sold, describes service-provider disclosure, and provides account controls for assistant authorization and revocation. The policy also states connected assistant data is subject to the assistant provider’s policies once transferred. Treat these as Zernio’s stated policy, not an independent security audit or assurance about Zappa. [4]

**Adapt for Zappa:** Borrow the communication pattern, not the identity or page composition: put a concrete product UI early; make acquisition reporting and revenue attribution understandable through labeled examples and states; show integration/auth details near the appropriate developer entry points; and make privacy boundaries, data sources, deletion, and attribution confidence explicit. Preserve Zappa’s existing analytics and acquisition/revenue workflows, SDK/API contracts, Clerk-only auth, Supabase RLS, and Vercel hosting. Apply Zappa’s warm cream/near-black palette, single orange-red accent, Geist Sans/Mono, and restrained motion rather than copying Zernio’s branding, assets, wording, or distinctive layout.

**Limits:** The visual review uses the supplied screenshot for broad page-level cues and official Zernio pages for product facts; it is not a live interactive walkthrough or source-code inspection. No claim is made that the screenshot represents authenticated product UI or independently verifies any displayed metric. The official privacy policy is lengthy; only the returned portions were reviewed. Mobbin screen-level search was not available in this session because the connector returned a paid-plan restriction; no upgrade was made.

## References

[1]: https://zernio.com/ "Zernio official homepage"
[2]: https://zernio.com/social-media-api "Zernio social media API"
[3]: https://zernio.com/pricing "Zernio pricing"
[4]: https://zernio.com/privacy-policy "Zernio privacy policy"
