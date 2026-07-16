# Ticket 214: Crawl-Signals Auto-Capture and Silent Hydration (retroactive)

**Sprint:** 2 — Crawl and Index Signals
**Status:** In progress — implementation merged; disclosure + test debt open
**Owner:** unassigned
**Estimate:** S

## Context

PRs #34, #35, and #36 (commits `8a27a4e`, `38b0a3e`, `60c37b7`, `3e2ec23`)
merged to `main` without a ticket, violating the roadmap's numbering rule
("new work … is not silently absorbed"). This ticket records that work
retroactively and carries the follow-ups it should have shipped with.

What shipped:

- **PR #34** — robots evaluation and sitemap membership wired into the Start
  audit findings pipeline (`src/lib/crawl/build-crawl-evidence.ts`, with tests).
- **PR #35** — service-worker-safe XML parsing (`src/lib/sitemap/simple-xml.ts`,
  replacing `DOMParser`, with tests) and navigation auto-capture when the side
  panel opens.
- **PR #36 + follow-up** — removed the automatic page reload; the sidebar now
  hydrates robots → sitemap results silently as they arrive
  (`hydrateCrawlSignalsInBackground`, `applySilentNavigationUpdate` in
  `src/sidepanel/sidepanel.ts`).

## Review notes (2026-07-16)

- The hydrate path never reloads the page, guards against tab/origin changes
  mid-flight, and `reloadAndObserveNavigation` remains explicit-only. Good.
- **Invariant tension:** panel-open glance now auto-triggers robots *and*
  sitemap fetches. Auto robots fetch is in the concept spec; the sitemap fetch
  is a multi-URL cluster fetch, and the working agreement says those need "a
  user action, caps, and an explanation of what will happen". Panel open is a
  user action and fetches are capped, but there is no up-front explanation.
- **Test debt:** PR #36 (143-line `sidepanel.ts` change) and the type-narrowing
  follow-up shipped without tests, against the "ship a test with every change"
  rule.

## Acceptance criteria

- [x] Robots/sitemap conclusions reachable from Start audit findings (PR #34).
- [x] Sitemap XML parses inside the MV3 service worker (PR #35).
- [x] No automatic page reload; silent hydration is same-tab-guarded (PR #36).
- [ ] Add a visible disclosure for the panel-open background fetches (e.g. a
  crawl-signals line such as "robots.txt and declared sitemaps are fetched
  automatically when the panel opens — no page reload"), or decide and record
  that panel-open is sufficient consent for these capped fetches.
- [ ] Add regression tests for `hydrateCrawlSignalsInBackground` and
  `applySilentNavigationUpdate` (same-tab guard, robots→sitemap ordering,
  busy-flag reentry, stale-tab bailout).
- [ ] Operator smoke: open the panel on a public site, confirm no reload, and
  confirm robots/sitemap slots fill silently; record in the gate runbook.

## Dependencies

- **Blocks:** 299 (the Sprint 2 go/no-go should review this surface too)
- **Blocked by:** —
- **External:** operator smoke (see `docs/operator-gates.md`)

## Notes / decisions log

- 2026-07-16 — Ticket filed retroactively during the programme review; scope
  above reconstructed from the merged PRs.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
