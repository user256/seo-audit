# Delivery Roadmap

**Last reconciled:** 2026-07-12  
**Authoritative ticket register:** [overview.md](./overview.md)

This is the dependency-ordered delivery view. Ticket files remain the source
of truth for scope and acceptance criteria; completed Sprint 1 implementation
tickets are archived in [completed/](./completed/).

## Now — finish the Sprint 1 gate

1. [Ticket 110: Source-Specific DOM Evidence Validation](./110-source-specific-dom-evidence-validation.md) — implement the remaining per-source persisted-evidence validation and adversarial tests.
2. [Ticket 109: Sprint 1 Verification and Documentation Reconciliation](./109-sprint-1-verification-and-documentation-reconciliation.md) — **blocked externally** until a fresh Chrome 114+ profile completes the documented smoke checklist.
3. [Ticket 199: Sprint 1 Review and Go/No-Go](./199-sprint-1-review.md) — run only after 109 and 110 are complete.

## Next — Sprint 2: Crawl and index signals

1. [206](./206-network-capture-and-safe-fetch-foundation.md) — shared safe network boundary.
2. [201](./201-response-metadata-and-redirect-capture.md) and [202](./202-robots-txt-fetch-parser-and-evaluator.md) — navigation evidence and robots evaluation.
3. [203](./203-xml-sitemap-and-hreflang-parser.md) — sitemap parsing, after 202.
4. [207](./207-hreflang-directive-validation.md) and [208](./208-structured-data-inventory-and-validation.md) — directive and structured-data validation.
5. [204](./204-indexability-reconciliation-rules.md) — reconcile all captured signals.
6. [205](./205-crawl-signals-workspace.md) — present the evidence in the workspace.
7. [299](./299-sprint-2-review.md) — Sprint 2 go/no-go.

## Then — Sprint 3: bounded experiments

1. [301](./301-url-variant-and-redirect-test-runner.md) and [302](./302-soft-404-probe.md).
2. [303](./303-css-and-javascript-comparison-experiment.md) and [304](./304-googlebot-style-render-experiment-spike.md).
3. [305](./305-user-agent-profiles-and-audit-disclosures.md), after 301 and 304.
4. [399](./399-sprint-3-review.md).

## Release path — Sprint 4: durable audits

1. [401](./401-session-browser-and-historical-comparison.md).
2. [402](./402-markdown-and-json-export.md) and [403](./403-error-states-privacy-controls-and-data-retention.md).
3. [404](./404-quality-gates-and-release-packaging.md).
4. [499](./499-sprint-4-review-and-release-go-no-go.md).

## Ordering rules

- Do not start a sprint review ticket until every ticket it is blocked by is done.
- External/manual gates are blockers, not inferred passes.
- New remediation work must receive the next available number in its sprint and
  be inserted at the earliest dependency-safe point in this file and in
  `overview.md`.
