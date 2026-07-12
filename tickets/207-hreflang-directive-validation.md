# Ticket 207: Hreflang Directive Validation

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

Sprint 1 only flags alternate `href` values that fail URL resolution. That does
not validate the `hreflang` value itself, empty values, duplicate language/
region pairs, `x-default`, or consistency between HTML and sitemap annotations.
The original specification explicitly calls for hreflang analysis.

## Goal

Evaluate HTML and selected sitemap hreflang declarations with standards-based,
evidence-backed findings.

## Acceptance criteria

- [ ] Parse and normalise BCP 47 language tags plus the special `x-default`
  value; flag missing/invalid codes, malformed language-region combinations,
  and duplicate targets deterministically.
- [ ] Treat empty href and self-resolving empty attributes as invalid directive
  evidence rather than valid alternatives.
- [ ] Compare same-page HTML alternates with sitemap `xhtml:link` annotations
  when both captures exist, reporting mismatches as partial evidence—not proof
  that a reciprocal target is missing.
- [ ] Add findings/source references for invalid language, duplicate alternate,
  invalid target, and HTML/sitemap mismatch, each linked to the exact captured
  evidence item.
- [ ] Fixture tests cover language-only, language-region, x-default, invalid
  values, duplicates, empty href, relative URLs, and partial/missing sitemap
  data.

## Out of scope

- Fetching every alternate URL to prove reciprocal implementation.
- Locale-content quality or automatic hreflang generation.

## Dependencies

- **Blocks:** 204, 205, 402
- **Blocked by:** 103, 203, 206
- **External:** authoritative BCP 47 parsing/reference data decision

