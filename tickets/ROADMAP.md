# Delivery Roadmap

**Last reconciled:** 2026-07-16
**Authoritative ticket register:** [overview.md](./overview.md)

This is the dependency-ordered delivery view. Ticket files remain the source
of truth for scope and acceptance criteria; completed implementation tickets
are archived in [completed/](./completed/).

## Now — clear the operator gates (single manual sitting)

All implementation through Sprint 3 is merged. The critical path is entirely
manual: run [`docs/operator-gates.md`](../docs/operator-gates.md) to clear all
four gates in one session.

1. [Ticket 109](./109-sprint-1-verification-and-documentation-reconciliation.md) — Sprint 1 smoke rows 5–9 (Block A).
2. [Ticket 199](./199-sprint-1-review.md) — Sprint 1 go/no-go (Block B).
3. [Ticket 299](./299-sprint-2-review.md) — Sprint 2 go/no-go, three-site review (Block C).
4. [Ticket 399](./399-sprint-3-review.md) — Sprint 3 keep/defer/remove + go/no-go (Block D); repository review already recorded in the ticket.

## Parallel — Sprint 2 remediation

1. [Ticket 214](./214-crawl-signals-auto-capture-and-silent-hydration.md) —
   retroactive ticket for PRs #34–#36 (crawl wiring, SW sitemap parser,
   panel-open auto-capture, silent hydration). Open items: background-fetch
   disclosure decision and regression tests for the hydrate paths. This is the
   only open implementation work before Sprint 4.

## Then — Sprint 4: durable audits (do not start before 399 closes)

Completed ahead of the settings surface: [405](./completed/405-user-defined-theme-editor.md)
and its remediation [406](./completed/406-theme-preference-write-ordering.md).

1. [401](./401-session-browser-and-historical-comparison.md).
2. [402](./402-markdown-and-json-export.md) and [403](./403-error-states-privacy-controls-and-data-retention.md).
3. [404](./404-quality-gates-and-release-packaging.md).
4. [499](./499-sprint-4-review-and-release-go-no-go.md).

## Archived lanes

- Sprint 1 implementation + remediations 100–115: [completed/](./completed/).
- Sprint 2 implementation 201–213: [completed/](./completed/).
- Sprint 3 implementation 301–306: [completed/](./completed/) —
  304 spike outcome **defer** (`docs/googlebot-style-experiment.md`);
  305 shipped network-probe-only UA profiles (`docs/ua-profiles.md`).

## Ordering rules

- Do not start a sprint review ticket until every ticket it is blocked by is done.
- External/manual gates are blockers, not inferred passes.
- New remediation work must receive the next available number in its sprint and
  be inserted at the earliest dependency-safe point in this file and in
  `overview.md`. **Every merged PR maps to a ticket — PRs #34–#36 broke this
  rule and cost a retroactive reconstruction (Ticket 214). Don't repeat it.**
