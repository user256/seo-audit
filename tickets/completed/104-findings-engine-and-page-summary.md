# Ticket 104: Findings Engine and Page Summary

**Sprint:** 1 — Inspect One Page
**Status:** Done
**Owner:** unassigned
**Estimate:** M

## Context

An inspector that only dumps metadata makes users do the audit themselves. The
first release needs deterministic rules that make clear, limited conclusions
from the DOM snapshot.

## Goal

Turn an active-page snapshot into explainable, deterministic page findings.

## Acceptance criteria

- [x] Implement pure, individually addressable rules for missing/duplicate
  title, title length advisory, missing/duplicate description, missing or
  multiple canonical, canonical resolving off-page, noindex/nofollow robots,
  invalid hreflang URL, malformed JSON-LD, missing language, and images without
  meaningful `alt` text.
- [x] Each rule returns zero or more schema-valid findings with evidence,
  severity rationale, recommendation, and a stable source/best-practice link.
- [x] The summary shows finding counts by severity and category and never
  reports “indexable” when headers or robots data were not captured.
- [x] Fixture tests cover a clean document, each triggered rule, and at least
  two conflicting signals; snapshots are deterministic.
- [x] Rule IDs and severity policy are documented in `docs/rules.md`.

## Out of scope

- Robots/header reconciliation.
- ML or LLM-generated recommendations.
- Scores presented as a search-ranking prediction.

## Dependencies

- **Blocks:** 105, 106, 204
- **Blocked by:** 102, 103
- **External:** none

## Notes / decisions log

- 2026-07-12 — “Missing data” belongs in capture status, not in a severity
  score. Rules only evaluate evidence they received.
- 2026-07-12 — `evaluatePageSnapshot` runs after DOM collect and persists
  findings on the session. Summary indexability is `unknown` /
  `signals-partial` only — never a positive “indexable” claim in Sprint 1.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
