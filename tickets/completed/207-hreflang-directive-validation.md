# Ticket 207: Hreflang Directive Validation

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** M

## Context

Sprint 1 only flags alternate `href` values that fail URL resolution. That does
not validate the `hreflang` value itself, empty values, duplicate language/
region pairs, `x-default`, or consistency between HTML and sitemap annotations.
The original specification explicitly calls for hreflang analysis.

Live fetch of alternate pages (Hreflang Pro page-cluster mode) is wanted but
owned by Ticket 213 — this ticket validates **already captured** evidence.

## Goal

Evaluate HTML and selected sitemap hreflang declarations with standards-based,
evidence-backed findings.

## Acceptance criteria

- [x] Parse and normalise BCP 47 language tags plus the special `x-default`
  value; flag missing/invalid codes, malformed language-region combinations,
  and duplicate targets deterministically.
- [x] Treat empty href and self-resolving empty attributes as invalid directive
  evidence rather than valid alternatives.
- [x] Compare same-page HTML alternates with sitemap `xhtml:link` annotations
  when both captures exist, reporting mismatches as partial evidence—not proof
  that a reciprocal target is missing on the live web.
- [x] Add findings/source references for invalid language, duplicate alternate,
  invalid target, and HTML/sitemap mismatch, each linked to the exact captured
  evidence item.
- [x] Fixture tests cover language-only, language-region, x-default, invalid
  values, duplicates, empty href, relative URLs, and partial/missing sitemap
  data.

## Out of scope

- Opt-in fetch of every alternate URL to prove live reciprocity (Ticket 213).
- Locale-content quality or automatic hreflang generation.
- Twemoji / score / matrix UI from Hreflang Pro.

## Dependencies

- **Blocks:** 204, 205, 213, 402
- **Blocked by:** 103, 203, 206
- **External:** authoritative BCP 47 parsing/reference data decision

## Approach

### Duplicate from `hreflang-pro` (validation logic — rewrite in TypeScript)

Source: `hreflang-pro/popup.js`. Port as pure rules + fixtures.

| Source | Port into |
|---|---|
| `validateHreflangValue` (`x-default`, lang, region) | `src/lib/hreflang/validate-tag.ts` |
| `VALID_LANGS` / `VALID_REGIONS` allowlists | `src/lib/hreflang/codes.ts` (seed until BCP 47 decision) |
| `TYPO_MAP` (`en-uk→en-gb`, `zh-cn→zh-hans`, …) | same; emit as recommendation evidence, not silent rewrite |
| Duplicate hreflang-value detection per page/entry | findings rule |
| Sitemap-only structural checks: missing self-ref, missing return **among captured entries**, orphan alternate targets, missing `x-default` | findings that cite sitemap evidence only |
| HTML ↔ sitemap `(hreflang, href)` mismatch compare | `src/lib/hreflang/compare-sources.ts`; mismatch = partial evidence |
| `normalizeUrl` (strip trailing slash; keep origin+path+search) | shared helper used by compare + membership |

Pending external decision: keep allowlists as interim, or replace/augment with
real BCP 47 parsing before calling language validation “done”.

Live page-cluster crawl behaviour from Hreflang Pro → Ticket 213 (not here).

## Notes / decisions log

- 2026-07-13 — Plunder pass: structural validation marked for duplication here;
  product also wants live page-cluster validation → filed Ticket 213.
- 2026-07-13 — Structural hreflang validation on captured HTML/sitemap evidence; interim lang/region allowlists.
