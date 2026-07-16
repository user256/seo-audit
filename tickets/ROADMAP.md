# Delivery Roadmap

**Last reconciled:** 2026-07-16
**Authoritative ticket register:** [overview.md](./overview.md)

This is the dependency-ordered delivery view. Ticket files remain the source
of truth for scope and acceptance criteria; completed implementation tickets
are archived in [completed/](./completed/).

## Now — serialize the hydrate stage, then clear operator gates

All planned implementation through Sprint 3 is merged. First complete the
small automatic-hydration ordering remediation; then run
[`docs/operator-gates.md`](../docs/operator-gates.md) to clear all gates in one
session.

1. [Ticket 215](./215-hydrate-stage-serialization.md) — prevent a concurrent
   hydrate call from fetching sitemap candidates before the robots stage ends.
2. [Ticket 109](./109-sprint-1-verification-and-documentation-reconciliation.md) — Sprint 1 smoke rows 5–9 (Block A).
3. [Ticket 199](./199-sprint-1-review.md) — Sprint 1 go/no-go (Block B).
4. [Ticket 214](./214-crawl-signals-auto-capture-and-silent-hydration.md) + [Ticket 299](./299-sprint-2-review.md) — final no-reload smoke and Sprint 2 three-site review (Block C).
5. [Ticket 399](./399-sprint-3-review.md) — Sprint 3 keep/defer/remove + go/no-go (Block D); repository review already recorded in the ticket.

## Parallel — Sprint 2 remediation

1. [Ticket 214](./214-crawl-signals-auto-capture-and-silent-hydration.md) —
   retroactive ticket for PRs #34–#36. Disclosure and regression tests are
   merged; only its Block C operator smoke remains, after Ticket 215.
2. [Ticket 215](./215-hydrate-stage-serialization.md) — small concurrent-entry
   correctness remediation found during PR #38 review; it blocks 214's smoke
   and Ticket 299.

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
