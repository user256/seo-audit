# Ticket 106: Audit Workspace and Accessibility Baseline

**Sprint:** 1 — Inspect One Page
**Status:** Done
**Owner:** unassigned
**Estimate:** M

## Context

The side panel is the product’s primary surface. It needs to expose context,
evidence, findings, and report editing without concealing unavailable inputs.

## Goal

Deliver an accessible side-panel workflow for creating and reviewing a
single-page audit.

## Acceptance criteria

- [x] The panel has clear states for unsupported tab, permission required,
  collecting, collected-with-errors, empty session, and saved audit.
- [x] A user can start an audit, inspect sorted findings and their evidence,
  expand/collapse categories, open the Markdown report, and return without
  losing session state.
- [x] Controls are keyboard-operable, have accessible names, visible focus,
  labelled severity/status colours, and status changes announced politely.
- [x] Narrow-panel layout is usable at 320 CSS px with no clipped primary
  actions; light and dark body tokens meet WCAG AA contrast (measured in
  `src/sidepanel/a11y.test.ts` — axe colour-contrast is disabled under JSDOM).
- [x] Automated accessibility checks plus a manual keyboard smoke checklist are
  included in the test/release documentation.

## Out of scope

- Historical session browser.
- Screen-reader certification.
- Crawl and rendering features.

## Dependencies

- **Blocks:** 199, 205
- **Blocked by:** 101–105
- **External:** none

## Notes / decisions log

- 2026-07-12 — Workspace phase model in `workspace-state.ts`; findings grouped
  by category with expand/collapse; report/findings navigation preserves
  session. axe-core fixture test + `docs/accessibility.md` checklist. Light/dark
  CSS variables with labelled severity chips.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
