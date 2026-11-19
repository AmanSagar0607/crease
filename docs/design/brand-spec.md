# Zappa brand spec

## Identity

- Customer-facing name: **Zappa**.
- Wordmark: text wordmark “Zappa,” previously approved by the user; do not invent a new logo mark or use another company’s assets.
- Typeface direction: Geist Sans for the wordmark and interface; Geist Mono for technical details.
- Tone: calm, direct, developer-minded, evidence-aware.

## Visual direction

- Light canvas: warm cream `#F0EFEB`; surfaces `#FFFFFF`; ink `#2D2D2D`.
- Dark canvas: near-black `#0B0B0B`; surfaces `#141414`; light ink `#F0EFEB`.
- Accent: orange-red. Use accessible semantic action colors from `DESIGN.md`; avoid the base `#EB3514` for white text where contrast is insufficient.
- Use pill styling for primary CTAs, not every control.
- No copied Zernio wording, marks, layouts, or images.

## Product imagery

- Use screenshots captured from the actual Zappa interface for product previews. If sample data is used, label it prominently as sample data and do not imply that it represents customer events.
- The user-supplied Zernio full-page screenshot is a visual-reference artifact only. It is not Zappa product imagery and must not be embedded or reused as an asset.
- Do not use stock dashboards, fabricated customer logos, fabricated testimonials, or invented metrics.

## Compatibility

Rebranding must not change package names, tracker filename `/Zappa.js`, project IDs, write-key prefixes, API fields/routes, or analytics behavior. Clerk remains the only auth provider; Supabase PostgreSQL/RLS remains the data authorization boundary.
