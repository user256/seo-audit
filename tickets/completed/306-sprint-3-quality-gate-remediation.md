# Ticket 306: Persist Sprint 3 Comparison-Runner Evidence

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** S

## Context

Tickets 301 and 302 present bounded results in the side panel, but those result
objects currently live only in panel memory. Closing or reopening the panel
loses the exact redirect/probe evidence. Ticket 301 requires the selected
variant tests to be retained, and later session comparison/export work needs a
bounded local representation of both experiments.

## Goal

Persist bounded variant-test and soft-404-probe results with their audit
session, then restore them when that session is reopened.

## Acceptance criteria

- [x] Version the local audit/session contract to store completed or cancelled
  variant-test and soft-404-probe results, including their existing caps,
  limitations, and fetch-error evidence; do not persist raw response bodies.
- [x] Save the result after each user-started run and restore it when the audit
  session is reopened in the side panel.
- [x] Add repository and UI integration coverage for save/restore, cancellation,
  and bounded-data behaviour.
- [x] Run and record passing `npm test`, `npm run lint`, `npm run build`, and
  `npm run package:check` results.

## Dependencies

- **Blocks:** 399, 401, 402
- **Blocked by:** 301, 302
- **External:** none

## Notes / decisions log
- 2026-07-13 — Session schema v4 persists bounded variant + soft-404 results; restore on panel reopen.
