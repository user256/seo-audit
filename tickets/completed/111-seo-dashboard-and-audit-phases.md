# Ticket 111: SEO Dashboard and Audit Phases

**Sprint:** 1 — Inspect One Page  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** L

## Context

Sprint 1 currently hides after a successful collect behind “0 findings” and
“indexability unknown,” which reads as “the tool did nothing.” Reviewers expect
an at-a-glance SEO dashboard (status, journey, canonical/indexability breakdown,
title/description, headings, links/images) **before** a deep test run. Network
facts (status, redirects, headers) require host access and Sprint 2 capture
(Tickets 201/206); the UI must still reserve those slots honestly.

## Goal

Split the side panel into a always-visible SEO dashboard (glance inventory) and
a **Start audit** action that runs rule tests and persists a session — so the
product shows page facts out of the gate, not only defect findings.

## Acceptance criteria

- [x] Define three UX phases in the side panel and docs: **pre-access** (tab URL
  + unavailable network/DOM slots), **glance** (after Allow: inventory dashboard),
  **audit** (Start audit → findings + report on a saved session).
- [x] Glance dashboard shows: status code slot, redirect journey slot, indexability
  breakdown (canonical, meta robots, header/robots availability), title,
  description, heading hierarchy, HTML5 landmark/element presence, link count,
  image count.
- [x] Provide “Copy all links” and “Copy images (src + alt)” clipboard actions
  from bounded inventory lists.
- [x] Pre-access redirect/status slots explain that the navigation journey and
  HTTP status need site access (and Ticket 201 capture); do not invent hops.
- [x] After Allow, automatically (or via explicit Refresh) populate the glance
  inventory from the DOM without requiring Start audit; Start audit still runs
  rules, saves the session, and shows findings beneath the dashboard.
- [x] Unavailable signals are visually distinct from “pass” / “0 findings”;
  model and clipboard-payload tests cover the shipped output. Direct dashboard
  rendering/clipboard control coverage is tracked separately in Ticket 113.

## Out of scope

- Full header/redirect capture implementation (Tickets 206, 201) — dashboard
  consumes them when present.
- Robots.txt / sitemap / indexability reconciliation (202–204).
- Changing the least-privilege permission model (`<all_urls>` remains forbidden).

## Dependencies

- **Blocks:** 199, 205
- **Blocked by:** 103, 104, 106, 107
- **External:** none for DOM glance; 201 for live status/redirect fills

## Approach

Keep Markdown report + findings as post-audit surfaces. Promote DOM inventory
to a first-class dashboard. Network rows stay “unavailable” until Sprint 2
wires capture into the same slots.

## Notes / decisions log

- 2026-07-12 — Filed after smoke feedback: “0 findings / indexability unknown”
  with no visible facts felt like a no-op. User asked for dashboard-first UX
  with Start audit as the test runner.
- 2026-07-12 — Shipped Page glance dashboard + `GLANCE_DOM_INVENTORY`. Also fixed
  executeScript free-variable bug (`DEFAULT_DOM_COLLECT_LIMITS`) that returned
  null facts. Status/redirect rows remain placeholders until Ticket 201.
- 2026-07-12 — PR #11 review found no runtime regression, but direct
  `renderSeoDashboard` and clipboard-button tests were absent. Ticket 113 owns
  that narrow verification remediation and blocks the Sprint 1 review gate.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
