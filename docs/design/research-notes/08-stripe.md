# Stripe — design reference evidence

**Reference:** Stripe (stripe.com) — product and documentation surfaces, with Stripe Sigma as the closest analytics-product example. This is a single reference, not an analytics competitor comparison.

## Verified product facts

Stripe Sigma positions itself as a way to explore and analyze Stripe data in the Dashboard or with agents. Its official page describes custom reports built with SQL, templates, or an AI assistant; charts; programmatic queries through a Queries API; and sharing, publishing, and scheduling reports. These are Stripe Sigma capabilities, not claims about Zappa. [1]

Stripe’s Dashboard documentation describes a sidebar organized around account resources and product areas. Home includes business performance analytics and charts, with configurable widgets. Reporting supports filters and custom columns, exports, and specialized product analytics; Sigma supplies an interactive SQL environment for more customized reports. [2]

Stripe’s security documentation states Stripe’s own security posture and controls, including PCI Service Provider Level 1 certification, annual SOC 1 and SOC 2 Type II reporting, public SOC 3, MFA options, role-based access, audit logs, HTTPS/TLS, and encryption practices. These are Stripe claims and certifications; they must not be implied for Zappa. [3]

Stripe’s general pricing page states that Standard payments pricing is pay-as-you-go, with no setup or monthly fees, and lists a domestic-card transaction rate; it also presents custom pricing for large-volume or unusual businesses. This page does not establish Stripe Sigma’s standalone price or a Zappa pricing precedent. [4]

## Observed design and interaction patterns

The official Sigma marketing page presents a progression from a concise value proposition to task-oriented use cases, custom-report creation, schema discovery, collaboration, and calls to action. Its sample query/schema imagery communicates a real analytical workflow rather than generic abstract dashboard art. This is an observation of the page’s structure, not evidence about the authenticated Dashboard’s current visual design. [1]

Dashboard docs describe a broad, persistent navigation model, a configurable overview, filters and exports on transaction and reporting surfaces, shortcuts for pinned/recent pages, and keyboard shortcuts. These are useful interaction patterns to consider, not requirements to reproduce verbatim. [2]

## Safe application to Zappa

Borrow the clarity of a decision-oriented overview, task-specific report navigation, visible filtering/export affordances where supported, and direct paths from metrics to their underlying evidence. Use genuine Zappa product UI and actual data states; keep observed-source attribution distinct from causal claims. A small privacy/measurement explanation near collection or attribution controls can support user understanding, but it must describe Zappa’s actual behavior and policies.

Treat Stripe’s compliance, certifications, global scale, security controls, and payment-specific information as non-transferable product facts. Do not copy Stripe language, logo, illustrations, assets, or distinctive page composition. Keep Zappa’s established cream/near-black palette, single orange-red accent, Geist Sans/Mono, restrained motion, analytics and acquisition reporting, revenue attribution, SDK/API contracts, Clerk-only authentication, Supabase RLS, and Vercel hosting intact. This note informs visual and information-design choices only; it does not authorize architecture or product-scope changes.

## References

[1]: https://stripe.com/sigma "Stripe Sigma"
[2]: https://docs.stripe.com/dashboard/basics "Web Dashboard"
[3]: https://docs.stripe.com/security "Security at Stripe"
[4]: https://stripe.com/pricing "Pricing & Fees"
