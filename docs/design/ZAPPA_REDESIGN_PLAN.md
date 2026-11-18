# Zappa dashboard redesign plan

**Mode:** Dashboard redesign/overhaul, guided by the user-supplied detailed specification and public Mobbin skills workflow. The connected Mobbin reference search did not return saved product screens in this session, so no screenshot is represented as a Mobbin-derived reference. The supplied design and repository are the actual sources of truth.

**Scope:** Modernize the authenticated project dashboard’s application shell, sidebar, overview hierarchy, reporting toolbar, cards, charts, and responsive behavior. Preserve analytics values, loading/error/empty states, feature actions, project identity, tracking SDK behavior, SDK package name, `/crease.js`, API paths, and existing hash routes.

**Visual direction:** Analytics surface uses the supplied dark palette (`#161513` background, `#1E1C1A` surface, `#262320` raised surface, `#34302B` border, `#F2EFE8` text, `#A29D91` muted text, `#E07A52` terracotta reserved for primary actions, active indicator, and the sessions line). The public marketing page retains its previously approved cream/terracotta Zappa identity.

**Shell:** Desktop uses an attached 248px sidebar and 56px top bar in a two-column grid; the collapsed rail is 64px and localStorage-backed. Dashboard data content is centered at 1120px and recenters as the rail collapses. Below 1024px the sidebar becomes the existing full-width drawer. Only its nav list scrolls; the switcher and account menu remain pinned. One project switcher owns the All websites destination; account settings and logout live in an account menu.

**Overview:** Keep all seven existing metrics but present four primary metrics and a three-item secondary strip, avoiding an orphaned grid cell. Preserve top pages, acquisition, campaigns, recent events, countries/devices, and revenue availability. Use one reporting-window control surface, accessible filter popover, readable chart ticks/legend, and an explicit sparse-activity state. Do not fabricate data or functionality. Do not label UTC calendar-day reporting as a rolling 24-hour window. The supported 90-day and yesterday presets remain available.

**Compatibility:** Preserve all section IDs, labels, auth/account routes, API contracts and tracking identifiers. Do not invent a Share action when no shareable reporting feature exists. Add Website can navigate to the existing project-creation flow. Funnel requests with two steps use the deployed stable `/funnel` API; 3–5-step funnels still require backend deployment support. The client no longer silently duplicates a single observed event into two default steps.

**QA targets:** Build and run the SDK tests; verify keyboard/focus behavior, arrow-key nav, escape/outside-close behavior, no horizontal overflow, centered content, accessible touch targets and readable typography at 375, 768, 1024, 1440 and 1920px. Capture desktop/mobile screenshots after the local build. Production and backend deployments remain separate from local implementation and require the existing user authorization.

**Risk and rollback:** The breakpoint and grid-shell interaction with shadcn’s sidebar gap is the highest layout risk. Test expanded/collapsed at desktop and drawer at mobile/tablet. Revert only the dashboard UI commit if the shell misaligns; no database or event-schema migration is part of this redesign.
