# Delivery Roadmap

**Last reconciled:** 2026-07-13
**Authoritative ticket register:** [overview.md](./overview.md)

This is the dependency-ordered delivery view. Ticket files remain the source
of truth for scope and acceptance criteria; completed Sprint 1 implementation
tickets are archived in [completed/](./completed/).

## Now — finish the Sprint 1 gate

1. [Ticket 113: Dashboard Rendering and Clipboard UI Tests](./113-dashboard-rendering-and-clipboard-ui-tests.md) — blocks 199.
2. [Ticket 114: DOM Evidence Save-Boundary Enforcement](./114-dom-evidence-save-boundary-enforcement.md) — blocks 199 and 208.
3. [Ticket 115: Long-URL DOM Capture Bounds](./115-long-url-dom-capture-bounds.md) — blocks 199.
4. [Ticket 109: Sprint 1 Verification and Documentation Reconciliation](./109-sprint-1-verification-and-documentation-reconciliation.md) — **blocked externally**.
5. [Ticket 199: Sprint 1 Review and Go/No-Go](./199-sprint-1-review.md) — after 109 and 113–115.

## Next — Sprint 2: Crawl and index signals

1. [206](./206-network-capture-and-safe-fetch-foundation.md) — shared safe network boundary.
2. [201](./201-response-metadata-and-redirect-capture.md) and [202](./202-robots-txt-fetch-parser-and-evaluator.md) — navigation evidence and robots evaluation.
3. [203](./203-xml-sitemap-and-hreflang-parser.md) — sitemap parsing, after 202.
4. [207](./207-hreflang-directive-validation.md) — directive validation.
5. [204](./204-indexability-reconciliation-rules.md) — reconcile all captured signals.
6. [205](./205-crawl-signals-workspace.md) — present the evidence in the workspace.
7. [299](./299-sprint-2-review.md) — Sprint 2 go/no-go.

Completed out of sequence: [208](./completed/208-structured-data-inventory-and-validation.md), [209](./completed/209-check-catalogue-and-availability-model.md), [210](./completed/210-audit-wizard-and-check-selection.md), and [211](./completed/211-register-structured-data-check.md).

## Then — Sprint 3: bounded experiments

1. [301](./301-url-variant-and-redirect-test-runner.md) and [302](./302-soft-404-probe.md).
2. [303](./303-css-and-javascript-comparison-experiment.md) and [304](./304-googlebot-style-render-experiment-spike.md).
3. [305](./305-user-agent-profiles-and-audit-disclosures.md), after 301 and 304.
4. [399](./399-sprint-3-review.md).

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
