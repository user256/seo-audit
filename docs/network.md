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

Chrome constraints (Ticket 201):

- MV3 service worker uses non-blocking `webRequest` (`onHeadersReceived`,
  `onBeforeRedirect`, `onCompleted`, `onErrorOccurred`) for **main_frame** only,
  with `responseHeaders` + `extraHeaders`. Requires the `webRequest` permission
  plus Ticket 212 HTTP(S) `host_permissions`.
- Listeners must be armed (`WATCH_TAB_NAVIGATION`) **before** navigation.
  Side panel offers **Capture navigation (reload)** when the current load was
  not observed.
- Incognito follows the extension’s install mode; header visibility matches
  Chrome 114+ webRequest behaviour. Extension / `chrome://` / `file://` URLs
  stay unsupported.

## Navigation capture (Ticket 201)

Implementation: `src/lib/network/navigation-capture.ts` +
`src/background/navigation-listeners.ts`.

Observed results are always `source: browser-navigation`. Extension fetches
remain `extension-fetch` via `safeFetch`.

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
