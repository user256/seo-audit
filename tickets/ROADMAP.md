# Delivery Roadmap

**Last reconciled:** 2026-07-19
**Authoritative ticket register:** [overview.md](./overview.md)

This is the dependency-ordered delivery view. Ticket files remain the source
of truth for scope and acceptance criteria; completed implementation tickets
are archived in [completed/](./completed/).

## Now — clear the operator gates

All planned implementation through Sprint 3 is merged, **and so is the last
code remediation** (Ticket 215, merged 2026-07-19). Nothing on the critical path
is code work any more. Run [`docs/operator-gates.md`](../docs/operator-gates.md)
to clear all gates in one session.

1. [Ticket 109](./109-sprint-1-verification-and-documentation-reconciliation.md) — Sprint 1 smoke rows 5–9 (Block A).
2. [Ticket 199](./199-sprint-1-review.md) — Sprint 1 go/no-go (Block B).
3. [Ticket 214](./214-crawl-signals-auto-capture-and-silent-hydration.md) + [Ticket 299](./299-sprint-2-review.md) — final no-reload smoke and Sprint 2 three-site review (Block C). Re-check the Milroys title finding: Ticket 216 fixed the SVG `<title>` false duplicate that the last pass surfaced.
4. [Ticket 399](./399-sprint-3-review.md) — Sprint 3 keep/defer/remove + go/no-go (Block D); repository review already recorded in the ticket.

## Parallel — does not gate the operator pass

1. [Ticket 116](./116-flaky-collect-dom-timeout.md) — intermittent 5s timeout in
   `collect-dom.test.ts` under parallel load; makes CI red roughly one run in
   three. Housekeeping, but it undermines every "tests green" claim.
2. [Ticket 407](./407-cannyforge-visual-reskin.md) — merged; needs only the
   user's light/dark visual smoke check.
3. [Ticket 408](./408-theme-a11y-fidelity.md) — accessibility gaps found in the
   407 review; land before 404 certifies an accessibility baseline.

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
