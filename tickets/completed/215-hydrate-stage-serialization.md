# Ticket 215: Serialize Automatic Crawl-Signal Hydration

**Sprint:** 2 — Crawl and Index Signals
**Status:** Done
**Owner:** unassigned
**Estimate:** S

---

## Context

Ticket 214's extracted `hydrateCrawlSignals` sequence is intended to fetch
robots.txt before declared sitemaps. On a second panel refresh while the first
robots fetch is still in flight (or while an explicit robots fetch is busy),
the new call skips robots but proceeds directly to the sitemap stage. That can
fetch only fallback candidates before robots directives are available and
contradicts the documented robots-to-sitemap ordering.

## Goal

Ensure automatic sitemap hydration never starts until the robots stage for the
same tab and origin has completed or a robots result already exists.

## Acceptance criteria

- [x] A hydrate call with no robots result and `robotsBusy()` true does not
  fetch a sitemap or change either busy flag.
- [x] The automatic path still fetches robots before sitemap candidates are
  derived, including robots-declared sitemap URLs.
- [x] The same-tab/origin guards, busy-flag release, no-reload guarantee, and
  explicit Fetch robots / Fetch sitemap controls retain their current behaviour.
- [x] `npm run lint`, `npm test`, and `npm run build` pass with regression
  coverage for the concurrent-entry case.

## Out of scope

- Replacing the panel's explicit manual fetch controls.
- Changing sitemap caps, credential policy, or the panel-open disclosure.

## Dependencies

- **Blocks:** 214 final smoke; 299 Sprint 2 go/no-go
- **Blocked by:** —
- **External:** —

## Notes / decisions log

- 2026-07-16 — Filed during PR #38 review. This is a small correctness
  remediation: the feature is otherwise tested and merged, but the existing
  re-entry test encoded the undesired sitemap-before-robots behaviour.
- 2026-07-19 — Implemented as a single early return in `hydrateCrawlSignals`:
  when no robots result exists *and* `robotsBusy()` is true, the call is now a
  complete no-op instead of falling through to the sitemap stage. Nothing is
  dropped, because the in-flight run reaches the sitemap stage itself.
- 2026-07-19 — Distinguished "robots busy with no result" (bail out) from
  "robots busy but a result already landed" (proceed). Only the first breaks the
  ordering guarantee; stalling the second would regress the sitemap hydrate
  whenever an unrelated robots refresh is in flight. Covered by its own test.
- 2026-07-19 — Rewrote the pre-existing test `does not re-enter a robots fetch
  that is already in flight`, which asserted `fetchSitemap` **was** called — the
  exact behaviour this ticket removes. Added a genuinely concurrent test (two
  overlapping `hydrateCrawlSignals` calls gated on a deferred robots fetch)
  rather than only simulating the busy flag, plus an ordering assertion that
  candidate derivation follows `applyRobots`.
- 2026-07-19 — Verified the new tests are not vacuous: reverted the guard and
  confirmed both fail, then restored it and confirmed both pass.
- 2026-07-19 — Filed Ticket **116** for an unrelated intermittent 5s timeout in
  `collect-dom.test.ts` observed while running the suite repeatedly here. Not
  absorbed into this ticket; its diff is confined to the hydrate module.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch.
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
