# CSS/JS Comparison Experiment (Ticket 303)

Status: implemented (CSS-off only). JavaScript-off is deliberately omitted —
see [JavaScript off](#javascript-off-deliberately-omitted).

This document is the required technical design for Ticket 303: it states
which Chrome APIs are used, what the comparison can and cannot measure, and
the manual verification matrix for reload/permission/failure/cancel
behaviour. It is referenced from code comments in
`src/content/css-disable-injection.ts`,
`src/lib/css-js-compare/run-css-js-comparison.ts`, and the crawl-signals model
so the rationale stays next to the implementation.

## Goal

Offer an opt-in, reversible comparison of the audited page's DOM (title,
meta description, canonical, headings, links, JSON-LD counts, bounded visible
text) rendered normally versus with its CSS disabled. This can surface
content that depends on `display:none`-by-default patterns, CSS-driven
reveal/hide, or other rendering-only differences — signals worth flagging,
never a claim of crawler-rendering parity.

## CSS-off method

**Chosen approach: dedicated background tab + `chrome.scripting` injection
that disables stylesheets (method id `css-injection-disable-v1`).**

We evaluated three ways to produce a "CSS disabled" page state:

| Option                                                                    | Verdict                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser DevTools "Disable CSS" (Rendering pane)                           | **Not usable.** This is a DevTools-protocol-only affordance; it is not exposed to extensions via any `chrome.*` API. There is no way to script it from an MV3 extension without attaching `chrome.debugger`, which we are avoiding (see below). |
| `chrome.debugger` + `Emulation`/CSS domain tricks                         | Rejected. `debugger` is a highly privileged, user-visible ("this extension is debugging this browser") permission, disproportionate to a comparison feature, and against the least-privilege invariant in `CLAUDE.md`.                          |
| `chrome.scripting.executeScript` disabling stylesheets in a dedicated tab | **Chosen.** Uses permissions the extension already declares (`scripting`, `tabs`, `activeTab`/host permissions), is fully scriptable, and keeps the _audited_ tab completely untouched.                                                         |

Mechanically (`src/content/css-disable-injection.ts`, function
`disableCssInPage`, injected via `chrome.scripting.executeScript({ func })`):

1. Set `sheet.disabled = true` for every entry in `document.styleSheets`
   (covers both `<link rel="stylesheet">` and `<style>` elements).
2. Remove every element's inline `style` attribute — inline styles are CSS
   too, and would otherwise keep hiding/positioning content the same way an
   author stylesheet would.
3. Append a marker `<style data-seo-audit-css-kill="css-injection-disable-v1">`
   element (disabled, diagnostic only) so the injected state is detectable
   from the page.

This intentionally does **not** force elements visible (no
`* { display: revert !important }`-style override). Forcing visibility would
fabricate a rendering state no real browser produces; the goal is an honest
"author CSS is absent" approximation, not a "reveal everything" trick.

### Why a dedicated tab, not the active tab

The active/audited tab is never mutated. Disabling CSS in place would change
what the user is looking at, require a second reload-and-restore step to
undo, and risk the "restore" step failing (crash, navigation, extension
reload) and leaving the user's page permanently broken. A dedicated tab:

- Is opened inactive (`active: false`), so it never steals focus.
- Is closed unconditionally in the runner's `finally` block — on success,
  cancellation, wall-time timeout, or any thrown error.
- Never touches `contentSettings`, `debugger`, or any other tab's rendering.

### Known limitations

Documented in `CssJsComparisonResult.limitations` and surfaced in the panel,
not silently dropped:

- **Closed shadow roots and cross-origin iframes** are not reachable from the
  page-world script; any stylesheets inside them are not disabled.
- **Constructed/adopted stylesheets** (`CSSStyleSheet` objects assigned via
  `document.adoptedStyleSheets` or a shadow root's `adoptedStyleSheets`) are
  not enumerated by `document.styleSheets` and are therefore not disabled by
  this method. Pages using the Constructable Stylesheets API extensively may
  show smaller diffs than a "true" no-CSS render would.
  Cross-origin same-site stylesheets can also throw on element style reads in
  rare embed cases; these are counted as `inaccessibleStylesheetCount` and
  reported, not swallowed.
- **`[hidden]` attributes and user-agent default styles are left intact.**
  That is correct, not a limitation — they are not author CSS.
- The comparison never claims Googlebot or any other crawler's rendering
  behaviour. It is a same-browser, same-engine A/B of "author CSS present"
  vs. "author CSS disabled by this method".

## JavaScript off (deliberately omitted)

This ticket does **not** implement a JavaScript-disabled comparison. Two
Chrome capabilities would be required, and both conflict with product
invariants as they stand today:

1. **`contentSettings` permission.** Chrome only exposes a way to disable
   JavaScript via `chrome.contentSettings.javascript.set(...)`, which is a
   **new manifest permission** this extension does not currently request.
   Adding it is a deliberate least-privilege decision, not a one-line change.
2. **Origin-scoped, not tab-scoped, effect.** `contentSettings.javascript`
   rules apply per-origin (optionally per-pattern), not per-tab. Setting it
   for the audited origin would disable JavaScript on **every open tab on
   that origin**, not just a dedicated comparison tab — including the
   audited tab itself and any other tab the user has open there. There is no
   MV3 API to scope a JS-disable to a single tab.
3. **Reload + recovery risk.** Because the setting is origin-scoped, "turning
   it back on" requires resetting the content-setting rule _and_ reloading
   every affected tab back to a working state. If the extension crashes,
   reloads, or the browser closes mid-run, an origin could be left with
   JavaScript disabled with no obvious owner to restore it — a state the user
   did not ask for and might not notice until later.

Given `CLAUDE.md`'s invariant that anything which "reloads a page, changes a
setting, or attaches a debugger needs a user action and an up-front
explanation, and must restore state on completion/error," we are not willing
to ship an origin-wide, hard-to-guarantee-recoverable setting change for this
ticket. **This is deferred until product explicitly accepts the
`contentSettings` permission surface and we have a documented, tested
per-origin restore path** (candidate follow-up: a dedicated ticket that
tracks the origin's prior setting value, restores it in a `finally`, and
exposes a manual "restore JS for this origin" action in the UI as a
safety net if automatic restore fails).

The result type reflects this explicitly rather than silently leaving a gap:
`CssJsComparisonResult.javascriptOff = { supported: false, reason: '...' }`
(see `JAVASCRIPT_OFF_OMITTED` in `run-css-js-comparison.ts`), and the UI
disclosure states the same thing before any run.

## Never Googlebot/crawler parity, never automatic

- The panel's disclosure text and every generated detail string say "not
  Googlebot or crawler-rendering parity." This is a same-browser, same-JS-
  engine comparison of one page state against another — nothing more.
- The comparison never runs on page load, audit capture, or any other
  implicit trigger. It only starts when the user opts in from the crawl
  signals panel via **Run comparison** with the CSS-off checkbox explicitly
  disclosed and pre-checked as the only offered option.
- Cancelling mid-run (**Cancel**) stops the run at the next checkpoint and
  still closes the dedicated tab in `finally`.

## Implementation summary

`src/lib/css-js-compare/`:

- `types.ts` — `CssJsComparisonResult`, phases, `CssJsCompareChromeOps` (the
  tab/scripting seam used for testing).
- `limits.ts` — `CSS_JS_COMPARISON_LIMITS` (45s wall-time budget, 20s tab-load
  timeout, bounded visible-text char cap) and UI display caps.
- `compare-dom-facts.ts` — pure, deterministic diff of two `DomFacts` captures
  (title, meta description, canonical, headings, link counts, JSON-LD parse
  counts, visible-text fingerprint). Every comparison is a plain string/count
  equality check; there is no heuristic scoring, so the same two captures
  always produce the same diffs.
- `chrome-ops.ts` — real `chrome.tabs`/`chrome.scripting` implementation of
  `CssJsCompareChromeOps` (create/poll-load/close tab, run
  `collectDomFactsInPage`, run `collectVisibleTextFingerprintInPage`, run
  `disableCssInPage`).
- `run-css-js-comparison.ts` — `runCssJsComparison`, the orchestrator:
  1. Capture baseline `DomFacts` + visible-text fingerprint on the **active**
     tab (same collector used everywhere else in the extension — no separate
     code path for "normal" capture).
  2. Open a dedicated, inactive tab to the audited URL.
  3. Wait (bounded) for that tab to report a `complete` load.
  4. Inject `disableCssInPage`.
  5. Capture experiment `DomFacts` + visible-text fingerprint from that tab
     with the same collector.
  6. Diff deterministically via `compareDomFacts`.
  7. Close the dedicated tab in a `finally` — this runs on success, on
     cancellation, on a thrown error, and when the wall-time budget is
     exceeded.
  - Cancellation is cooperative: `shouldContinue()` is checked before each
    phase and reacts to `cancelCssJsComparison(requestId)` or the wall-time
    budget; already-running async calls (e.g. `waitForTabLoad`) are not
    forcibly aborted mid-flight, but no further phases start once cancelled.
- `index.ts` — barrel export.

`src/content/`:

- `css-disable-injection.ts` — `disableCssInPage` (see above). Self-contained
  (no imports/closures) so it works with
  `chrome.scripting.executeScript({ func })`.
- `visible-text-fingerprint.ts` — `collectVisibleTextFingerprintInPage`, a
  page-world helper that walks the DOM with a `TreeWalker`, skips nodes
  hidden via `display:none`/`visibility:hidden`/zero-size, and returns a
  bounded (`maxChars`), hashed fingerprint (`{ charCount, hash, truncated }`).
  `DomFacts` does not carry a full visible-text capture, so this is the
  targeted addition the ticket calls for; it does not duplicate any other
  field DomFacts already exposes.

Messages (`src/background/messages.ts`): `RUN_CSS_JS_COMPARISON` /
`CANCEL_CSS_JS_COMPARISON` requests, `CSS_JS_COMPARISON_RESULT` /
`CSS_JS_COMPARISON_CANCELLED` responses, and a best-effort
`CSS_JS_COMPARISON_PROGRESS` broadcast while a run is in flight (mirrors the
existing hreflang-cluster/variant-tests/soft-404 progress pattern).

UI (`src/sidepanel/crawl-signals-view.ts` + `crawl-signals-model.ts`): a
"CSS/JS comparison" crawl-signals panel with the pre-run disclosure (new tab,
method id, origin, restore/close behaviour, "CSS off only — see docs" note
in place of a JS-off checkbox), Run/Cancel actions, live phase progress, and
—once complete— the diff table, observations, and limitations list.

## Permissions

No new manifest permissions were added. The feature reuses permissions the
extension already declares: `scripting`, `tabs`, and the existing HTTP(S)
host permissions. `contentSettings` and `debugger` are **not** requested (see
[JavaScript off](#javascript-off-deliberately-omitted)).

## Facts vs. rules

A failed baseline or experiment capture (e.g. the collector returns nothing,
the dedicated tab never reaches `complete`, a stylesheet is inaccessible) is
recorded as a `limitations` entry / `CssJsCaptureOutcome.ok = false`, never a
pass/fail finding. `compareDomFacts` only runs when both captures succeeded
and the run was not cancelled; otherwise the result reports empty diffs plus
the specific capture failure in `limitations`, consistent with the
`CLAUDE.md` invariant that a missing capture is evidence, not a rule
violation.

## Manual verification matrix

Automated tests cover `compareDomFacts` and `runCssJsComparison` with fake
`CssJsCompareChromeOps` (see
`src/lib/css-js-compare/compare-dom-facts.test.ts` and
`run-css-js-comparison.test.ts`) and the page-world helpers under jsdom
(`src/content/css-disable-injection.test.ts`,
`visible-text-fingerprint.test.ts`). The following require a real Chrome
session with the unpacked extension loaded and should be re-checked whenever
the runner, chrome-ops, or injection scripts change:

| #   | Scenario                     | Steps                                                                                                                                                                             | Expected                                                                                                                                                                                                                                             |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Happy path                   | Open an HTTP(S) page with visible author CSS (e.g. a page using `display:none` for a mobile menu), grant site access, open the CSS/JS comparison panel, click **Run comparison**. | A new inactive background tab briefly appears in the tab strip, then closes automatically. Panel shows `done`, at least one diff/observation if the page has CSS-dependent content, and `experimentTabRestored: true`.                               |
| 2   | No CSS-dependent differences | Run on a static page with no `display:none`/CSS-driven content changes.                                                                                                           | Panel shows `done` with 0 changed diffs; no false-positive observations.                                                                                                                                                                             |
| 3   | Cancel mid-run               | Click **Run comparison**, then immediately click **Cancel** before it reaches `done`.                                                                                             | Panel transitions to `cancelled`. The dedicated tab (if already opened) is closed — check the tab strip has no lingering "seo-audit" comparison tab. `limitations` includes the cancellation note.                                                   |
| 4   | Comparison tab fails to load | Run comparison against a URL that is slow/unreachable (e.g. block the host temporarily, or point at a URL that 404s/times out).                                                   | `waitForTabLoad` times out after `tabLoadTimeoutMs`; run proceeds with a `limitations` entry about the load timeout instead of hanging indefinitely. Tab still closes in `finally`.                                                                  |
| 5   | Reload during run            | Start a run, then reload the _active_ (audited) tab while the comparison tab is still loading/capturing.                                                                          | The active-tab baseline was already captured before the reload (or the comparison completes/fails independently); reloading the audited tab must not reopen or duplicate the dedicated comparison tab, and the comparison tab still closes normally. |
| 6   | Site access revoked mid-run  | Revoke the extension's host permission for the origin (via the extension's own access UI or `chrome://extensions`) while a run is in flight.                                      | Capture calls fail gracefully (`CaptureError`-style `ok:false` outcome with a message), the dedicated tab still closes in `finally`, and the panel shows the failure in `limitations` rather than crashing the side panel.                           |
| 7   | Repeated runs                | Run the comparison twice in a row on the same tab.                                                                                                                                | Second run opens a fresh dedicated tab (no reuse of a stale tab id) and produces an independent result; no leftover tabs accumulate from run 1.                                                                                                      |
| 8   | Side panel closed during run | Start a run, close the side panel before it finishes, reopen it.                                                                                                                  | No unhandled promise rejection in the service worker; the dedicated tab is still closed once the run finishes (`onProgress`/response delivery to the closed panel is best-effort and swallowed, per `broadcastCssJsComparisonProgress`).             |

Record any deviation from "Expected" as a bug against Ticket 303, not as a
silent behaviour change.
