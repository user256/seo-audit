# Ticket 102: Audit Data Contract and Local Session Store

**Sprint:** 1 — Inspect One Page  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

Raw DOM values, network observations, and rule results must not blur together.
Without a versioned contract, exports and historical sessions will break as the
extension gains features.

## Goal

Persist versioned, local audit sessions whose evidence and findings validate
independently.

## Acceptance criteria

- [ ] Define documented schemas/types for `AuditSession`, `PageSnapshot`,
  `Evidence`, `Finding`, and `CaptureError`; findings include all fields in the
  specification plus a stable `ruleId` and capture timestamp.
- [ ] Save, retrieve, list, and delete sessions through one repository module
  backed by IndexedDB; a storage migration/version strategy is documented.
- [ ] A session records browser tab URL, final URL, capture time, extension
  version, and feature availability without storing cookies, request bodies, or
  credentials.
- [ ] Invalid records and schema-version mismatches are quarantined as readable
  errors rather than crashing the side panel.
- [ ] Unit tests exercise round trips, migration, and invalid-data handling via
  fake IndexedDB; `npm test` passes.

## Out of scope

- Cross-device sync or account login.
- Full HTML-body retention by default.
- Export formatting.

## Dependencies

- **Blocks:** 103–106, 201–404
- **Blocked by:** 101
- **External:** none

## Approach

Keep a compact normalised record in IndexedDB and retain only the evidence
needed to support each result. Treat unavailable capture sources as explicit
`CaptureError` records, not null findings.

