# Ticket 204: Indexability Reconciliation Rules

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** M

## Context

Indexing signals arrive from source HTML, headers, robots, redirects, and
sitemaps. The extension needs to surface conflicts without asserting that it
knows a search engine’s final indexing decision.

## Goal

Produce traceable crawl/index findings by reconciling captured signals for one
audited URL.

## Acceptance criteria

- [x] Add rules for noindex in HTML/header, conflicting robots directives,
  robots-blocked URL, canonical target mismatch, redirect-chain anomalies,
  non-HTML content, and sitemap URL blocked by robots.
- [x] Every reconciliation rule names each evidence source and emits
  “insufficient data” capture status when a required source is unavailable.
- [x] UI wording uses “signal” and “observed” rather than claiming a definitive
  Google index state.
- [x] A reference matrix documents expected outcomes for common combinations of
  status, robots, meta/X-Robots, canonical, and sitemap membership.
- [x] Table-driven tests cover the reference matrix and preserve stable rule
  IDs/severities.

## Out of scope

- Predicting ranking or submitted-index status.
- Automated remediation.

## Dependencies

- **Blocks:** 205, 402
- **Blocked by:** 103, 104, 110, 201–203, 207
- **External:** none
- 2026-07-13 — Reconciliation rules + docs/indexability-matrix.md; observed-signal wording.
