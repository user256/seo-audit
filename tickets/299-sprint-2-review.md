# Ticket 299: Sprint 2 Review and Go/No-Go

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** S

## Context

Sprint 3 may attach a debugger or alter page settings. Verify that the
less-intrusive crawl/index work already provides enough value and that its
conclusions remain honest.

## Goal

Decide whether bounded comparison experiments should be added.

## Acceptance criteria

- [ ] Run the complete Sprint 2 flow against fixtures and three public sites
  representing normal, blocked, and redirected pages.
- [ ] Review all capture errors and confirm none are represented as passed
  crawl/index checks.
- [ ] Confirm parser limits, permission escalation behaviour, and raw evidence
  retention against the privacy agreement.
- [ ] Record a Go/No-Go decision and file all discovery work before Sprint 3.

## Dependencies

- **Blocks:** 301–305
- **Blocked by:** 201–205
- **External:** representative public sites
