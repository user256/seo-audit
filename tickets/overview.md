# SEO Audit Workbench Roadmap

SEO Audit Workbench is a Manifest V3 Chrome extension for inspecting the page
currently open in the browser and collecting reproducible technical SEO
findings. It is an interactive inspector, not a site crawler.

---

# Current Product Shape

The repository contains the project specification, ticket workflow, and a
working Sprint 1 extension: the MV3 shell, origin permission flow, local audit
sessions, DOM collection/rules, Markdown report editor, and side-panel
workspace. The audit review found remedial hardening required before Sprint 1
can pass its go/no-go gate.

The product will provide:

- a side-panel **SEO dashboard** for the active tab (glance inventory before deep tests);
- structured page findings backed by captured browser evidence;
- local audit sessions and Markdown/JSON exports;
- a Markdown report editor with source/preview modes.

Constraints that shape the plan:

- Page and network access must be requested for the current origin, not
  declared as blanket host access.
- A Chrome extension cannot faithfully emulate every crawler or change the
  browser-wide User-Agent without privileged/debugging APIs. Any such feature
  must state its scope and consent surface explicitly.
- “JavaScript off” and Googlebot rendering are comparison experiments, not a
  promise to reproduce Google Search exactly.

---

# Programme Status

| Area | State | Outstanding / next |
|---|---|---|
| **Sprint 1 — Inspect one page** | Blocked | Run the remaining fresh-Chrome smoke evidence after Ticket 110's schema hardening |
| **Sprint 2 — Crawl/index signals** | Planned | Add robots, headers, and sitemap inspection on the settled page contract |
| **Sprint 3 — Comparisons and site checks** | Planned | Add bounded rendering and URL-variant experiments |
| **Sprint 4 — Durable audits** | Planned | Finish storage, export, accessibility, and release hardening |

---

# Current Priority Lane

1. [Ticket 112: Structured Audit Report View](./112-structured-audit-report-view.md) — "Open report" must compose findings/evidence/summary, not show a blank notes box
2. [Ticket 110: Source-Specific DOM Evidence Validation](./110-source-specific-dom-evidence-validation.md)
3. [Ticket 109: Sprint 1 Verification and Documentation Reconciliation](./109-sprint-1-verification-and-documentation-reconciliation.md) — blocked on an external fresh-Chrome smoke run
4. [Ticket 199: Sprint 1 Review and Go/No-Go](./199-sprint-1-review.md)

**Recommended next pick:** **112** — the report view is the fatal gap (Open report
is an empty text box); then 110 schema hardening and smoke/199. Both 110 and 112
block the 199 go/no-go. Dashboard glance (111) is in review — live HTTP
status/redirects still wait on Ticket 201.

---

# Working agreements

- A finding is always a structured record with severity, category, affected
  URL, description, evidence, recommendation, and a source reference.
- Browser-captured facts and derived rules are stored separately. Never turn a
  missing permission or failed fetch into a pass/fail finding.
- The extension stores audits locally by default. No audit URL, page body, or
  report is sent to a third party in this programme.
- Every feature that reloads a page, changes a content setting, or attaches a
  debugger requires a user action and an explanation of what will happen.
- The report editor stores Markdown as source-of-truth; preview HTML is
  transient, sanitised, and never persisted.

---

# Ticket numbering

- Each sprint owns a hundred-block: Sprint 1 = `1xx`, Sprint 2 = `2xx`, etc.
- `N99` is the sprint review gate and is required before the next sprint.
- New work discovered during implementation receives the next free number in
  its sprint; it is not silently absorbed into the current ticket.

---

# Sprint 1: Inspect One Page

**Theme:** Establish a safe extension foundation and make a single-page audit
useful from the side panel.

**Tickets:**

- [ ] [Ticket 109: Sprint 1 Verification and Documentation Reconciliation](./109-sprint-1-verification-and-documentation-reconciliation.md)
- [ ] [Ticket 110: Source-Specific DOM Evidence Validation](./110-source-specific-dom-evidence-validation.md)
- [ ] [Ticket 112: Structured Audit Report View](./112-structured-audit-report-view.md)
- [ ] [Ticket 199: Sprint 1 Review and Go/No-Go](./199-sprint-1-review.md)

**Exit criteria:**

- A user can explicitly grant access to the current origin, open the side
  panel, audit the active HTTP(S) page, and see the captured facts.
- DOM facts and derived findings validate against versioned schemas and are
  saved in a local session.
- The UI explains unavailable data rather than inferring a negative result.
- A user can write, preview, and retain Markdown notes against an audit.
- Lint, unit tests, and a Chrome load/unpacked smoke check pass.

**Explicitly out of scope:** robots parsing, response-header capture, sitemap
parsing, render comparisons, multi-page variants, cloud sync.

---

# Sprint 2: Crawl and Index Signals

**Theme:** Add the high-value inputs that explain whether an inspected URL can
be discovered, crawled, and indexed.

**Tickets:**

- [ ] [Ticket 206: Network Capture and Safe Fetch Foundation](./206-network-capture-and-safe-fetch-foundation.md)
- [ ] [Ticket 201: Response Metadata and Redirect Capture](./201-response-metadata-and-redirect-capture.md)
- [ ] [Ticket 202: Robots.txt Fetch, Parser, and Evaluator](./202-robots-txt-fetch-parser-and-evaluator.md)
- [ ] [Ticket 203: XML Sitemap and Hreflang Parser](./203-xml-sitemap-and-hreflang-parser.md)
- [ ] [Ticket 207: Hreflang Directive Validation](./207-hreflang-directive-validation.md)
- [ ] [Ticket 208: Structured Data Inventory and Validation](./208-structured-data-inventory-and-validation.md)
- [ ] [Ticket 204: Indexability Reconciliation Rules](./204-indexability-reconciliation-rules.md)
- [ ] [Ticket 210: Audit Wizard and Check Selection](./210-audit-wizard-and-check-selection.md)
- [ ] [Ticket 205: Crawl Signals Workspace](./205-crawl-signals-workspace.md)
- [ ] [Ticket 299: Sprint 2 Review and Go/No-Go](./299-sprint-2-review.md)

**Exit criteria:**

- The panel makes it clear which source supplied each crawl/index conclusion.
- Robots and XML are parsed defensively with useful parse/fetch errors.
- Header capture, redirects, robots, meta robots, canonical, and sitemap
  membership can be reconciled for one URL without claiming crawler parity.
- Fixture-driven parser and rule tests cover normal, malformed, and conflicting
  inputs.

**Explicitly out of scope:** broad crawling, automated repair, Googlebot
emulation, external SEO services.

---

# Sprint 3: Bounded Comparisons and Site Checks

**Theme:** Offer opt-in experiments that reveal redirect and rendering risks,
without hiding their limits.

**Tickets:**

- [ ] [Ticket 301: URL Variant and Redirect Test Runner](./301-url-variant-and-redirect-test-runner.md)
- [ ] [Ticket 302: Soft-404 Probe](./302-soft-404-probe.md)
- [ ] [Ticket 303: CSS and JavaScript Comparison Experiment](./303-css-and-javascript-comparison-experiment.md)
- [ ] [Ticket 304: Googlebot-Style Render Experiment Spike](./304-googlebot-style-render-experiment-spike.md)
- [ ] [Ticket 305: User-Agent Profiles and Audit Disclosures](./305-user-agent-profiles-and-audit-disclosures.md)
- [ ] [Ticket 399: Sprint 3 Review and Go/No-Go](./399-sprint-3-review.md)

**Exit criteria:**

- Variant and soft-404 probes are user-started, bounded, cancellable, and save
  exact request/response evidence.
- Render-comparison results show a method and limitations alongside the diff.
- Any debugger-dependent feature is separately consented, detachable, and
  fails closed when unavailable.
- The team makes an evidence-based decision whether advanced browser-control
  features are worth their permission and maintenance cost.

**Explicitly out of scope:** unattended crawling, bypassing access controls,
cloaking detection claims, guarantees about Google’s renderer.

---

# Sprint 4: Durable Audits and Release Readiness

**Theme:** Make audit sessions portable, understandable, and safe to ship.

**Tickets:**

- [ ] [Ticket 401: Session Browser and Historical Comparison](./401-session-browser-and-historical-comparison.md)
- [ ] [Ticket 402: Markdown and JSON Export](./402-markdown-and-json-export.md)
- [ ] [Ticket 403: Error States, Privacy Controls, and Data Retention](./403-error-states-privacy-controls-and-data-retention.md)
- [ ] [Ticket 404: Quality Gates and Release Packaging](./404-quality-gates-and-release-packaging.md)
- [ ] [Ticket 405: User-Defined Theme Editor](./405-user-defined-theme-editor.md)
- [ ] [Ticket 499: Sprint 4 Review and Release Go/No-Go](./499-sprint-4-review-and-release-go-no-go.md)

**Exit criteria:**

- Sessions can be searched, reopened, compared, exported, and deleted locally.
- Exports are deterministic, portable, and make the capture time and limits
  clear.
- The extension has documented permissions, privacy behaviour, accessibility
  checks, test coverage, and a reproducible packaged build.

---

# Programme Exit Criteria

The first release is ready when a user can conduct and retain a credible,
single-site technical SEO investigation without a crawler or cloud service;
every conclusion is traceable to captured evidence; the browser permissions and
experimental limits are understandable; and the packed extension passes its
automated and manual release checks.
