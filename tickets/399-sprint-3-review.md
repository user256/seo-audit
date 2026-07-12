# Ticket 399: Sprint 3 Review and Go/No-Go

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** S

## Context

The comparison work has the largest permission, privacy, and correctness risk
in the programme. It must earn a place in the release.

## Goal

Decide which, if any, experiment features are suitable for a durable release.

## Acceptance criteria

- [ ] Review every Sprint 3 feature against its disclosure, cancellation,
  network-bound, and restoration requirements.
- [ ] Confirm no feature makes crawler-parity or cloaking-detection claims.
- [ ] Validate debugger attach/detach recovery if Ticket 304 reached a
  prototype; reject it from the release if recovery cannot be demonstrated.
- [ ] Record keep/defer/remove decisions and file follow-up tickets before
  starting Sprint 4.

## Dependencies

- **Blocks:** 401–404
- **Blocked by:** 301–305
- **External:** product/permission review
