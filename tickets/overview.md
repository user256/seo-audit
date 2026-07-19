# SEO Audit Workbench Roadmap

SEO Audit Workbench is a Manifest V3 Chrome extension for inspecting the page
currently open in the browser and collecting reproducible technical SEO
findings. It is an interactive inspector, not a site crawler.

---

# Current Product Shape

The repository contains the project specification, ticket workflow, and a
working extension through Sprint 3: the MV3 shell, local audit sessions, DOM
collection/rules, crawl/index signals (robots, sitemap, headers, redirects),
bounded comparison experiments, Markdown report editor, and side-panel
workspace. All remedial hardening is merged; Sprints 1–3 now await their
operator gate records (see `docs/operator-gates.md`).

The product will provide:

- a side-panel **SEO dashboard** for the active tab (glance inventory before deep tests);
- structured page findings backed by captured browser evidence;
- local audit sessions and Markdown/JSON exports;
- a Markdown report editor with source/preview modes.

Constraints that shape the plan:

- Broad HTTP(S) host permissions are preferred over a per-origin Allow NUX so
  multi-host sitemaps and hreflang clusters work without repeated prompts
  (Ticket 212). Fetches remain capped; unsupported schemes stay blocked.
- A Chrome extension cannot faithfully emulate every crawler or change the
  browser-wide User-Agent without privileged/debugging APIs. Any such feature
  must state its scope and consent surface explicitly.
- “JavaScript off” and Googlebot rendering are comparison experiments, not a
  promise to reproduce Google Search exactly.

---

# Programme Status

| Area | State | Outstanding / next |
|---|---|---|
| **Sprint 1 — Inspect one page** | Blocked | Tickets **109** / **216** (SVG-title false positive, fixed pending merge) / **199** need operator Chrome smoke + go/no-go |
| **Sprint 2 — Crawl/index signals** | Gate pending | Ticket **215** must serialize automatic hydrate stages; then Ticket **214**'s smoke and Ticket **299**'s public-site review (re-check Milroys once **216** merges) remain |
| **Sprint 3 — Comparisons and site checks** | Gate pending | Implementation done through **306**; Ticket **399** repository review recorded, operator half outstanding |
| **Sprint 4 — Durable audits** | Not started (405/406 pulled ahead) | Do **not** start 401–404 until 399 closes; theme editor (405) and its remediation (406) are done |

---

# Current Priority Lane

Every planned implementation ticket through Sprint 3 is merged. Resolve the
small Ticket **215** correctness remediation before running the browser gates.
All outstanding manual steps are consolidated in
[`docs/operator-gates.md`](../docs/operator-gates.md) — one sitting then clears
Tickets **109**, **199**, **214**/**299**, and **399**.

1. Complete Ticket **215**; it is the only unmerged code remediation.
2. Run the operator gate runbook (Blocks A–D) and record results in the four
   gate tickets (including Ticket 214's Block C addendum).
3. Then, and only then, open Sprint 4: **401** → **402**/**403** → **404** → **499**.

**Recommended next pick:** Ticket 215, then the operator runbook. No new
feature work should land ahead of the gates — that is how the programme drifted.

---

# Working agreements

- A finding is always a structured record with severity, category, affected
  URL, description, evidence, recommendation, and a source reference.
- Browser-captured facts and derived rules are stored separately. Never turn a
  missing permission or failed fetch into a pass/fail finding.
- The extension stores audits locally by default. No audit URL, page body, or
  report is sent to a third party in this programme.
- Broad HTTP(S) host access may be declared so Sprint 2 network features avoid
  per-origin Allow friction; every multi-URL fetch or reload still needs a user
  action, caps, and an explanation of what will happen.
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
- [ ] [Ticket 216: SVG Icon `<title>` Elements Falsely Counted as Duplicate Document Titles](./216-svg-title-false-duplicate.md)
- [ ] [Ticket 199: Sprint 1 Review and Go/No-Go](./199-sprint-1-review.md)

**Exit criteria:**

- A user can open the side panel, audit the active HTTP(S) page (required
  host permissions), and see the captured facts.
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

**Completed implementation:** Tickets 201–213 are archived in
[completed/](./completed/).

**Open tickets:**

- [ ] [Ticket 214: Crawl-Signals Auto-Capture and Silent Hydration (retroactive)](./214-crawl-signals-auto-capture-and-silent-hydration.md)
- [ ] [Ticket 215: Serialize Automatic Crawl-Signal Hydration](./215-hydrate-stage-serialization.md)
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

**Completed implementation:** [Ticket 301](./completed/301-url-variant-and-redirect-test-runner.md),
[Ticket 302](./completed/302-soft-404-probe.md),
[Ticket 303](./completed/303-css-and-javascript-comparison-experiment.md),
[Ticket 304](./completed/304-googlebot-style-render-experiment-spike.md),
[Ticket 305](./completed/305-user-agent-profiles-and-audit-disclosures.md),
and [Ticket 306](./completed/306-sprint-3-quality-gate-remediation.md).

**Tickets:**

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

**Completed implementation:** [Ticket 405](./completed/405-user-defined-theme-editor.md)
(pulled ahead of the settings surface per its own Approach note — see
`docs/theme-editor.md`).

**Tickets:**

- [ ] [Ticket 401: Session Browser and Historical Comparison](./401-session-browser-and-historical-comparison.md)
- [ ] [Ticket 402: Markdown and JSON Export](./402-markdown-and-json-export.md)
- [ ] [Ticket 403: Error States, Privacy Controls, and Data Retention](./403-error-states-privacy-controls-and-data-retention.md)
- [ ] [Ticket 404: Quality Gates and Release Packaging](./404-quality-gates-and-release-packaging.md)
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
