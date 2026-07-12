# Ticket 115: Long-URL DOM Capture Bounds

**Sprint:** 1 — Inspect One Page  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** S

## Context

Ticket 110 caps persisted `documentUrl` and `baseUri` values at 2,000
characters, while the page collector still emits those browser-provided URLs
without a compatible policy. A valid, unusually long URL therefore fails
collection as invalid evidence. Blind truncation also risks breaking the
navigation-race identity check.

## Goal

Handle long document/base URLs without rejecting a valid capture or obscuring
the URL identity used for navigation-race detection.

## Acceptance criteria

- [ ] Define and document a URL-specific bounded representation that preserves
  an exact value where navigation-race comparison requires it.
- [ ] A valid URL longer than the generic string cap produces a saved, truthful
  bounded capture rather than `dom-evidence-invalid`.
- [ ] Tests cover long `documentUrl` and `baseUri` values plus navigation-race
  comparison behaviour.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `npm run package:check`.

## Out of scope

- Raising every string limit or changing URL normalisation rules.
- Network navigation/redirect capture (Tickets 201 and 206).

## Dependencies

- **Blocks:** 199
- **Blocked by:** 110
- **External:** none

## Notes / decisions log

- 2026-07-12 — Filed during PR #17 review. The 2,000-character schema cap and
  uncapped browser collector disagree; this is a narrow correctness remediation.

---

## Definition of done

This ticket is closeable when all acceptance criteria are checked, its changes
are merged, the overview entry is completed, and any new follow-up is filed
separately.
