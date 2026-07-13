# Ticket 114: DOM Evidence Save-Boundary Enforcement

**Sprint:** 1 — Inspect One Page  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** S

## Context

Ticket 110 adds source-specific DOM-evidence validation, but persisted session
validation skips the v2 checks when a session omits the DOM-evidence version
marker or claims the historical marker. A newly created session can therefore
bypass the save boundary and retain malformed or unbounded DOM rows.

## Goal

Enforce source-specific validation for every newly saved DOM evidence record
while keeping genuinely migrated historical sessions readable.

## Acceptance criteria

- [x] A current-schema session cannot bypass DOM-evidence v2 validation by
  omitting or downgrading its capture-limit version marker.
- [x] Historical migrated sessions retain an explicit, narrowly scoped migration
  path and do not make new writes less strict.
- [x] Repository-save tests cover missing and historical-marker bypass attempts
  plus a valid migrated historical session.
- [x] Run `npm test`, `npm run lint`, `npm run build`, and `npm run package:check`.

## Out of scope

- New evidence sources or semantic rules.
- Changing documented DOM capture limits beyond enforcing the existing contract.

## Dependencies

- **Blocks:** 199, 208
- **Blocked by:** 110
- **External:** none

## Notes / decisions log

- 2026-07-12 — Filed during PR #17 review. `PageSnapshotSchema` accepts an
  avoidable save-boundary bypass when the optional version marker is absent or
  marked historical.
- 2026-07-13 — `PageSnapshotSchema` now validates unless the marker is the
  explicit historical version. `SessionRepository.save` calls
  `assertDomEvidenceSaveBoundary` so new writes with DOM evidence must declare
  version 2 (missing/downgraded markers are refused). Migrated v1 sessions remain
  readable on `get`.

---

## Definition of done

This ticket is closeable when all acceptance criteria are checked, its changes
are merged, the overview entry is completed, and any new follow-up is filed
separately.
