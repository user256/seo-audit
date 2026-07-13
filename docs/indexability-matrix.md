# Indexability reconciliation matrix (Ticket 204)

Reference outcomes for common combinations of captured crawl/index signals.
This audit reports **observed signals** only — never a definitive search-engine
indexing decision.

## Evidence sources

| Source                         | Kind    | Used for                                                 |
| ------------------------------ | ------- | -------------------------------------------------------- |
| `meta[name=robots\|googlebot]` | DOM     | HTML meta robots / googlebot tokens                      |
| `browser-navigation`           | network | Final URL, redirect hops, `X-Robots-Tag`, `Content-Type` |
| `link[rel=canonical]`          | DOM     | Resolved canonical target                                |
| `robots-evaluation`            | robots  | Parsed robots.txt crawl decision for audited path        |
| `sitemap-membership`           | sitemap | Whether audited URL appears in selected sitemap          |

When a row requires a source that was not captured, the matching reconciliation
check is **skipped** (insufficient data) and `buildPageSummary` adds a capture
note — no pass/fail finding is invented.

## Rule IDs

| Rule ID                               | Severity | Fires when                                                  |
| ------------------------------------- | -------- | ----------------------------------------------------------- |
| `indexability-noindex-signal`         | warning  | Observed `noindex`/`none` in meta and/or `X-Robots-Tag`     |
| `indexability-robots-conflict`        | error    | Meta robots and `X-Robots-Tag` disagree on noindex/nofollow |
| `indexability-robots-blocked`         | warning  | `robots-evaluation` observed crawl block for audited path   |
| `indexability-canonical-mismatch`     | warning  | Canonical target ≠ browser-navigation final URL             |
| `indexability-redirect-loop`          | error    | Repeated URL in observed redirect chain                     |
| `indexability-redirect-excessive`     | warning  | More than five redirect hops observed                       |
| `indexability-non-html-content`       | warning  | `Content-Type` present and not `text/html`                  |
| `indexability-sitemap-robots-blocked` | warning  | Sitemap lists URL while robots evaluation blocks crawl      |

## Combination matrix

| HTTP status         | robots.txt      | Meta robots | X-Robots-Tag    | Canonical         | Sitemap    | Expected reconciliation                                                                    |
| ------------------- | --------------- | ----------- | --------------- | ----------------- | ---------- | ------------------------------------------------------------------------------------------ |
| 200 HTML            | allow           | (absent)    | (absent)        | matches final URL | listed     | No blocking signals observed in captured evidence                                          |
| 200 HTML            | allow           | `noindex`   | (absent)        | matches           | listed     | `indexability-noindex-signal`                                                              |
| 200 HTML            | allow           | (absent)    | `noindex`       | matches           | listed     | `indexability-noindex-signal`                                                              |
| 200 HTML            | allow           | `noindex`   | `noindex`       | matches           | listed     | `indexability-noindex-signal` (both sources cited)                                         |
| 200 HTML            | allow           | `noindex`   | `index, follow` | matches           | listed     | `indexability-noindex-signal` + `indexability-robots-conflict`                             |
| 200 HTML            | disallow path   | (absent)    | (absent)        | matches           | listed     | `indexability-robots-blocked` + `indexability-sitemap-robots-blocked`                      |
| 200 HTML            | disallow path   | (absent)    | (absent)        | matches           | not listed | `indexability-robots-blocked`                                                              |
| 301→200 HTML        | allow           | (absent)    | (absent)        | matches final URL | —          | No anomaly if ≤5 hops; advisory if >5 hops                                                 |
| loop                | —               | —           | —               | —                 | —          | `indexability-redirect-loop`                                                               |
| 200 PDF             | allow           | (absent)    | (absent)        | —                 | —          | `indexability-non-html-content`                                                            |
| 200 HTML            | — (not fetched) | `noindex`   | (absent)        | —                 | —          | `indexability-noindex-signal`; summary notes insufficient robots data                      |
| 200 HTML            | allow           | (absent)    | (absent)        | off-page URL      | —          | `indexability-canonical-mismatch` when both canonical + navigation captured                |
| headers unavailable | allow           | `noindex`   | —               | —                 | —          | `indexability-noindex-signal` from meta only; summary `unknown` / insufficient header note |

## Page summary wording

`buildPageSummary` indexability status values:

- **`unknown`** — Required network/robots captures missing; cannot reconcile.
- **`signals-partial`** — Some sources captured; findings describe observed
  signals. Wording uses “observed”, “signal”, and “captured evidence”. Never
  `indexable` or claims about Google’s index.

Blocking rule families (`indexability-noindex-signal`, `indexability-robots-blocked`,
`indexability-robots-conflict`, `indexability-redirect-loop`,
`indexability-sitemap-robots-blocked`) elevate the summary reason to mention
observed blocking signals.

## Tests

Table-driven cases live in `src/lib/rules/indexability-rules.test.ts` and mirror
the rows above with stable `ruleId` / severity assertions.
