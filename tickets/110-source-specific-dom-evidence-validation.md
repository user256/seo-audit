# Ticket 110: Source-Specific DOM Evidence Validation

**Sprint:** 1 — Inspect One Page  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

Ticket 107 added a versioned DOM-evidence envelope and validates collector
output before save. Its field-state schema intentionally leaves `value` as
`unknown`, however, so an invalid title, canonical, robots, hreflang, heading,
link, image, Open Graph/Twitter, or JSON-LD payload can still cross the
collector-to-storage boundary. Several duplicate and URL string arrays are
also not bounded by the documented per-field caps.

## Goal

Make every persisted Sprint 1 DOM evidence source structurally validated and
bounded before it can be transformed, evaluated, or saved.

## Acceptance criteria

- [ ] Define discriminated, source-specific Zod schemas for every value emitted
  by `collectDomFactsInPage`, including bounded strings and item arrays.
- [ ] Apply documented item and string limits to duplicate title/meta/robots/
  canonical values and to canonical/alternate URL and hreflang strings; retain
  truthful truncation evidence.
- [ ] Validate source-specific values at collection and save boundaries, with a
  readable `dom-evidence-invalid` capture error for malformed payloads.
- [ ] Add adversarial tests for malformed source payloads and each formerly
  unbounded duplicate/URL path; retain valid historical v1 session migration.
- [ ] Update the data-contract documentation and Ticket 107’s completion note
  with the final schema version and limits.

## Out of scope

- Semantic validation of structured-data vocabularies (Ticket 208).
- Header, robots.txt, sitemap, and network evidence.

## Dependencies

- **Blocks:** 199, 204, 208, 402
- **Blocked by:** 107
- **External:** none

## Notes / decisions log

- 2026-07-12 — Filed during PR review of Ticket 107. Generic field-state
  validation is present, but per-source payload validation and several bounds
  remain incomplete.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
