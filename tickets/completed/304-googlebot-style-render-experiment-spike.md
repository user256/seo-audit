# Ticket 304: Googlebot-Style Render Experiment Spike

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** Done  
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

- [x] Produce a feasibility report comparing `chrome.debugger`/CDP, ordinary
  tabs APIs, and an unsupported conclusion; include permissions, Chrome warning,
  user impact, testability, and maintenance risk.
- [x] If viable, a prototype opens a dedicated tab, attaches only after a second
  explicit confirmation, sets documented desktop viewport/UA parameters, waits
  five seconds without scroll/interaction, captures a DOM snapshot, and detaches
  in `finally`. — Not applicable: the review outcome is **defer**, so no
  prototype was built (see Notes below).
- [x] Prototype logs method/version/timestamps and clearly labels the result
  “Googlebot-style experiment—not Google rendering.” — Not applicable, same reason.
- [x] Close-tab, navigation, attach failure, timeout, and service-worker restart
  paths all detach or give the user a visible recovery control. — Documented as
  a recovery matrix in the feasibility report for if/when this is revisited;
  no live code path exists to exercise today since no prototype shipped.
- [x] Review outcome chooses **ship as experimental**, **defer**, or **reject**;
  only a shipped outcome creates product UI work. — Chose **defer**; no product
  UI work follows from this ticket.

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
- 2026-07-13 — Spike complete. **Decision: defer.** Full comparison in
  `docs/googlebot-style-experiment.md`. `chrome.debugger`/CDP is the only path
  that can honestly deliver a JS-visible user-agent override, device-metrics
  viewport emulation, and a scripted wait, but its permission cost (highest
  risk in the catalogue), unsuppressible per-run "started debugging this
  browser" banner, Chrome Web Store/enterprise-policy exposure, and
  CDP-version maintenance risk are disproportionate to the incremental signal
  over the already-shipped CSS/JS comparison (Ticket 303). Ordinary
  tabs/scripting APIs cannot override `navigator.userAgent` or emulate device
  metrics for a single tab, so they cannot honestly earn the "Googlebot-style"
  label either — the 2026-07-12 suspicion about a precise 5-second JS stop is
  confirmed, not resolved, by CDP's lack of a wall-clock-precise execution
  stop. No `debugger` permission (required or `optional_permissions`) was
  added to `manifest.config.ts`; no prototype UI ships. The decision is
  recorded in code at `src/lib/googlebot-spike/decision.ts` (tested in
  `decision.test.ts`) so it cannot silently drift from this report. Revisit
  triggers are listed in the report; until one applies, Ticket 305 should take
  its "otherwise" branch (network-probe-only UA profiles, no debugger-backed
  rendered tab) and Ticket 399 should record this as a closed defer, not a
  blocker.

