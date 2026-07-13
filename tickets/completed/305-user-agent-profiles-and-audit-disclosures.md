# Ticket 305: User-Agent Profiles and Audit Disclosures

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** M

## Context

User-agent switching is a requested essential, but browser-wide spoofing is
risky and an ordinary fetch header is not equivalent to a browser navigation.
The product must expose only behaviour it can describe accurately.

## Goal

Provide clear user-agent profile selection and evidence disclosures for the
features that can actually honour it.

## Acceptance criteria

- [x] Define built-in profiles (browser default, Googlebot-style, custom) with
  exact UA strings, scope, and method recorded in every affected result. —
  `src/lib/ua-profiles/` (`UaProfileResult` on every variant/soft-404/hreflang
  cluster result); see `docs/ua-profiles.md`.
- [x] If Ticket 304 ships debugger support, use profiles only in its dedicated
  experiment tab after explicit consent; otherwise offer profiles only for
  clearly-labelled network probes or defer the switcher. — Ticket 304 deferred
  debugger support, so this took the "otherwise" branch: profiles apply only
  to `safeFetch`-backed network probes (variant tests, soft-404 probe, hreflang
  cluster validation), never a rendered tab.
- [x] UI states when a profile changes an HTTP fetch only, a dedicated rendered
  tab, or nothing; it never implies that the active browser tab was changed when
  it was not. — Standing disclosure in the crawl-signals UA profile panel and
  per-run summaries (`src/sidepanel/crawl-signals-view.ts`).
- [x] Custom strings are length-limited, local-only, and never automatically
  applied to background browsing. — 256-char cap, control-character rejection,
  and `chrome.storage.local`-only persistence (`src/lib/ua-profiles/limits.ts`,
  `preference-storage.ts`).
- [x] Unit/manual tests prove the reported profile matches the method and that
  cancellation restores the default state. — `resolve-profile.test.ts`,
  `preference-storage.test.ts`, `safe-fetch.test.ts`; cancellation is covered
  because the resolved profile is a local value with no shared/global UA state
  to leave sticky (see `docs/ua-profiles.md#cancellation`).

## Out of scope

- Global browser UA spoofing.
- Pretending to be a search engine crawler in normal browsing.

## Dependencies

- **Blocks:** 399, 402
- **Blocked by:** 301, 304
- **External:** outcome of Ticket 304

## Notes / decisions log

- 2026-07-13 — Implemented on the network-probe-only branch per Ticket 304's
  defer decision. Built-in profiles: `browser-default` (no override),
  `googlebot-style` (static, documented Googlebot Desktop UA — chosen over the
  more commonly observed evergreen `Chrome/W.X.Y.Z` variant specifically so
  the constant cannot go stale between releases; both variants and the
  trade-off are documented in `docs/ua-profiles.md`), and `custom`
  (length-capped, control-character-rejecting, local-only). The header
  override is disclosed everywhere as best-effort: without the
  `declarativeNetRequest` permission (deliberately not requested, to preserve
  least privilege), Chrome does not guarantee a `fetch()`-set `User-Agent`
  header reaches the destination server. No new permissions were added.
  Preference persists in `chrome.storage.local`; every affected run result
  (`VariantTestRunResult`, `Soft404ProbeResult`,
  `HreflangClusterValidationResult`) carries the resolved `UaProfileResult`,
  optional in the persisted Zod schema for backward compatibility with
  pre-305 sessions.

