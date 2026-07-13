# Delivery Roadmap

**Last reconciled:** 2026-07-13
**Authoritative ticket register:** [overview.md](./overview.md)

This is the dependency-ordered delivery view. Ticket files remain the source
of truth for scope and acceptance criteria; completed Sprint 1 implementation
tickets are archived in [completed/](./completed/).

## Now — complete the Sprint 2 go/no-go gate

1. [Ticket 299: Sprint 2 Review and Go/No-Go](./299-sprint-2-review.md) — **blocked externally** on the recorded fixture and three-site review.

Tickets 201–213 are implemented and archived in [completed/](./completed/).

## Parallel manual lane — finish the Sprint 1 gate

1. [Ticket 109: Sprint 1 Verification and Documentation Reconciliation](./109-sprint-1-verification-and-documentation-reconciliation.md) — **blocked externally** (fresh Chrome 114+ smoke record).
2. [Ticket 199: Sprint 1 Review and Go/No-Go](./199-sprint-1-review.md) — after 109.

Merged remediations on this lane: 113–115 (PR #22).

## Then — Sprint 3: bounded experiments

Completed implementation: [301](./completed/301-url-variant-and-redirect-test-runner.md),
[302](./completed/302-soft-404-probe.md),
[303](./completed/303-css-and-javascript-comparison-experiment.md),
[304](./completed/304-googlebot-style-render-experiment-spike.md) (spike outcome: **defer**,
see `docs/googlebot-style-experiment.md`),
[305](./completed/305-user-agent-profiles-and-audit-disclosures.md) (network-probe-only UA
profiles now that 304 deferred debugger-backed rendering; see `docs/ua-profiles.md`),
[306](./completed/306-sprint-3-quality-gate-remediation.md).
They remain subject to the external Sprint 2 go/no-go gate (**299**).

1. [399](./399-sprint-3-review.md) — only remaining Sprint 3 ticket, gated on
   an operator review.

## Release path — Sprint 4: durable audits

1. [401](./401-session-browser-and-historical-comparison.md).
2. [402](./402-markdown-and-json-export.md) and [403](./403-error-states-privacy-controls-and-data-retention.md).
3. [404](./404-quality-gates-and-release-packaging.md).
4. [405](./405-user-defined-theme-editor.md) — user-defined colour themes on the existing CSS-variable token layer; lives in the 403 settings surface. Sprint-agnostic — pullable earlier if prioritised.
5. [499](./499-sprint-4-review-and-release-go-no-go.md).

## Ordering rules

- Do not start a sprint review ticket until every ticket it is blocked by is done.
- External/manual gates are blockers, not inferred passes.
- New remediation work must receive the next available number in its sprint and
  be inserted at the earliest dependency-safe point in this file and in
  `overview.md`.
