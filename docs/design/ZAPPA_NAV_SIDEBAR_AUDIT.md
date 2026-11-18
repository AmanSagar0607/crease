# Zappa navigation and sidebar audit

## Scope

Reviewed the project navigation in `DashboardView`, the shared shadcn sidebar and sheet components, the 768px `useIsMobile` breakpoint, and the corresponding CSS module rules. The goal was to preserve the existing analytics routes while making desktop and mobile navigation behave consistently and improving the legibility and reachability called out by the user.

## Findings and repairs

- The React sidebar switches to a Sheet drawer below 768px, while older CSS at 760px still described a horizontal nav. Removed that conflicting mobile layout block and aligned the content/sidebar breakpoint rules to 768px.
- `SheetContent` renders a close button by default, but the sidebar explicitly hid every direct button. Restored the close button and sized it to a 44px target. The mobile header’s sidebar trigger is also 44px.
- The previous footer offset was 218px although the configured sidebar width is 240px. The expanded desktop footer now uses `var(--sidebar-width)`; the collapsed and mobile layouts continue to use zero offset.
- The mobile header hides its Account link. Added an Account link to the mobile drawer beside the user/sign-out actions; selecting a drawer link closes the drawer through the existing `ProjectNavigation` handler.
- Increased desktop nav labels to 14px and drawer labels to 13px, raised drawer rows to 44px, and increased compact workspace/caption text. Mobile active-state styling now uses the same vertical accent treatment as desktop rather than a horizontal-tab marker.

## Verification

- `npm run build` — passed after the navigation changes.
- `node --test sdk/crease.test.cjs` — 8 tests passed.
- Python syntax checks and `git diff --check` — passed.
- This was a source-level responsive audit, not an authenticated visual browser acceptance run. A Clerk-authenticated dashboard session/test account was not available in the local QA context, so no dashboard screenshot is claimed.

## Mobbin reference status

The user-linked [Mobbin skills repository](https://github.com/mobbin/skills) is workflow documentation; it is not a set of UI reference screens. No Mobbin screen result is cited for the changes above. The edits are based on the repository’s actual sidebar implementation and the project’s accessibility/design-system requirements. A later reference-led pass can cite specific Mobbin screens if usable Mobbin MCP screen results are available.
