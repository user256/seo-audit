# Ticket 102: Audit Data Contract and Local Session Store

**Sprint:** 1 — Inspect One Page
**Status:** Done
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

- [x] Define documented schemas/types for `AuditSession`, `PageSnapshot`,
  `Evidence`, `Finding`, and `CaptureError`; findings include all fields in the
  specification plus a stable `ruleId` and capture timestamp.
- [x] Save, retrieve, list, and delete sessions through one repository module
  backed by IndexedDB; a storage migration/version strategy is documented.
- [x] A session records browser tab URL, final URL, capture time, extension
  version, and feature availability without storing cookies, request bodies, or
  credentials.
- [x] Invalid records and schema-version mismatches are quarantined as readable
  errors rather than crashing the side panel.
- [x] Unit tests exercise round trips, migration, and invalid-data handling via
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

## Notes / decisions log

- 2026-07-12 — Zod schemas in `src/lib/schemas/audit.ts` (`AUDIT_SCHEMA_VERSION =
  1`); IndexedDB layout versioned separately (`DB_VERSION = 1`). Documented in
  `docs/data-contract.md`. Invalid reads move to a `quarantine` store.
- 2026-07-12 — JSON Schema derived via `zod-to-json-schema` for Ticket 402;
  runtime validation stays on Zod.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
