# Ticket 406: Theme Preference Write Ordering

**Sprint:** 4 — Durable Audits and Release Readiness  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** S

## Context

Ticket 405 applies theme edits immediately and persists them through
`chrome.storage.local`. Its saves are intentionally asynchronous and may
overlap: an earlier edit can complete after a later preset selection or Reset,
leaving stale theme data that reappears when the panel is reopened.

## Goal

Make the latest theme action authoritative in local storage, including Reset.

## Acceptance criteria

- [x] Serialize or version edit, preset, and Reset writes so a stale write
  cannot overwrite a later user action.
- [x] Reset removes the stored custom theme even when a save was already in
  flight; reopening the panel uses the shipped tokens.
- [x] Add delayed-storage tests covering rapid edits, preset selection, and
  Reset ordering.
- [x] Run and record passing `npm test`, `npm run lint`, `npm run build`, and
  `npm run package:check` results.

## Dependencies

- **Blocks:** 499
- **Blocked by:** 405
- **External:** none

## Notes / decisions log

- 2026-07-13 — Serialised theme write queue with generation checks so Reset/presets beat in-flight colour saves.
