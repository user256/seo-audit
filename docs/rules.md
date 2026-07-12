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

## Rule IDs

| Rule ID                 | Category          | Severity | Trigger                                     |
| ----------------------- | ----------------- | -------- | ------------------------------------------- |
| `title-missing`         | metadata          | error    | Title absent or empty                       |
| `title-duplicate`       | metadata          | error    | Multiple title values                       |
| `title-length`          | metadata          | info     | Title outside 10–60 character advisory band |
| `description-missing`   | metadata          | warning  | Meta description absent or empty            |
| `description-duplicate` | metadata          | warning  | Multiple meta descriptions                  |
| `canonical-missing`     | indexability      | warning  | Canonical absent or empty                   |
| `canonical-multiple`    | indexability      | error    | More than one canonical                     |
| `canonical-malformed`   | indexability      | error    | Canonical href does not resolve             |
| `canonical-off-page`    | indexability      | warning  | Canonical origin ≠ page origin              |
| `robots-noindex`        | indexability      | warning  | Meta robots includes noindex (DOM only)     |
| `robots-nofollow`       | indexability      | info     | Meta robots includes nofollow (DOM only)    |
| `hreflang-invalid-url`  | international     | error    | Alternate hreflang href does not resolve    |
| `jsonld-malformed`      | structured-data   | warning  | JSON-LD script fails `JSON.parse`           |
| `language-missing`      | metadata          | warning  | `html[lang]` absent or empty                |
| `images-missing-alt`    | accessibility-seo | warning  | Images with missing or empty `alt`          |

## Page summary

`buildPageSummary` counts findings by severity and category. **Indexability
status is never `indexable` in Sprint 1.** When headers and/or robots.txt were
not captured, status is `unknown` with an explicit reason. Even if those
captures exist later, Sprint 1 still reports `signals-partial` until Ticket 204
reconciliation lands.

## API

```ts
import { evaluatePageSnapshot } from './src/lib/rules/engine';

const { findings, summary } = evaluatePageSnapshot(pageSnapshot, {
  featureAvailability: session.featureAvailability,
  captureErrors: session.captureErrors,
});
```
