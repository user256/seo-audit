# Ticket 106: Audit Workspace and Accessibility Baseline

**Sprint:** 1 — Inspect One Page  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

The side panel is the product’s primary surface. It needs to expose context,
evidence, findings, and report editing without concealing unavailable inputs.

## Goal

Deliver an accessible side-panel workflow for creating and reviewing a
single-page audit.

## Acceptance criteria

- [ ] The panel has clear states for unsupported tab, permission required,
  collecting, collected-with-errors, empty session, and saved audit.
- [ ] A user can start an audit, inspect sorted findings and their evidence,
  expand/collapse categories, open the Markdown report, and return without
  losing session state.
- [ ] Controls are keyboard-operable, have accessible names, visible focus,
  labelled severity/status colours, and status changes announced politely.
- [ ] Narrow-panel layout is usable at 320 CSS px with no clipped primary
  actions; light and dark themes meet WCAG AA contrast for body text.
- [ ] Automated accessibility checks plus a manual keyboard smoke checklist are
  included in the test/release documentation.

## Out of scope

- Historical session browser.
- Screen-reader certification.
- Crawl and rendering features.

## Dependencies

- **Blocks:** 199, 205
- **Blocked by:** 101–105
- **External:** none
