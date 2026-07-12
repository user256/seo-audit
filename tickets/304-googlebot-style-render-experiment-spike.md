# Ticket 304: Googlebot-Style Render Experiment Spike

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** L

## Context

The specification requests a five-second Googlebot-style rendering comparison.
Chrome’s normal extension APIs do not guarantee user-agent override, viewport
emulation, or execution stopping. A spike must decide feasibility before this
becomes a product promise.

## Goal

Prove or reject a narrowly scoped, explicitly disclosed Chrome debugger-based
render experiment.

## Acceptance criteria

- [ ] Produce a feasibility report comparing `chrome.debugger`/CDP, ordinary
  tabs APIs, and an unsupported conclusion; include permissions, Chrome warning,
  user impact, testability, and maintenance risk.
- [ ] If viable, a prototype opens a dedicated tab, attaches only after a second
  explicit confirmation, sets documented desktop viewport/UA parameters, waits
  five seconds without scroll/interaction, captures a DOM snapshot, and detaches
  in `finally`.
- [ ] Prototype logs method/version/timestamps and clearly labels the result
  “Googlebot-style experiment—not Google rendering.”
- [ ] Close-tab, navigation, attach failure, timeout, and service-worker restart
  paths all detach or give the user a visible recovery control.
- [ ] Review outcome chooses **ship as experimental**, **defer**, or **reject**;
  only a shipped outcome creates product UI work.

## Out of scope

- Impersonating Google or asserting Google Search behaviour.
- Running on pages the user did not select.
- Circumventing site access controls.

## Dependencies

- **Blocks:** 305, 399
- **Blocked by:** 103, 299
- **External:** Chrome debugger permission/product decision

## Notes / decisions log

- 2026-07-12 — A five-second wait is reproducible as an extension experiment;
  “stop JavaScript precisely at five seconds” may not be safely supportable.

