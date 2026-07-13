# Network observation and safe fetch (Ticket 206)

Sprint 2+ network features share one boundary: **browser navigation** evidence
and **extension fetch** evidence are different sources and must stay labelled
that way in the data contract and UI.

Host access comes from Ticket **212** (required `http://*/*` + `https://*/*`).
This document does not re-introduce a per-origin Allow NUX.

## Capability decision — current-page headers / redirects

| Approach                                                | Verdict                                                                                                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Side-panel / SW `fetch` of the tab URL after load       | **Replay only.** Can return status/headers/body for a new request. **Must not** be labelled as the original navigation’s headers or redirect chain. |
| Attach `webRequest` / `webNavigation` before navigation | **True observation** for that tab’s main frame (Ticket **201**).                                                                                    |
| Attach listeners after navigation has finished          | **Too late.** Return `unavailable` with recovery `reload-and-reobserve`.                                                                            |
| Silent fallback from missing navigation → fetch         | **Forbidden.** Would mislabel replay as navigation.                                                                                                 |

**Product rule:** audits started after the page has already loaded get honest
`unavailable` navigation slots until the user opts into reload/re-observe
(Ticket 201). Callers that need robots/sitemaps/hreflang cluster pages use
`safeFetch` and show `source: extension-fetch`.

Chrome constraints to record with Ticket 201 wiring:

- MV3 service worker + `webRequest` (and optionally `webNavigation`) for
  main-frame correlation; confirm header visibility on Chrome 114+.
- Incognito: host permissions and listener behaviour follow the extension’s
  incognito install mode; document any gaps when 201 lands.
- Extension pages / `chrome://` / `file://` stay unsupported (`evaluateUrl`).

## `safeFetch` contract

Implementation: `src/lib/network/safe-fetch.ts`.

| Control          | Default                        | Notes                                                                                  |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Method           | `GET` (or `HEAD`)              | No request bodies.                                                                     |
| Redirects        | Manual follow, max **10** hops | Cross-origin hops allowed under 212; each hop recorded.                                |
| Timeout          | **15 000** ms per hop          | AbortError → `timeout` (or `aborted` if caller signal).                                |
| Body             | Not retained by default        | `includeBody: true` keeps at most **512 000** bytes, truncated.                        |
| Concurrency      | **4** in-flight                | Process-wide gate.                                                                     |
| Credentials      | `omit`                         | No cookies / ambient auth.                                                             |
| Referrer         | `no-referrer`                  |                                                                                        |
| Cache            | `no-store`                     |                                                                                        |
| Headers retained | allowlist                      | `content-type`, `x-robots-tag`, `cache-control`, `vary`, `location`, `refresh`, `link` |
| Correlation      | `requestId`                    | Generated when omitted.                                                                |

Failures use a normalised `ok: false` shape (`timeout`, `redirect-limit`,
`redirect-opaque`, `mime-mismatch`, `unsupported-scheme`, …) — map these into
`CaptureError` at the feature boundary; never invent pass/fail findings from
them alone.

## Navigation observer helpers

`src/lib/network/navigation-observation.ts` encodes the attach-before-navigate
rule for unit tests and Ticket 201. Until listeners are wired in the service
worker, `getNavigationObservation` returns `unavailable` /
`listener-not-attached` with `recovery: reload-and-reobserve`.
