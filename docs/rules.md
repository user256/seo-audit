# Page findings rules (Sprint 1)

Deterministic rules that evaluate **DOM evidence only** from a `PageSnapshot`
(Ticket 103/104). Missing headers or robots.txt never become pass/fail findings;
they appear as capture notes / unknown indexability in the page summary.

## Severity policy

| Severity   | Meaning                                                                              |
| ---------- | ------------------------------------------------------------------------------------ |
| `critical` | Reserved for severe blockers (unused in Sprint 1 DOM set).                           |
| `error`    | Clear defect in captured DOM (missing title, multiple canonicals, bad hreflang URL). |
| `warning`  | Likely issue or strong advisory (missing description, noindex, missing alt).         |
| `info`     | Soft advisory (title length band, nofollow present).                                 |

Rules only evaluate evidence they received. Inaccessible fields produce no finding
from that rule (the collector already recorded the access failure as evidence state).

## Check catalogue and availability

`CHECK_CATALOGUE` is the single registry for the runner and selection UI. Each
check has a stable ID, plain-language label/description, category, source
reference, required evidence sources, cost (`dom`, `network`, or `experiment`),
and an opt-in flag. Current DOM checks are defaults; future network and
experiment checks can declare opt-in without changing the runner.

`resolveCheckAvailability({ accessGranted, evidenceBySource })` reports one of:

- `available` when all required evidence rows can be used;
- `needs-access` when a required row is absent and the active tab cannot yet be
  read (unsupported scheme or missing tab);
- `unavailable` when access exists but a source has not been captured, or a
  captured field is explicitly inaccessible.

An evidence row whose field state is `absent` is still available to a rule: it
is evidence that the page element was missing. A missing evidence row never
becomes a pass.

## Rule IDs

| Rule ID                                               | Category          | Severity | Trigger                                             |
| ----------------------------------------------------- | ----------------- | -------- | --------------------------------------------------- |
| `title-missing`                                       | metadata          | error    | Title absent or empty                               |
| `title-duplicate`                                     | metadata          | error    | Multiple title values                               |
| `title-length`                                        | metadata          | info     | Title outside 10–60 character advisory band         |
| `description-missing`                                 | metadata          | warning  | Meta description absent or empty                    |
| `description-duplicate`                               | metadata          | warning  | Multiple meta descriptions                          |
| `canonical-missing`                                   | indexability      | warning  | Canonical absent or empty                           |
| `canonical-multiple`                                  | indexability      | error    | More than one canonical                             |
| `canonical-malformed`                                 | indexability      | error    | Canonical href does not resolve                     |
| `canonical-off-page`                                  | indexability      | warning  | Canonical origin ≠ page origin                      |
| `robots-nofollow`                                     | indexability      | info     | Meta robots includes nofollow (DOM only)            |
| `indexability-noindex-signal`                         | indexability      | warning  | Observed noindex in meta and/or X-Robots-Tag        |
| `indexability-robots-conflict`                        | indexability      | error    | Meta robots disagrees with X-Robots-Tag             |
| `indexability-robots-blocked`                         | indexability      | warning  | robots.txt evaluation observed crawl block          |
| `indexability-canonical-mismatch`                     | indexability      | warning  | Canonical target ≠ browser-navigation final URL     |
| `indexability-redirect-loop`                          | indexability      | error    | Redirect loop in browser-navigation chain           |
| `indexability-redirect-excessive`                     | indexability      | warning  | More than five redirect hops observed               |
| `indexability-non-html-content`                       | indexability      | warning  | Content-Type is present and not HTML                |
| `indexability-sitemap-robots-blocked`                 | indexability      | warning  | Sitemap lists URL blocked by robots.txt             |
| `hreflang-invalid-url`                                | international     | error    | Alternate hreflang href does not resolve            |
| `jsonld-malformed`                                    | structured-data   | warning  | JSON-LD script fails `JSON.parse`                   |
| `jsonld-unevaluated`                                  | structured-data   | info     | JSON-LD capture was truncated                       |
| `jsonld-top-level-non-object`                         | structured-data   | warning  | Complete JSON-LD is a scalar or mixes scalar roots  |
| `jsonld-context-missing` / `jsonld-context-malformed` | structured-data   | warning  | Captured graph root lacks a usable local `@context` |
| `jsonld-node-missing-type`                            | structured-data   | warning  | Root or direct `@graph` node has no `@type`         |
| `jsonld-duplicate-id`                                 | structured-data   | warning  | `@id` is repeated within one captured graph         |
| `jsonld-inventory-limited`                            | structured-data   | info     | Node, depth, or string inspection cap reached       |
| `language-missing`                                    | metadata          | warning  | `html[lang]` absent or empty                        |
| `images-missing-alt`                                  | accessibility-seo | warning  | Images with missing or empty `alt`                  |

## Page summary

`buildPageSummary` counts findings by severity and category. **Indexability
status is never `indexable`.** When headers and/or robots.txt were not captured,
status is `unknown` with an explicit insufficient-data reason. When reconciliation
evidence exists, status is `signals-partial` and wording uses “observed” /
“signal” — never a definitive search-engine indexing claim. See
`docs/indexability-matrix.md` for combination reference.

## Structured-data policy

Structured-data findings are generic, bounded JSON-LD observations. They do
not validate Schema.org vocabularies, retrieve remote contexts, execute JSON-LD,
or claim Google rich-result eligibility. Complete object payloads, top-level
arrays, and `@graph` members are inventoried; a graph root must declare a
non-empty string, object, or array of those as `@context`. The validator inspects
at most 200 object nodes to depth 20 and retains `@type`/`@id` prefixes using the
shared 2,000-character DOM string cap. Truncated source is explicitly
unevaluated rather than treated as malformed or valid.

## API

```ts
import { evaluatePageSnapshot } from './src/lib/rules/engine';

const { findings, summary } = evaluatePageSnapshot(pageSnapshot, {
  featureAvailability: session.featureAvailability,
  captureErrors: session.captureErrors,
  // Omit checkIds for the full default set.
  checkIds: new Set(['title-missing-or-duplicate']),
});
```
