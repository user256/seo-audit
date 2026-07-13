# Ticket 202: Robots.txt Fetch, Parser, and Evaluator

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** L

## Context

Robots directives are site-wide evidence and must be distinguished from page
metadata. A casual string matcher gives wrong answers for user-agent groups,
wildcards, and longest-match precedence.

## Goal

Fetch once per origin per session and evaluate `robots.txt` crawl rules for the
audited URL and declared crawler profiles.

## Acceptance criteria

- [x] Fetch `{origin}/robots.txt` with the granted origin permission; cache the
  result, fetch timestamp, status, final URL, and parse outcome per session.
- [x] Parse user-agent groups, Allow, Disallow, Sitemap, comments, blank lines,
  `*`, end anchors, and longest matching path precedence; unknown directives
  are preserved as diagnostics.
- [x] Evaluate at least Googlebot and generic `*` profiles, reporting matched
  directives and an explicit “unknown/unavailable” result for fetch or parse
  failure.
- [x] Redirected, HTML, non-200, oversized, malformed, and inaccessible robots
  responses are bounded and represented as capture errors.
- [x] Fixture tests cover precedence, user-agent specificity, no matching group,
  Unicode/percent-encoded paths, and a known sitemap directive.

## Out of scope

- A complete crawler implementation.
- robots meta or X-Robots-Tag reconciliation (Ticket 204).
- Robots generation or editing.

## Dependencies

- **Blocks:** 203–205
- **Blocked by:** 102, 199, 206
- **External:** public robots fixtures
- 2026-07-13 — Implemented parse/evaluate/fetch via safeFetch + session cache; collect-dom fetches robots per origin.
