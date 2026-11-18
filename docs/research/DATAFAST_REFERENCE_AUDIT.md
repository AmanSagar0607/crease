# DataFast reference audit

**Audit date:** 2026-11-18\
**Purpose:** Use publicly available product and dashboard evidence as UX reference for Zappa without copying DataFast branding, assets, or code.

## Observed

- `https://datafa.st/dashboard` was accessible, but it rendered an account creation/sign-in surface, not a signed-in customer dashboard. No authenticated browser session was available. The private dashboard could not be inspected.
- The public interactive demo at `https://datafa.st/demo` was accessible and exposed a dashboard for the sample site `codefa.st`. The text-rendered demo shows a website selector, a “Last 30 days” period, visitor/revenue/conversion-rate/revenue-per-visitor metrics and prior-period changes, followed by an overview containing Visitors, geography, pages, devices/technology, goals/funnel and a visitor-conversion list. It also includes live/online visitors and an AI-answer crawler/indexing report.
- The demo exposes revenue beside traffic, supporting a revenue-first rather than pageview-only hierarchy. It also links visitor-level journey/context to conversion rows. The figures shown by DataFast’s demo are their example data, not evidence about Zappa and must never be copied into Zappa production data.
- DataFast’s public homepage describes its product as revenue-first analytics and highlights web analytics, revenue attribution, goals/funnels/journeys, live visitor intelligence, install → connect revenue → grow, and a public dashboard demo.
- Public documentation presents guides for installation, UTM tracking, filters, custom goals, conversion funnels, mobile tracking, revenue attribution, and multiple SDK/platform integrations.

## Inferred design direction

The accessible surface supports a compact overview with an explicit site/time-range context, a small set of high-value KPIs, and progressive report detail below. Revenue attribution is a differentiator in the visual story, but Zappa must keep revenue unavailable until it has verified monetary events and reliable customer/visitor identity linkage. Use observed names and definitions, not the example counts.

The public page and demo do not establish every private dashboard detail. The exact component dimensions, account menu, filters, loading/error states, mobile behavior, and full report interaction patterns remain unverified. Zappa’s current product requirements and existing working UI are higher authority for those implementation decisions.

## Could not verify

- Signed-in dashboard navigation, private account/project settings, visitor detail pages, exact filtering interactions, exact empty/loading/error states, and mobile responsive behavior.
- Whether displayed public demo values, journeys, and locations are live or illustrative; treat them as demo/example content only.
- Any proprietary design tokens beyond those explicitly supplied in the project brief.

## Sources

- DataFast dashboard entry point: https://datafa.st/dashboard
- Public interactive dashboard demo: https://datafa.st/demo
- DataFast homepage: https://datafa.st/
- DataFast documentation index: https://datafa.st/docs
