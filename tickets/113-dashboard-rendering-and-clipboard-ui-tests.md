# Ticket 113: Dashboard Rendering and Clipboard UI Tests

**Sprint:** 1 — Inspect One Page  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** S

## Context

Ticket 111 added the dashboard model, bounded inventory rendering, and clipboard
actions. Its unit coverage validates the model and CSV payload format, but does
not mount `renderSeoDashboard` or exercise the rendered controls. The Sprint 1
gate needs direct UI evidence for the pre-access, populated glance, and
clipboard paths before treating Ticket 111's rendering acceptance criterion as
fully verified.

## Goal

Add deterministic DOM tests for the dashboard's visible states and clipboard
controls.

## Acceptance criteria

- [ ] Render and assert the pre-access dashboard, including honest unavailable
  status and redirect slots.
- [ ] Render a populated glance dashboard and assert bounded inventory facts,
  links, images, and visually distinct unavailable states.
- [ ] Exercise both clipboard controls with a stubbed clipboard API and assert
  their CSV payloads and accessible labels.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `npm run package:check`.

## Out of scope

- Changes to dashboard behaviour, data collection, or CSV format.
- Browser-level clipboard permission testing; this ticket covers the side-panel
  rendering and wiring in the existing JSDOM suite.

## Dependencies

- **Blocks:** 199
- **Blocked by:** 111
- **External:** none

## Notes / decisions log

- 2026-07-12 — Filed during PR #11 review. The implementation is mergeable,
  but Ticket 111's stated dashboard-rendering coverage is incomplete; retain
  this small, separately testable remediation rather than silently accepting it.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
