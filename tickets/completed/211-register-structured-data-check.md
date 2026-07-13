# Ticket 211: Register the Structured-Data Check

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** S

## Context

Ticket 208 added bounded JSON-LD structural evaluation, but Ticket 209 replaced
the old rule registry with `CHECK_CATALOGUE`. The structural rule was not added
to that catalogue, so normal audits never execute it; its merged tests fail on
main for the same reason.

## Goal

Register JSON-LD structural validation in the catalogue and restore its normal
audit execution.

## Acceptance criteria

- [x] `CHECK_CATALOGUE` contains the structured-data validation descriptor.
- [x] Normal audits report structural and truncated JSON-LD observations.
- [x] The full quality gate passes.

## Dependencies

- **Blocks:** 205, 299
- **Blocked by:** 208, 209
- **External:** none

## Notes / decisions log

- 2026-07-13 — Filed during final mainline validation after PR #21. Ticket 208
  code is present but dormant in the default runner.
- 2026-07-13 — Registered `jsonld-structural-validation` in `CHECK_CATALOGUE`
  with generic JSON-LD metadata and restored both structural and truncated
  observations in normal audits. The full automated quality gate passes.
