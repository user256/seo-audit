# Ticket 302: Soft-404 Probe

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

Soft-404 detection is inherently heuristic: an unknown URL may be a real route
or a personalised response. The extension can collect useful comparison
evidence but must never present a heuristic as a definitive server error.

## Goal

Perform a conservative, user-started soft-404 comparison for an audited URL.

## Acceptance criteria

- [ ] Generate one opaque, URL-safe nonexistent path under a user-confirmed
  origin; display it before sending and allow the user to edit/cancel it.
- [ ] Record status, final URL, content type, title, body-length/hash, and a
  bounded text fingerprint for the probe and the audited page.
- [ ] Flag only a “possible soft 404” when the probe has a success/redirect
  response and similarity/status heuristics cross documented thresholds.
- [ ] Never probe non-HTTP(S) URLs, send cookies or credentials, or follow more
  than the documented redirect cap.
- [ ] Fixture tests cover true 404/410, 200 error template, redirect-to-home,
  SPA fallback, and distinct valid content.

## Out of scope

- Search-engine soft-404 classification parity.
- More than one probe per user action.
- Site health monitoring.

## Dependencies

- **Blocks:** 399, 402
- **Blocked by:** 102, 201, 206, 299
- **External:** user confirmation for each network probe
