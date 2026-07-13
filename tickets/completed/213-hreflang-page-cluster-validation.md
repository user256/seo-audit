# Ticket 213: Hreflang Page-Cluster Validation (Opt-In Fetch)

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** L

## Context

Ticket 207 validates hreflang from already-captured HTML and selected sitemap
evidence (structural checks). Operators also need Hreflang Pro’s page-cluster
mode: given one page, fetch each alternate target and verify return tags,
canonicals, and related live signals. That is a deliberate network experiment,
not silent background crawling.

## Goal

Let the user start a capped, cancellable validation of the hreflang cluster for
the current page by fetching alternate URLs and recording evidence-backed
findings.

## Acceptance criteria

- [x] User action + up-front disclosure: what will be fetched, that it is not
  Googlebot parity, and that it can be cancelled.
- [x] Uses Ticket 206 safe fetch (and Ticket 212 host access): timeout, byte
  cap, redirect cap, concurrency limit, no cookies/credentials by default.
- [x] For each alternate: record final URL, status, redirect hops, extracted
  return hreflang set, and CaptureErrors when a target fails — never invent
  pass/fail from a missing fetch alone without recording the error.
- [x] Findings cover missing return tags, invalid codes (reuse 207), duplicate
  values, and self-reference issues among **fetched** cluster members.
- [x] Hard caps (max alternates / max bytes / max time) with honest truncation
  evidence when the cluster is larger than the budget.
- [x] Fixture/mocked tests for reciprocity pass/fail, fetch failure,
  redirecting targets, and cancellation.
- [x] Plunder behaviour from Hreflang Pro’s page-mode cluster crawl; do **not**
  copy Twemoji CDN, score UI, or matrix PNG export unless separately ticketed.

## Out of scope

- Sitemap-only structural validation (Ticket 207).
- Unattended whole-site crawls.
- Claiming crawler or Googlebot parity.

## Dependencies

- **Blocks:** 205 (workspace surfacing), 299
- **Blocked by:** 206, 207, 212
- **External:** none

## Notes / decisions log

- 2026-07-13 — Product decision during Hreflang Pro plunder: live page-cluster
  hreflang validation is desired. Ticket 207 stays structural/captured-evidence;
  this ticket owns the opt-in fetch path.
- 2026-07-13 — Opt-in cluster validate via safeFetch + Crawl signals UI; caps + cancel.
