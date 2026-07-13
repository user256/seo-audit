# Ticket 306: Sprint 3 Comparison-Runner Quality-Gate Remediation

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** S

## Context

The pending local implementation for Tickets 301 and 302 is substantially in
scope, but it did not pass the required automated quality gate on 2026-07-13:
the soft-404 cancellation test times out because its fetch double never settles
when the supplied abort signal fires. The implementation must have a reliable
test of that cancellation contract before either ticket is accepted.

## Goal

Restore a reliable, passing quality gate for the Sprint 3 comparison runners
without weakening their cancellation guarantees.

## Acceptance criteria

- [ ] Make the soft-404 in-flight cancellation test settle from the request
  `AbortSignal`, then assert the returned result is cancelled and records the
  cancellation limitation.
- [ ] Retain coverage of the service-worker cancellation route and verify no
  cancelled run continues to start another fetch.
- [ ] Run and record passing `npm test`, `npm run lint`, `npm run build`, and
  `npm run package:check` results.

## Dependencies

- **Blocks:** acceptance of 301 and 302; 399
- **Blocked by:** 301, 302
- **External:** none
