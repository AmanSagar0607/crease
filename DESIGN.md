# Zappa living design brief

**Status:** Research and design-system proposal complete; application UI code has not changed in response to this new direction. The current pushed UI remains the baseline until the user confirms this system and the first v0.

## Design read

- **Artifact:** whole-product developer analytics website and authenticated dashboard.
- **Audience:** SaaS founders, indie hackers, and developers.
- **Mode:** redesign · overhaul; change layout, color, type, components, and motion while preserving features and data.
- **Visual language:** warm, editorial, developer-minded SaaS; cream/near-black surfaces, one orange-red accent, real Zappa UI, and restrained motion. The user-provided Zernio screenshot is a high-level visual reference, not a source of copy or assets.
- **Calibration:** visual variance 5/10, motion 4/10, information density 6/10, asset dependence 4/10, brand fidelity 9/10.

The landing page explains value and setup; the dashboard is a decision surface; report pages are evidence surfaces. The work is laptop-first but must remain complete on mobile. The warm palette should feel trustworthy and human without making analytics decorative.

## Semantic theme tokens

Use semantic roles only in components. The values below are the implementation starting point. Verify every text and control pairing at implementation time.

```css
:root,
[data-theme="light"] {
  color-scheme: light;
  --background: #F0EFEB;
  --surface: #FFFFFF;
  --surface-raised: #FFFFFF;
  --surface-hover: #E7E6E1;
  --foreground: #2D2D2D;
  --muted: #6B6B6B;
  --border: #D9D8D3;
  --accent: #C0391B;
  --accent-brand: #EB3514;
  --accent-foreground: #FFFFFF;
  --focus-ring: #C0391B;
  --success: #28724B;
  --warning: #79520B;
  --danger: #B33E35;
  --info: #245C9B;
}

[data-theme="dark"] {
  color-scheme: dark;
  --background: #0B0B0B;
  --surface: #141414;
  --surface-raised: #1A1A1A;
  --surface-hover: #222222;
  --foreground: #F0EFEB;
  --muted: #AAA69D;
  --border: #30302E;
  --accent: #FF5A3A;
  --accent-brand: #FF5A3A;
  --accent-foreground: #0B0B0B;
  --focus-ring: #FF765C;
  --success: #72C89A;
  --warning: #E3BD6F;
  --danger: #EF8C85;
  --info: #8AB4FF;
}

/* next-themes resolves system preference to the light or dark semantic set. */
```

The requested light accent `#EB3514` has **4.16:1** contrast against white and does not meet 4.5:1 for normal-sized text. Use the darker accessible action/link token `#C0391B` (5.47:1 on white); retain the brand hue for non-text chart emphasis where it meets the applicable graphical contrast requirement. Dark-mode `#FF5A3A` pairs with near-black foreground for filled controls. Keep status colors semantic and pair them with labels/icons; never use color alone. Theme selection is **System / Light / Dark** through `next-themes`.

Reserve the orange-red accent for primary actions, active states, links, visible focus, and the key chart line. Do not use it as decorative color for every card, badge, or chart series.

## Typography, spacing, and layout

- **Typeface:** Geist Sans for UI and prose; Geist Mono for code, identifiers, and selected data contexts. Use `font-weight: 600` for display headings and `letter-spacing: -0.02em` on large headings.
- **Scale:** H1 `clamp(44px, 6vw, 72px)`; body 17px; navigation and controls 15px; minimum 13px everywhere except chart axes at 12px. Use tabular numerals for measures and support 200% text scaling without clipping.
- **Spacing:** 8px rhythm with common steps of 8, 16, 24, 32, and 40px; use 8/12/16px radii and 999px pills for primary CTAs.
- **Frames:** marketing content max-width 1080px; app content max-width 1120px, centered with fluid side gutters.
- **Marketing navigation:** floating, lightly translucent/glass nav with one prominent pill CTA; maintain legibility and keyboard focus over both light and dark backgrounds.
- **Application shell:** attached flush-left shadcn Sidebar, 248px expanded / 64px collapsed, persisted state, Cmd/Ctrl+B shortcut, and mobile drawer. Topbar height 56px. Only the navigation list scrolls; project switcher and account/footer controls stay pinned. Show one project switcher. Keep Sign out inside the account menu. Dashboard report content is centered inside the available main column.
- **Touch and control sizing:** all mobile interactive targets at least 44px high; nav rows at least 44px. All controls need default, hover, focus-visible, active, disabled, loading, and error states as appropriate.

## Component and library rules

Use **shadcn/ui only** for UI primitives, **shadcn chart** for chart components, **Lucide React** for icons, **Motion** for motion, and **next-themes** for theme state. Keep existing Recharts data logic behind shadcn chart styling where possible. Do not add another UI library, use native `<select>` elements, or invent bespoke primitives in place of shadcn components. Style all shared components with semantic tokens; do not leave old colors or hardcoded palette values.

## Page scope

### Landing

Use the headline **“Analytics for the things you make.”**, a clear **Start free** CTA, and a developer install snippet. Show a live GitHub link and the actual repository star count only if it can be fetched accurately; never hardcode a fabricated count. Put genuine Zappa product UI near the top and label any sample-data preview. Follow with concise capability proof, a black/near-black trust section covering only verified claims (open source, cookies, data ownership, deletion must be independently verified before being stated), one pricing card, FAQ, and a founder note. Do not add stock art or copied Zernio assets/text.

### Pricing

Show one pricing card as requested. Use only Zappa’s confirmed price, usage basis, included features, limits, billing/trial/card terms, and upgrade consequences. Do not borrow any competitor price or promise. If the terms are not verified, surface an explicit “details to be confirmed” state instead of inventing numbers.

### Docs

Make SDK/API setup, event fields, attribution semantics and limitations, privacy/data lifecycle, troubleshooting, and copyable install snippets easy to find. Preserve the public tracking SDK, `/Zappa.js` path, package names, API routes/fields, project IDs, write-key prefixes, and existing documentation contracts.

### Sign-in and account

Use Clerk only, including Clerk’s supported prebuilt Next.js authentication components styled with the Zappa system. Preserve email/password, verification, Google/GitHub where enabled, password recovery, secure sessions, profile/account management, workspace membership/roles, protected dashboard routes, secure logout, and account deletion lifecycle. Do not add Supabase Auth or a parallel identity system.

### Projects list

Keep the centered project list, functional project creation, status, selection, and project-level isolation. Maintain real backend-connected data and project identifiers. Provide a useful empty/loading/error state without fabricated projects or metrics.

### Dashboard overview

Use a 24h / 7d / 30d / Custom range toggle and a Filters popover. Present four primary stat cards and a compact strip for new / returning / converted users without orphan cells. Use a 320px chart with accessible legend, tooltip, axis values and table/summary alternative. Follow with Top Pages, Acquisition, and Countries. Preserve current reporting and attribution behavior; link summary metrics to their report evidence. Label sample data where present.

### Empty, loading, unavailable, permission, and error states

Keep these states distinct. Use skeleton loading, a specific next step, and a copy action for setup snippets or IDs where appropriate. Never imply that missing, inaccessible, or unverified records exist; revenue remains absent/unavailable until defensible verified data exists.

## Motion

Use Motion with `MotionConfig reducedMotion="user"`. The requested transition target is `{ type: "spring", bounce: 0, duration: 0.4 }` for appropriate spring interactions. Button press feedback may scale to 0.97. Use a 12px fade-up with 60ms stagger once on initial view; count up figures once on first visible view; draw the chart line once. Restrict animations to transform and opacity wherever practical. Respect reduced-motion settings by removing distance, spring, count-up, and draw effects while preserving state clarity. Never imply that a value is changing in real time when the data is static.

## Accessibility and responsive behavior

Target WCAG 2.2 AA. Verify normal text at 4.5:1 and non-text/focus indicators at the appropriate contrast. Keep visible keyboard focus, semantic landmarks/headings, accessible labels, announced form errors, keyboard navigation, screen-reader descriptions and exact chart alternatives, color-independent statuses, and Escape-to-dismiss overlays. Do not rely on hover alone. Respect 200% zoom and system text scaling.

Explicit visual QA widths: **375, 768, 1024, 1440, and 1920px**. Verify no horizontal page overflow, no clipped labels, and reachable controls. At mobile/tablet use a full-width drawer with an accessible close action, Escape/outside-dismiss, focus management, and touch-friendly targets. Capture both **light and dark** screenshots after the v0 and final implementation are available.

## Protected product and data contracts

This specification changes presentation and interaction only. Preserve all existing functionality, data, acquisition reporting, revenue attribution semantics, and backend connections. Keep the existing tracking SDK and API fields, `/Zappa.js`, public package names, project IDs, and write-key prefixes. Keep Clerk as the only authentication provider; Supabase PostgreSQL/RLS remains the authorization and data boundary; do not expose secret keys or bypass RLS. Keep Vercel as the hosting target and Resend for transactional emails. Do not claim that Zappa is open source, cookie-free, privacy-certified, audited, compliant, or hosted in a particular region unless each statement is verified for Zappa.

## First implementation pass

After the user confirms this direction, prepare a viewable v0 with the landing hero/product preview and dashboard shell in the declared light/dark tokens, using actual Zappa UI and non-real/sample labeling where applicable. Show that v0 for course correction before completing the rest of the page set. Then implement pricing/docs/auth/account/project/empty states, run the existing build/tests, and capture the requested responsive light/dark screenshots.

## Research basis

The [research report](docs/design/ZAPPA_RESEARCH_REPORT.md) contains the three-sentence market fit, trust checklist, eight design decisions, nine-reference comparison, and sources. Mobbin’s public pages were researched, but its screen-search connector returned a paid-plan restriction, so no upgrade or screen-specific claims were used. The supplied Zernio screenshot was inspected only for broad visual cues and is not an asset or copy source.
