# Ticket 107: Bounded and Truthful DOM Evidence

**Sprint:** 1 — Inspect One Page  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** M

## Context

The first collector persists several unbounded DOM values: Open Graph/Twitter
arrays, alternate links, and arbitrary meta content. `Evidence.value` is also
declared as `unknown`, so a valid session does not prove that captured DOM facts
have their promised shape. Most importantly, JSON-LD that exceeds the capture
budget is sliced and then parsed; the incomplete string can create a false
`jsonld-malformed` finding. The current image-alt rule also cannot determine
whether an empty `alt` is a valid decorative-image decision.

## Goal

Make persisted DOM evidence size-bounded, schema-valid, and semantically honest
when collection is partial.

## Acceptance criteria

- [x] Define versioned Zod schemas for each Sprint 1 DOM evidence payload and
  validate collector output before it is saved; reject/quarantine malformed
  payloads with a readable capture error.
- [x] When the evidence schema version changes, migrate representative existing
  version-1 sessions in place (or preserve them as readable historical records)
  rather than quarantining every prior audit solely because this ticket landed.
- [x] Apply documented per-field limits for string length, item count, and total
  snapshot/session bytes to all DOM payloads—not only JSON-LD—and retain a
  `truncated`/limit reason as evidence when a cap is reached.
- [x] JSON-LD that is incomplete because of a configured cap has parse status
  `truncated` (not `invalid-json`) and cannot emit `jsonld-malformed`; complete
  invalid JSON still emits the existing finding.
- [x] Split missing `alt` from intentionally empty `alt`: report missing
  attributes, preserve the empty-alt count as an advisory fact, and do not call
  decorative images defective without evidence.
- [x] Accept only HTTP(S) canonical/alternate targets for SEO URL checks, and
  parse robots directives as comma/whitespace-delimited tokens (including
  `none`) rather than matching `noindex`/`nofollow` substrings.
- [x] Re-check the active tab/final captured URL around injection and record a
  navigation-race capture error if the page changed during collection.
- [x] Add adversarial fixtures for oversized meta/OG/Twitter/hreflang/JSON-LD,
  a budget-truncated valid JSON document, empty vs absent alt, and navigation
  change; `npm test` passes with stable finding snapshots.

## Out of scope

- Header, robots, sitemap, or render capture.
- Storing full page HTML to work around collection limits.
- Semantic schema validation of every structured-data vocabulary (Ticket 208).

## Dependencies

- **Blocks:** 199, 204, 208, 402
- **Blocked by:** 102–104
- **External:** none

## Approach

Treat every bound as part of the evidence contract and export it with the
capture. A partial capture is useful, but it must not be mistaken for malformed
publisher markup or complete source coverage.

## Notes / decisions log

- 2026-07-12 — Filed by the post-Sprint-1 audit. The current JSON-LD collector
  parses an intentionally sliced string and can therefore produce a false
  malformed-data finding.
- 2026-07-12 — Bumped `AUDIT_SCHEMA_VERSION` to 2 with in-place v1→v2 migration
  that attaches documented `captureLimits`. Truncated JSON-LD skips parse.
  Missing alt is a warning; empty alt is info-only. Robots directives are
  tokenised; `none` maps to noindex+nofollow. Non-HTTP(S) canonical/hreflang
  targets fail SEO URL checks. Navigation races become `CaptureError`s.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
