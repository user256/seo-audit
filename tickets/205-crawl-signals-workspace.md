# Ticket 205: Crawl Signals Workspace

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

The new inputs are useful only if a reviewer can distinguish direct facts,
parser outcomes, and rule conclusions. The UI needs a concise but inspectable
crawl/index surface.

## Goal

Make navigation, robots, sitemap, and reconciliation evidence understandable in
the audit workspace.

## Acceptance criteria

- [ ] Provide separate, labelled panels for navigation/headers, robots,
  sitemap, and resulting findings, with source URL and capture time shown.
- [ ] Show redirect hops, matched robots rule, sitemap parse limits, and
  raw/normalised URLs on demand without unbounded text rendering.
- [ ] Fetches and parses show progress, cancellation where supported, and
  actionable non-sensitive errors.
- [ ] All data-unavailable states are visually and programmatically distinct
  from “not found” and “passes”.
- [ ] Keyboard, small-panel, and screen-reader smoke tests cover the new panels.

## Out of scope

- Site-wide dashboards.
- Advanced rendering experiments.

## Dependencies

- **Blocks:** 299
- **Blocked by:** 106, 201–204
- **External:** none

