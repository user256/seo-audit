# Ticket 208: Structured Data Inventory and Validation

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Done
**Owner:** agent/ticket-208-structured-data
**Estimate:** M

## Context

The current collector safely retains JSON-LD text and can detect invalid JSON,
but a syntactically valid JSON document is not necessarily valid structured
data. The specification promises structured-data analysis, while the present
rules provide no inventory of types, graph nodes, or schema-level warnings.

## Goal

Turn complete captured JSON-LD into a bounded structured-data inventory with
clear, non-search-feature-specific validation findings.

## Acceptance criteria

- [x] For complete JSON-LD only, parse object/array/`@graph` payloads into a
  bounded inventory of node count, `@type`, `@id`, and parse/limit status;
  truncated entries remain explicitly unevaluated.
- [x] Add deterministic findings for a non-object top-level value, missing or
  malformed `@context` where required by the chosen validation policy, missing
  `@type` on graph nodes, and duplicate `@id` values within one captured graph.
- [x] Clearly distinguish generic JSON-LD/schema observations from eligibility
  for Google rich results; do not claim rich-result validity.
- [x] Preserve the raw JSON-LD evidence policy and enforce node/depth/string
  limits shared with Ticket 107.
- [x] Tests cover object, array, `@graph`, mixed types, duplicate IDs, absent
  context/type, deeply nested input, and truncated source.

## Out of scope

- Full Schema.org vocabulary validation or Rich Results Test parity.
- Remote context retrieval or executing JSON-LD.

## Dependencies

- **Blocks:** 205, 402
- **Blocked by:** 103, 110
- **External:** generic JSON-LD validation policy/source-reference decision

## Notes / decisions log

- 2026-07-12 — Added a bounded, vocabulary-neutral inventory for complete
  captured JSON-LD only. It evaluates at most 200 object nodes to depth 20 and
  reuses the DOM string cap for retained `@type`/`@id` values. Truncated text is
  explicitly unevaluated; no contexts are fetched and no rich-result eligibility
  is claimed.
