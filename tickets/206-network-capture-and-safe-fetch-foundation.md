# Ticket 206: Network Capture and Safe Fetch Foundation

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** L

## Context

Tickets 201–203 and 301–302 each need network access, but their current plans
do not share an enforceable request policy. More critically, an audit is
normally started after the page navigation has completed: a passive response
listener cannot retroactively provide that navigation’s headers or redirect
chain. The project needs an explicit, tested answer before UI work promises
those facts.

## Goal

Establish one least-privileged network-observation and fetch boundary that can
truthfully correlate results to a user-selected audit URL.

## Acceptance criteria

- [ ] Produce and implement a Chrome/MV3 capability decision for current-page
  headers/redirects: explicit reload/re-observe, clearly-labelled replay fetch,
  or an unavailable result. The UI/API must never label replay-fetch headers as
  the original browser navigation.
- [ ] Define a shared request contract with user-approved origin, method,
  redirect cap, timeout/abort, byte cap, MIME expectation, concurrency limit,
  and correlation/request ID; all later network features use it.
- [ ] Fetches use an explicit credential/referrer/cache policy that prevents
  cookies, authentication, and ambient tab state from being sent or inferred;
  redirects across origins require a fresh permission/disclosure before body
  inspection.
- [ ] Implement one normalised result/error shape retaining final URL, status,
  redirect hops, selected response headers, timing, truncation, and method
  limitations without persisting bodies by default.
- [ ] Add mocked tests for a navigation observed before and after permission,
  late listener attachment, redirect loops, cross-origin hops, timeout,
  cancellation, oversized body, and unsupported header visibility.
- [ ] Document the manifest/API permissions and Chrome-version constraints
  selected by the decision.

## Out of scope

- Robots parsing, sitemap parsing, or variant generation themselves.
- Cookie-authenticated or private-site auditing.
- Capturing arbitrary request/response bodies.

## Dependencies

- **Blocks:** 201–203, 301, 302
- **Blocked by:** 102, 199
- **External:** Chrome API capability verification

## Approach

Separate observing an existing browser navigation from making an extension
network request. They are different evidence sources and must remain labelled as
such throughout the data contract and findings UI.

## Notes / decisions log

- 2026-07-12 — Filed by the roadmap audit. Existing Ticket 201 calls for a
  method decision, but its downstream tickets also require a consistent safe
  fetch policy and a solution for audits started after navigation completes.

