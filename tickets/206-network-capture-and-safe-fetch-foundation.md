# Ticket 206: Network Capture and Safe Fetch Foundation

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** L

## Context

Tickets 201–203, 213, and 301–302 each need network access. Ticket 212 supplies
broad HTTP(S) host permissions so callers are not blocked on per-origin Allow.
This ticket still defines the *safe fetch* contract: caps, credentials policy,
correlation, and honest labelling of observed navigation vs extension fetch.

An audit is normally started after page navigation has completed: a passive
response listener cannot retroactively provide that navigation’s headers or
redirect chain. The project needs an explicit, tested answer before UI work
promises those facts.

## Goal

Establish one network-observation and fetch boundary that can truthfully
correlate results to a user-selected audit URL, with hard caps even when host
access is broad.

## Acceptance criteria

- [ ] Produce and implement a Chrome/MV3 capability decision for current-page
  headers/redirects: explicit reload/re-observe, clearly-labelled replay fetch,
  or an unavailable result. The UI/API must never label replay-fetch headers as
  the original browser navigation.
- [ ] Define a shared request contract with method, redirect cap, timeout/abort,
  byte cap, MIME expectation, concurrency limit, and correlation/request ID;
  all later network features use it. Host access comes from Ticket 212 (required
  HTTP(S) permissions), not per-request `permissions.request`.
- [ ] Fetches use an explicit credential/referrer/cache policy that prevents
  cookies, authentication, and ambient tab state from being sent or inferred;
  cross-origin hops are allowed under 212 but must still be recorded in evidence
  and respect redirect/byte caps.
- [ ] Implement one normalised result/error shape retaining final URL, status,
  redirect hops, selected response headers, timing, truncation, and method
  limitations without persisting bodies by default.
- [ ] Add mocked tests for a navigation observed before and after permission,
  late listener attachment, redirect loops, cross-origin hops, timeout,
  cancellation, oversized body, and unsupported header visibility.
- [ ] Document the manifest/API permissions and Chrome-version constraints
  selected by the decision (coordinate with Ticket 212).

## Out of scope

- Robots parsing, sitemap parsing, or variant generation themselves.
- Cookie-authenticated or private-site auditing.
- Capturing arbitrary request/response bodies.
- Re-introducing a per-origin Allow NUX (superseded by Ticket 212).

## Dependencies

- **Blocks:** 201–203, 213, 301, 302
- **Blocked by:** 102, 199, 212 (host access model)
- **External:** Chrome API capability verification

## Approach

Separate observing an existing browser navigation from making an extension
network request. They are different evidence sources and must remain labelled as
such throughout the data contract and findings UI. Broad host permission removes
grant friction; this ticket keeps the fetch *dangerous* parts bounded.

## Notes / decisions log

- 2026-07-12 — Filed by the roadmap audit. Existing Ticket 201 calls for a
  method decision, but its downstream tickets also require a consistent safe
  fetch policy and a solution for audits started after navigation completes.
- 2026-07-13 — Product decision: adopt broad HTTP(S) host permissions (Ticket
  212). Hreflang Pro’s `<all_urls>` UX is the model for access; this ticket
  retains caps/credential policy. Per-origin Allow is explicitly rejected.
