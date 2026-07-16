# Repository Delivery State

**Recorded:** 2026-07-16
**Branch:** `main`

## Pull-request triage

- PR #32 merged the delivery-state reconciliation; PR #33 closed Ticket 406
  (serialise theme preference writes).
- PRs #34–#36 merged **without tickets** (crawl-signals wiring, SW-safe
  sitemap parser + panel-open auto-capture, silent sidebar hydration).
  Ticket 214 now records that work retroactively and carries its follow-ups
  (background-fetch disclosure, hydrate regression tests).
- Earlier history: PR #26 (Sprint 3: 299 go + 301 + 302), #27 (306 + roadmap),
  #29 (303 + 306), #30 (304 spike decision + 305), #31 (405). Sprint 1/2
  lanes: #11, #17–#23, #25. Stacked PRs #12–#16 superseded.

## Current review outcome (2026-07-16)

- `main` passes `npm run lint`, `npm test` (65 files / 390 tests),
  `npm run build`, and `npm run package:check` (per the Ticket 399 repository
  review and re-verified 2026-07-16).
- Ticket 399's repository review is recorded in the ticket; the operator half
  of the gate is outstanding.

## Delivery position

- Tickets 100–115, 201–213, 301–306, 405, and 406 are complete and archived in
  `tickets/completed/`.
- Open tickets: **214** (Sprint 2 retroactive remediation), **109/199/299/399**
  (operator gates), **401–404/499** (Sprint 4, blocked by 399).
- The consolidated manual checklist for all four gates is
  `docs/operator-gates.md`. Until an operator runs it, no gate can close and
  Sprint 4 must not start.
- Standing rule reaffirmed: no PR merges without a ticket number.
