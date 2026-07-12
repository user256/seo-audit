# Ticket 301: URL Variant and Redirect Test Runner

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** L

## Context

Redirect and canonical consistency often only appear when equivalent URL forms
are compared. This needs an explicit user-selected target, a bounded request
set, and evidence for every hop.

## Goal

Run and retain a user-approved set of URL-variant redirect tests.

## Acceptance criteria

- [ ] A user can enter/select a base URL and opt into individual variants:
  scheme, www/non-www, trailing slash, case, and configured index filenames.
- [ ] The runner validates URLs, deduplicates variants, limits concurrency and
  redirects, supports cancellation, and never sends credentials/cookies.
- [ ] Each result records request URL, final URL, status, redirect hops,
  elapsed time, response content type, and any exception with a request limit.
- [ ] The UI compares final destinations and canonical evidence where available,
  flagging inconsistencies as observations rather than forcing a preferred host.
- [ ] Tests cover redirect loops, cross-origin redirects, duplicate variants,
  timeouts, cancellation, and mixed status results with mocked fetches.

## Out of scope

- Discovering arbitrary URLs or crawling internal links.
- POST/PUT requests, login, or cookie replay.
- Altering site redirects.

## Dependencies

- **Blocks:** 399, 401, 402
- **Blocked by:** 102, 201, 299
- **External:** permission for each requested origin

