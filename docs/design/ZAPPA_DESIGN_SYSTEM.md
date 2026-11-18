# Zappa design system

> **Historical baseline:** This pre-redesign dark-theme specification is superseded by the root [DESIGN.md](../../DESIGN.md) and [research report](ZAPPA_RESEARCH_REPORT.md). Use those documents for current tokens and implementation; values below are retained only for project history.

## Product identity

**Positioning:** Revenue and acquisition analytics for SaaS founders, indie hackers, and developers who need to understand which traffic and product actions create paying customers.\
**Tagline:** Know what drives your growth.\
**Personality:** Precise, calm, developer-minded.\
**Voice:** Direct and evidence-aware. Say “No revenue records yet” rather than imply sales. Say “Observed source” rather than overstate attribution.

The signed-off interface uses the text wordmark **Zappa**. Existing package names, public tracker filenames, project IDs and write-key prefixes stay stable for compatibility; they are not the customer-facing brand mark.

## Design read

- **Artifact:** revenue analytics web dashboard and account/project flows.
- **Audience:** independent SaaS founders and developers making acquisition decisions.
- **Visual language:** restrained, near-black data workspace with warm neutrals and a small coral emphasis; compact but highly scannable.
- **Mode:** redesign-preserve / rebrand.
- **Calibration:** variance 3/10, motion 2/10, density 8/10, imagery 2/10, existing visual fidelity 7/10 (brand naming is the approved exception).

## Design positioning questions

- **Narrative role:** the overview is a decision surface; detailed pages are evidence/report surfaces.
- **Viewing distance:** laptop-first, with functional tablet and mobile reflow.
- **Visual temperature:** measured and trustworthy, not celebratory or “AI-generated.”
- **Capacity:** chart, KPI row, acquisition preview and a page/report preview must remain clear above the fold; secondary tables can continue below it.

## Tokens

Reuse existing Geist where available. The existing dark dashboard values are the starting point and must be applied as semantic roles, not scattered literals.

```css
:root {
  --zappa-background: #0b0b0b;
  --zappa-surface: #111110;
  --zappa-surface-raised: #171715;
  --zappa-surface-hover: #1d1c1a;
  --zappa-foreground: #f2f1ec;
  --zappa-secondary: #aaa69d;
  --zappa-tertiary: #8b8881;
  --zappa-border: #282725;
  --zappa-accent: #e5816a;
  --zappa-accent-hover: #f09680;
  --zappa-success: #72c89a;
  --zappa-warning: #e3bd6f;
  --zappa-danger: #ef8c85;
  --zappa-info: #8ab4ff;
  --zappa-focus-ring: #8ab4ff;
  --zappa-font: Geist, Arial, sans-serif;
}
```

Confirm final semantic mapping from CSS and computed contrast after implementation. Low-contrast borders are for grouping, never for readable text or focus. Status uses a text label/icon in addition to color.

### Typography

- Geist, 400/500/600/700; use existing local/loaded font treatment and avoid a second font family unless code requires it.
- Dashboard body: 13–15px; labels/captions: generally 11–12px; headings: restrained and proportional; metric figures: tabular numerals.
- Scale text at 200% without clipping; do not shrink mobile type merely to fit.

### Spacing, radius and elevation

- Spacing rhythm: 8, 12, 16, 24, 32px.
- Controls and compact containers: 6–8px radius; cards and report panels: 12–16px; reserve pills for small selectors/badges where semantics support them.
- Surfaces separated mainly by spacing, tonal steps, and subtle inset borders; use shadows sparingly.
- Shared table headers, row spacing, empty states and report-toolbar controls remain consistent across sections.

### Interaction and motion

- High-quality default, hover, focus-visible, active, disabled, loading, error and empty states for interactive controls.
- Full keyboard access, named icon-only controls, Escape-to-dismiss for overlays, logical focus order, and usable mobile targets.
- Motion is limited to short, purposeful feedback (about 150–200ms); obey `prefers-reduced-motion` and do not animate dashboard numbers as decoration.
- Loading, error, permission-denied, empty-data and “feature unavailable” remain distinct states.

## Data visualization rules

Use colors only for meaningful comparison or categories; keep the chart legend, axis/tooltip values, and data summary accessible. Chart descriptions and tabular alternatives should expose exact observed values. Missing geographic/source data is displayed as unknown, not interpolated. Never show public-demo figures as Zappa events. Revenue is absent/unavailable until verified server-to-server monetary data and defensible linkage are implemented.

## Responsive behavior

- Desktop and laptop (768px and wider): stable, collapsible project sidebar with the content and footer aligned to its configured width; compact header/control row and legible charts/tables.
- Tablet: reduce report columns where needed and preserve chart labels/readability; no page-level horizontal overflow.
- Mobile (below 768px): use the project-navigation drawer rather than a horizontal sidebar; keep its close control and trigger touch-sized, retain an Account route inside the drawer, and use readable 13px navigation labels with 44px rows.

## Accessibility baseline

Target WCAG 2.2 AA. Use semantic landmarks/headings, accessible labels, visible focus, sufficient contrast, reduced motion, screen-reader descriptions, announced form errors, and color-independent status. Include keyboard, zoom, chart alternative, and touch checks in visual QA.
