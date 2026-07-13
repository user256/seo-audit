# User-Agent profiles and audit disclosures (Ticket 305)

Implementation: `src/lib/ua-profiles/`. Wired into `safeFetch`
(`src/lib/network/safe-fetch.ts`) and the variant tests, soft-404 probe, and
hreflang cluster validation features (`src/lib/variants/`,
`src/lib/soft-404/`, `src/lib/hreflang/cluster-validate.ts`).

## Why network probes only

Ticket 304 (`docs/googlebot-style-experiment.md`) evaluated a
`chrome.debugger`-backed rendered-tab experiment that could honestly claim a
JS-visible User-Agent override and device-metrics emulation, and **deferred**
it: the `debugger` permission's per-run banner, Chrome Web Store review bar,
and CDP-version maintenance cost were judged disproportionate for now. That
decision is locked in code at `src/lib/googlebot-spike/decision.ts`.

Per Ticket 305's own fallback ("otherwise offer profiles only for
clearly-labelled network probes or defer the switcher"), this ticket takes the
**network-probe-only** path: UA profiles apply only to the extension-initiated
`fetch()` calls already made by variant tests, the soft-404 probe, and
hreflang cluster validation. They never claim to change the active browser
tab, `navigator.userAgent`, or any browser navigation.

## Built-in profiles

| Profile                                          | UA string                                                                  | Method                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Browser default** (`browser-default`)          | `null` (no override)                                                       | `none` — uses the extension fetch's own default `User-Agent` header. |
| **Googlebot-style (static)** (`googlebot-style`) | `Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)` | `extension-fetch-header` — best-effort header override.              |
| **Custom** (`custom`)                            | user-provided string, trimmed, ≤ 256 chars, control characters rejected    | `extension-fetch-header` — best-effort header override.              |

Definitions and the exact string live in `src/lib/ua-profiles/profiles.ts`.
Resolution (including the custom-string validation and graceful fallback) is
`resolveUaProfile` in `src/lib/ua-profiles/resolve-profile.ts`, which never
fails outright — an empty, over-length, or control-character-containing
custom string falls back to `browser-default` with a disclosed reason, so a
probe can always run.

### Why this Googlebot string

Google's own documentation
([Googlebot](https://developers.google.com/search/docs/crawling-indexing/googlebot),
[Google's common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers))
lists Googlebot Desktop as most commonly sending an **evergreen** string with
a live Chrome version placeholder:

```
Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36
```

`W.X.Y.Z` tracks whatever Chrome build Googlebot currently runs and drifts
over time; hard-coding it would go stale between releases with no update
pipeline to keep it current. Google's docs also list a second, static string
that Googlebot Desktop sends "rarely," but that never changes:

```
Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)
```

This project uses the **static** string deliberately, so the constant cannot
silently go stale — at the cost of being a less commonly observed exact match
for live Googlebot traffic than the evergreen variant. Every `googlebot-style`
result's `limitations` array discloses this trade-off explicitly.

## Why the header override is best-effort, not guaranteed

Chrome does not currently guarantee that a `fetch()`-set `User-Agent` header
reaches the destination server unmodified for extension-initiated requests
without the `declarativeNetRequest` permission (with `modifyHeaders` rules and
host permissions for the target). This extension does **not** request
`declarativeNetRequest` — adding it would be a new permission and would
contradict the least-privilege invariant in `CLAUDE.md` for a UA-header nicety
alone. Every affected result therefore discloses:

> Best-effort only: Chrome may silently ignore a fetch()-set User-Agent header
> without the declarativeNetRequest permission, which this extension does not
> request to preserve least privilege. The response cannot confirm which
> User-Agent value the server actually received.

This is why `safeFetch` still attempts the header (there is no reason not to —
it is free, and some Chrome versions or future spec changes may honour it more
reliably) while every UI surface states the limitation up front rather than
implying a guarantee the extension cannot verify from within its own sandbox.

## Recorded on every run

Every `VariantTestRunResult`, `Soft404ProbeResult`, and
`HreflangClusterValidationResult` carries a `uaProfile: UaProfileResult` field:

```ts
type UaProfileResult = {
  profileId: 'browser-default' | 'googlebot-style' | 'custom';
  label: string;
  userAgent: string | null; // exact string used, or null for no override
  method: 'extension-fetch-header' | 'none';
  limitations: string[];
};
```

`uaProfile` is optional in the persisted Zod schema
(`src/lib/schemas/comparison-evidence.ts`) so variant/soft-404 runs saved
before Ticket 305 still validate on load — there is nothing to migrate, the
field was simply absent. Hreflang cluster validation results are never
persisted, so `uaProfile` is required there.

## UI disclosure

The side panel's crawl-signals view (`src/sidepanel/crawl-signals-view.ts`)
shows a **User-Agent profile** panel next to the network-probe panels
(variant tests, soft-404 probe, hreflang cluster) with:

- a profile selector (`browser-default` / `googlebot-style` / `custom`, with a
  length-capped text field for `custom`);
- a live preview of what the current selection would apply (`resolved.userAgent`
  and `resolved.method`) before any probe runs;
- the standing disclosure: "Changes the HTTP User-Agent header on extension
  fetches only. Does not change the browser tab or navigator.userAgent."

Each of the three probe panels additionally shows the profile actually
recorded on its own last completed run (`result.uaProfile`), which can differ
from the current selector value if the user changed it after running.

## Persistence

The selected profile id and custom string are persisted in
`chrome.storage.local` (`src/lib/ua-profiles/preference-storage.ts`) under the
existing `storage` permission — no new permission required. This is a local
preference only (which profile to try next), never audit data; it holds
nothing but the profile id and the custom string the user typed, and a failed
read/write degrades gracefully to the in-memory default (`browser-default`,
empty custom string) rather than blocking the panel.

## Custom string safety

Custom UA strings are:

- trimmed of leading/trailing whitespace;
- capped at `UA_PROFILE_LIMITS.maxCustomUaChars` (256 characters);
- rejected (with fallback to `browser-default`, not an error) if they contain
  control characters (`\x00`–`\x1f`, `\x7f`), including CR/LF, to avoid any
  risk of header-injection-shaped input reaching `fetch()`'s `Headers`
  handling;
- local-only: never written anywhere but `chrome.storage.local`, and never
  applied to background browsing, other tabs, or future runs beyond the
  explicit profile choice in effect when a probe is started.

## Cancellation

Cancelling a variant test run, soft-404 probe, or hreflang cluster validation
aborts the in-flight `fetch()` calls (existing `AbortController` wiring per
feature); the resolved `uaProfile` is a plain value computed once at the start
of the run and held in a local variable — there is no shared/global mutable UA
state in any of these modules to leave "sticky" after cancellation.
`resolve-profile.test.ts` and the per-feature run tests cover this.
