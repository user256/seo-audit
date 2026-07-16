# Ticket 214: Crawl-Signals Auto-Capture and Silent Hydration (retroactive)

**Sprint:** 2 — Crawl and Index Signals
**Status:** Blocked — final operator smoke after Ticket 215
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
- **Follow-up:** PR #38 resolved the disclosure and test debt, but review found
  that a second hydrate call can begin the sitemap stage while a first robots
  fetch is still busy. Ticket 215 serialises that edge case before the final
  operator smoke.

## Acceptance criteria

- [x] Robots/sitemap conclusions reachable from Start audit findings (PR #34).
- [x] Sitemap XML parses inside the MV3 service worker (PR #35).
- [x] No automatic page reload; silent hydration is same-tab-guarded (PR #36).
- [x] Add a visible disclosure for the panel-open background fetches (e.g. a
  crawl-signals line such as "robots.txt and declared sitemaps are fetched
  automatically when the panel opens — no page reload"), or decide and record
  that panel-open is sufficient consent for these capped fetches.
- [x] Add regression tests for `hydrateCrawlSignalsInBackground` and
  `applySilentNavigationUpdate` (same-tab guard, robots→sitemap ordering,
  busy-flag reentry, stale-tab bailout).
- [ ] Operator smoke: open the panel on a public site, confirm no reload, and
  confirm robots/sitemap slots fill silently; record in the gate runbook.

## Dependencies

- **Blocks:** 299 (the Sprint 2 go/no-go should review this surface too)
- **Blocked by:** 215 (automatic-stage serialization before the final smoke)
- **External:** operator smoke (see `docs/operator-gates.md`)

## Notes / decisions log

- 2026-07-16 — Ticket filed retroactively during the programme review; scope
  above reconstructed from the merged PRs.
- 2026-07-16 — Disclosure + tests landed. The hydrate sequencing was extracted
  to `src/lib/dashboard/hydrate-crawl-signals.ts` (dependency-injected, no DOM
  or `chrome.*` access) and `sidepanel.ts` now delegates to it; 12 regression
  tests cover ordering, busy-flag reentry, stale-tab/origin bailout, error
  passthrough, and the silent-navigation tab guard. The crawl-signals panel
  gained an always-visible note (`#crawl-auto-fetch-note`) stating that
  robots.txt and declared sitemaps are fetched automatically on panel open,
  capped, without cookies/credentials, and that the page is never reloaded —
  4 new view tests cover the note, panel inventory, button wiring, and
  open-state retention (the view previously had 0% coverage). Gate: 67 files /
  406 tests, lint, build all pass. Only the operator smoke item remains.
- 2026-07-16 — PR #38 merged to `main`. Review filed Ticket 215 for the narrow
  concurrent-entry edge before the operator smoke is recorded.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
