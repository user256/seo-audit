# Googlebot-Style Render Experiment — Feasibility Spike (Ticket 304)

Status: **spike complete — decision: defer.** No `debugger` permission has been
added to the manifest and no prototype UI ships from this ticket. See
[Recommendation](#recommendation).

This document is the required technical design for Ticket 304: it compares
`chrome.debugger`/CDP against ordinary tabs/scripting APIs for a "Googlebot-style"
five-second render-and-capture experiment (`mini-seo-tech-audit-extension-spec.md`,
"Googlebot Rendering Simulation"), states what each path can and cannot honestly
deliver, and records the recommendation and its revisit conditions. It is
referenced from `src/lib/googlebot-spike/decision.ts`, which locks the decision
in code so it cannot silently drift from this report.

## Goal

Prove or reject a narrowly scoped, explicitly disclosed Chrome debugger-based
render experiment that approximates "visit with a Googlebot-like user agent and
desktop viewport, wait 5 seconds without interaction, capture the DOM."

## What the experiment would need

To be honest about the label "Googlebot-style," the experiment needs all three
of:

1. A user agent that is visible to the page's own JavaScript
   (`navigator.userAgent` / `navigator.userAgentData`), not only the outgoing
   HTTP header — otherwise any client-side UA sniffing on the page is not
   exercised and the experiment silently measures nothing new.
2. A desktop viewport/device-metrics override (width, height, device scale
   factor, mobile flag) independent of the extension's own window size, so the
   capture reflects a consistent, documented device profile rather than
   whatever size the user's OS window happens to be.
3. A five-second, no-interaction wait before capture, per the spec and Ticket
   304's own decision log ("stopping JavaScript execution after exactly 5
   seconds" is explicitly flagged there as possibly unsupportable).

## Options considered

| Option                                                                                                                                    | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chrome.debugger` + CDP (`Network.setUserAgentOverride`, `Emulation.setDeviceMetricsOverride`, `Page.navigate`, `Runtime`/`DOM` snapshot) | **Technically capable, but disproportionate.** Only path that delivers a JS-visible UA override, true device-metrics emulation, and (approximately) a scripted wait. Requires the highest-risk permission this extension could request, a persistent user-visible "debugging this browser" banner on every run, and CDP-version maintenance risk. See [Option A](#option-a-chromedebugger--cdp).                                                                             |
| Ordinary `chrome.tabs` / `chrome.scripting` (already used by Ticket 303)                                                                  | **Cannot deliver a JS-visible UA override or device-metrics emulation.** Can only rewrite the outgoing HTTP `User-Agent` header (via a new `declarativeNetRequest` permission, not currently declared) and open a same-engine tab sized to an approximate viewport. This is materially the same shape of experiment Ticket 303 already ships, plus a header that does not change what the page's own JavaScript sees. See [Option B](#option-b-ordinary-tabsscripting-apis). |
| Unsupported (neither path adopted)                                                                                                        | **This spike's conclusion for now.** Neither path clears the bar of "meaningfully more truthful than what Ticket 303 already ships" versus "acceptable permission/UX/maintenance cost." See [Recommendation](#recommendation).                                                                                                                                                                                                                                               |

### Option A: `chrome.debugger` + CDP

**Capabilities used:**

- `Network.setUserAgentOverride({ userAgent, platform, acceptLanguage })` —
  overrides both the outgoing HTTP header and `navigator.userAgent` /
  `navigator.platform` as seen by page JavaScript.
- `Emulation.setDeviceMetricsOverride({ width, height, deviceScaleFactor, mobile: false })`
  — a documented desktop viewport independent of the extension's own window.
- `Page.navigate` + `Page.loadEventFired` / `Page.lifecycleEvent` — drive the
  dedicated tab to the audited URL under debugger control.
- A plain 5-second timer before capture (`setTimeout` in the extension, not a
  CDP primitive) — reproducible, and the only part of "stop after exactly 5
  seconds" that is safely supportable. CDP has no "freeze JS execution at
  wall-clock T" primitive; the closest tool, `Debugger.pause`, stops at the
  next statement boundary, not a wall-clock instant, and would leave the page
  execution paused rather than "stopped as if the page settled" — the decision
  log's suspicion is confirmed, not resolved.
- `DOM.getDocument` / `Runtime.evaluate` (or reuse of the existing
  `collectDomFactsInPage` collector via `chrome.scripting.executeScript`, which
  is orthogonal to CDP and stays usable once attached) for the snapshot.
- `Debugger.detach` in `finally`.

**Permissions.** `debugger` is Chrome's highest-risk extension permission
(full Chrome DevTools Protocol access: read/modify page content, intercept
network, access cookies). Declaring it — even as `optional_permissions` — is a
"very high risk" classification independent of when it is requested; the
Chrome Web Store review bar for extensions carrying it is stricter than for
this extension's current permission set (`storage`, `activeTab`, `sidePanel`,
`scripting`, `tabs`, `webRequest`), and some enterprise `ExtensionSettings`
policies block installation or force-disable extensions that request it,
regardless of `optional_permissions` framing. That risk profile is
disproportionate for one comparison feature in an inspector that already ships
a CSS/JS render comparison (Ticket 303) and network/header probes without it.

**Chrome debugger attachment banner.** Every `chrome.debugger.attach()` call
shows a persistent, page-top infobar — "‹Extension name› started debugging
this browser" — that Chrome gives the extension **no API to suppress or
customise** (the only workaround, the `--silent-debugger-extension-api`
command-line flag, requires the _user_ to relaunch their own browser with a
custom flag; the extension cannot set it). Three properties make this worse
than a one-time interruption:

- It reappears **every single run**, not once per session — a user who
  approves the double-confirmation once still sees the banner on every
  five-second experiment.
- The banner text lingers after `detach()` until the user dismisses it by
  clicking its own "Cancel" button; a user glancing back at the tab after the
  experiment finished can still see "started debugging this browser" and
  reasonably wonder whether it is still active.
- The banner's "Cancel" button lets the **user** force-detach at any moment;
  Chrome fires `chrome.debugger.onDetach` with `reason: "canceled_by_user"`
  when that happens, which the runner must treat as a normal, expected
  interruption (see [Recovery](#recovery)) — not an error path, since it is a
  legitimate, always-available user action outside the extension's control.

**User impact.** This extension's whole trust story is "local-first,
no exfiltration, least-privilege" (`CLAUDE.md`). A banner that reads
"‹this extension› is debugging your browser" on every run cuts directly
against that story for a feature whose payoff — a same-Chromium-engine capture
under a spoofed UA/viewport — is incremental over the CSS/JS comparison
already shipped. It also raises the bar for what a five-second, no-interaction
wait can prove: a slow/observed user cannot tell whether "nothing changed"
means the page genuinely settled or that CDP's involvement altered timing.

**Testability.** The attach/detach/`sendCommand` surface can be faked behind a
seam analogous to `CssJsCompareChromeOps` (see
`src/lib/css-js-compare/types.ts`), so unit tests of the orchestration logic
(phases, cancellation, `finally` cleanup) are feasible without a real
debugger session. What is **not** unit-testable is the actual CDP behaviour:
attach races against an already-open DevTools window ("Another debugger is
already attached to the tab"), the exact timing of `onDetach` versus a tab
close, and whether a given Chrome release still accepts the same
`Emulation`/`Network` method/parameter names — CDP is explicitly published by
Chrome as **not** subject to the extension API's normal deprecation/versioning
guarantees, so this needs a real-Chrome manual matrix re-run on every Chrome
milestone bump, not just at ship time (compare to the already-heavier manual
matrix Ticket 303 requires in `docs/css-js-comparison.md`).

**Maintenance risk.** Beyond CDP-version drift: MV3 service workers are not
persistent, so an attached debugger target tracked only in SW memory is lost
on SW restart/eviction with no notification to the (now-restarted) SW that a
tab is still "attached" from Chrome's point of view — the SW must reconcile
via `chrome.debugger.getTargets()` on startup rather than assuming its own
in-memory state is authoritative. That reconciliation, plus the
already-required cross-Chrome-version CDP re-validation, is ongoing cost this
inspector does not currently carry for any other feature.

**Recovery.** {#recovery}

| Path                                                 | Behaviour if adopted                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Close-tab                                            | `chrome.tabs.onRemoved` fires; runner treats it like the existing CSS/JS comparison's tab-closed path — stop the run, best-effort `detach()` (a detach on an already-gone tab throws and is swallowed, mirroring `closeTab` in `chrome-ops.ts`), record a limitation, no pass/fail finding.                  |
| Navigation (mid-capture)                             | `Page.frameNavigated`/`Network.setUserAgentOverride` state does not survive an unrelated top-level navigation reliably across CDP versions; runner must detect via `chrome.tabs.onUpdated` and abort the capture rather than trust a post-navigation snapshot as "Googlebot-style."                          |
| Attach failure                                       | `chrome.debugger.attach()` callback error (e.g. DevTools already open, tab is a restricted `chrome://` page, permission not granted) — no debugger session exists, so there is nothing to detach; surface as a `CaptureError`-style failure, never a finding.                                                |
| Timeout (5s wait or wall-time budget)                | Same bounded-budget pattern as `CSS_JS_COMPARISON_LIMITS.maxWallTimeMs` — a `finally` block runs `detach()` unconditionally once the budget is exceeded.                                                                                                                                                     |
| Attach cancelled by the banner's own "Cancel" button | `onDetach` fires with `reason: "canceled_by_user"` — must be treated as a normal stop, not an error; the run reports "cancelled by user via the browser's debugger banner," not a capture failure.                                                                                                           |
| Service-worker restart mid-attach                    | On SW startup, reconcile with `chrome.debugger.getTargets()`; any target this extension owns but has no matching in-memory run for is force-detached and surfaced to the user as a leftover-cleanup notice next time the side panel opens — silently leaving an attached debugger session is not acceptable. |

None of these paths are hypothetical edge cases; they are exactly the
failure/recovery matrix Ticket 304's acceptance criteria require before any
prototype could ship, and each one adds orchestration code beyond what Ticket
303's dedicated-tab pattern already needed.

### Option B: ordinary tabs/scripting APIs

What is already available without any new permission (`scripting`, `tabs`,
reused from Ticket 303):

- A dedicated, inactive background tab (`chrome.tabs.create({ url, active: false })`)
  — same pattern as `src/lib/css-js-compare/chrome-ops.ts`.
- A fixed-size window/tab as an approximate "desktop viewport" — this sets the
  **browser window's** dimensions, not a CDP device-metrics override, so it
  does not control device scale factor, mobile emulation, or touch capability,
  and is one extension-window setting shared across whatever else is open in
  that window.
- A plain 5-second `setTimeout` before capture — fully supportable, identical
  reproducibility to Option A's wait, no debugger required.
- The existing `collectDomFactsInPage` / `collectVisibleTextFingerprintInPage`
  collectors via `chrome.scripting.executeScript` for the snapshot — no new
  code needed here at all.

**What ordinary APIs cannot do (explicit):**

- **No JS-visible user-agent override.** There is no public MV3 API to change
  `navigator.userAgent` / `navigator.userAgentData` for a tab's page-world
  JavaScript. The only UA-adjacent lever available without `debugger` is
  rewriting the outgoing HTTP `User-Agent` **header** via a
  `declarativeNetRequest` `modifyHeaders` rule — a permission this extension
  does not currently declare, and one that only affects what the **server**
  sees, not what client-side UA-sniffing code sees. A page that renders
  differently based on `navigator.userAgent` (a real, if rare, SEO-relevant
  cloaking signal) would not exercise that branch at all — silently
  understating what "Googlebot-style" claims to test.
- **No device-metrics/viewport emulation.** No public API sets device scale
  factor, mobile emulation, or a viewport independent of the actual browser
  window size.
- **No precise "stop JavaScript execution at exactly 5 seconds."** The only
  public lever that disables JavaScript at all is
  `chrome.contentSettings.javascript.set(...)`, which Ticket 303 already
  evaluated and deliberately deferred (see `docs/css-js-comparison.md`,
  "JavaScript off (deliberately omitted)") because it is **origin-scoped, not
  tab-scoped**, and has poor error-mode recovery. Nothing about Ticket 304
  changes that analysis — it would still disable JavaScript for every open
  tab on the audited origin, not just the dedicated comparison tab.

Because of these gaps, the best an "ordinary APIs" implementation could
honestly claim is: **a same-browser, same-engine tab that waited five seconds
before capture — the same claim the CSS/JS comparison (Ticket 303) already
makes** — with, at most, a rewritten request header that most pages'
client-side rendering never inspects. That is not a "Googlebot-style"
experiment; it is Ticket 303 again with an unverifiable header change bolted
on, and calling it "Googlebot-style" would overstate what it measures.

### Unsupported conclusion

If the bar is "genuinely JS-visible UA + device-metrics emulation + a
scripted wait" (what the label "Googlebot-style" implies), only `chrome.debugger`
clears it, and Option A's permission/banner/maintenance cost is disproportionate
to the incremental signal above the already-shipped CSS/JS comparison. If the
bar is lowered to "same-engine wait + capture," Option B already exists in
spirit as Ticket 303 and does not need a new feature or permission — building
a second, near-duplicate experiment under a more impressive-sounding name would
itself be a `CLAUDE.md` honesty problem, not a feasibility win. Neither path is
adopted by this spike.

## Recommendation

**Defer.**

Rationale, weighing the guidance in Ticket 304 and `CLAUDE.md`:

- The only path that would make "Googlebot-style" technically honest
  (`chrome.debugger`) carries the extension's highest-risk permission, a
  per-run user-visible debugging banner Chrome gives no way to suppress, and
  an open-ended CDP-version maintenance burden — for a payoff that is
  incremental over the CSS/JS comparison (Ticket 303) and network/header
  probes this extension already ships.
- The decision log's own suspicion — "stopping JavaScript execution after
  exactly 5 seconds may not be safely supportable" — is confirmed by this
  spike: CDP has no wall-clock-precise execution stop, only a next-statement
  breakpoint pause, which is a different (and less honest) claim than the spec
  implies.
- This is explicitly **not "reject"**: nothing here rules the feature out
  forever. It is deferred pending an external product/permission decision
  (Ticket 304's own "External: Chrome debugger permission/product decision"
  dependency), consistent with Ticket 305's already-written fallback ("If
  Ticket 304 ships debugger support, use profiles [...]; otherwise offer
  profiles only for clearly-labelled network probes or defer the switcher").
  Ticket 305 should take the "otherwise" branch: UA profiles apply to clearly
  labelled network probes only, not a dedicated rendered tab.

### What would change this decision

Revisit if any of the following becomes true:

- Product explicitly accepts the `debugger` permission's Chrome Web Store
  review, enterprise-policy, and per-run banner cost for this specific
  feature (an intentional, informed decision — not a default).
- Chrome ships a public, non-`debugger` API for JS-visible UA override and/or
  device-metrics emulation scoped to a single tab (no such API exists today).
- User/customer demand for a genuine Googlebot-style comparison, measured
  against real usage of the already-shipped CSS/JS comparison, shows the
  existing experiment is insufficient for a common, real diagnosis need.

Until then, Ticket 305 (UA Profiles and Audit Disclosures) should proceed
without debugger-backed rendered-tab profiles, and Ticket 399 (Sprint 3
review) should record this defer decision rather than treat 304 as blocking.

## Permissions

No new manifest permissions were added for this ticket. `debugger` is **not**
requested (neither as a required nor an `optional_permissions` entry); see
`manifest.config.ts`. The decision and its rationale are locked in code at
`src/lib/googlebot-spike/decision.ts` so a future change to either requires an
explicit code change and a new test expectation, not a silent drift from this
report.

## Facts vs. rules

This spike produces a decision, not a page-level finding. No `CaptureError` or
audit finding is generated by this ticket; `src/lib/googlebot-spike/` only
exports the recorded decision for other code (and tests) to reference.
