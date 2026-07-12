# Ticket 303: CSS and JavaScript Comparison Experiment

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** L

## Context

“CSS/JS off” changes the page and may require a reload. It can expose
client-rendering dependencies, but must preserve the original page state and
explain exactly what was measured.

## Goal

Offer an opt-in, reversible comparison that measures normal content against a
documented CSS-disabled and/or JavaScript-disabled method.

## Acceptance criteria

- [ ] Write a technical design validating Chrome APIs and browser support before
  implementation; it states whether CSS hiding/injection, content settings, or
  a separate tab is used and what it cannot measure.
- [ ] The user sees a pre-run disclosure, reload/new-tab effect, affected origin,
  and restore action; no experiment runs automatically.
- [ ] Capture normal and experiment snapshots with the same DOM collector and
  compare visible text, headings, links, metadata, and structured data using
  bounded deterministic diffs.
- [ ] JavaScript-content-setting changes, if adopted, are scoped to the minimum
  origin/path Chrome permits, restored on completion/error, and covered by a
  manual recovery path; otherwise the feature is deliberately omitted.
- [ ] Tests cover comparison output and state restoration; manual Chrome matrix
  documents reload, permission, and failure behaviour.

## Out of scope

- Claiming a raw server-response comparison.
- Silent changes to browser content settings.
- Interaction, scrolling, or auth flows.

## Dependencies

- **Blocks:** 399
- **Blocked by:** 103, 299
- **External:** Chrome content-settings capability decision

