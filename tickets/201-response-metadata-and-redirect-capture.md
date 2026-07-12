# Ticket 201: Response Metadata and Redirect Capture

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** L

## Context

DOM inspection cannot reveal the navigation status, headers, or redirect path.
Those facts are required to assess page-level crawl and index instructions.

## Goal

Capture the active tab’s main-frame navigation status, redirect chain, and
SEO-relevant response headers under the granted host permission.

## Acceptance criteria

- [ ] Evaluate and document the least-privileged MV3-compatible capture method;
  record its Chrome version and incognito limitations in `docs/architecture.md`.
- [ ] Capture only main-frame requests for the audited tab and correlate the
  navigation’s URL, status, redirect hops, and final response headers to its
  session snapshot.
- [ ] Normalise header names case-insensitively and retain X-Robots-Tag,
  Content-Type, Cache-Control, Vary, Location, Refresh, and canonical `Link`
  values without persisting unrelated request headers.
- [ ] Redirect loops, missing header visibility, cross-origin hops, and
  navigation races are recorded as capture errors/limits rather than false
  findings.
- [ ] Mocked event-stream tests cover 200, 301→200, 302→404, duplicate
  X-Robots-Tag, and unrelated-tab traffic.

## Out of scope

- Variant requests or arbitrary URL fetching.
- Authentication or request-body capture.
- Deciding indexability (Ticket 204).

## Dependencies

- **Blocks:** 204, 205, 301, 302
- **Blocked by:** 102, 199
- **External:** Chrome API capability verification

## Approach

Do not silently fall back to a side-panel `fetch`: it cannot see the browser
navigation’s headers or redirect chain. Select and test the browser API before
committing to UI work.

