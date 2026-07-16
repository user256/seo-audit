# Ticket 215: Serialize Automatic Crawl-Signal Hydration

**Sprint:** 2 — Crawl and Index Signals
**Status:** Not started
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

- [ ] A hydrate call with no robots result and `robotsBusy()` true does not
  fetch a sitemap or change either busy flag.
- [ ] The automatic path still fetches robots before sitemap candidates are
  derived, including robots-declared sitemap URLs.
- [ ] The same-tab/origin guards, busy-flag release, no-reload guarantee, and
  explicit Fetch robots / Fetch sitemap controls retain their current behaviour.
- [ ] `npm run lint`, `npm test`, and `npm run build` pass with regression
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

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch.
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
