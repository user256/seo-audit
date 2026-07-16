# Ticket 399: Sprint 3 Review and Go/No-Go

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** In progress — repository review complete; operator decision pending
**Owner:** unassigned  
**Estimate:** S

## Context

The comparison work has the largest permission, privacy, and correctness risk
in the programme. It must earn a place in the release.

## Goal

Decide which, if any, experiment features are suitable for a durable release.

## Acceptance criteria

- [x] Review every Sprint 3 feature against its disclosure, cancellation,
  network-bound, and restoration requirements.
- [x] Confirm no feature makes crawler-parity or cloaking-detection claims.
- [x] Validate debugger attach/detach recovery if Ticket 304 reached a
  prototype; reject it from the release if recovery cannot be demonstrated.
- [ ] Record keep/defer/remove decisions and file follow-up tickets before
  starting Sprint 4.

## Dependencies

- **Blocks:** 401–404
- **Blocked by:** 301–305
- **External:** product/permission review

## Repository review — 2026-07-15

The implementation and disclosure review found no release-blocking code issue:

- **301 URL variants — recommend keep.** Runs are user-started, capped at 24
  variants / 90 seconds with shared fetch concurrency and redirect limits,
  omit credentials, support abort cancellation, and report inconsistencies as
  observations rather than selecting a preferred host.
- **302 soft-404 probe — recommend keep.** The UI exposes the editable target
  before the one-probe run, labels the result as a heuristic observation,
  omits credentials, and supports abort cancellation.
- **303 CSS/JS comparison — recommend keep CSS-off only.** The UI discloses the
  dedicated inactive tab, exact injection method, cancellation, and automatic
  close. The runner closes the experiment tab in `finally`; tests cover success,
  cancellation, and failure. JavaScript-off remains deliberately omitted.
- **304 Googlebot-style render — defer.** No prototype or product UI shipped,
  and neither `debugger` nor `contentSettings` is declared. The feasibility
  report records the permission, browser-banner, recovery, and maintenance
  reasons for deferral, so attach/detach validation is not applicable.
- **305 User-Agent profiles — recommend keep for network probes only.** The UI
  says the best-effort header affects extension fetches only, not the active
  tab or `navigator.userAgent`; every affected result records the selected
  profile and its limitations. No global browser state requires restoration.

Repository searches found no product claim of crawler parity, Google rendering,
or cloaking detection. Relevant UI and result text explicitly disclaims those
claims. The original concept specification still describes aspirational
Googlebot/cloaking behaviour, but the roadmap and shipped surfaces narrow that
scope truthfully.

Automated gate:

- `npm run lint` — pass
- `npm test` — pass (65 files, 390 tests)
- `npm run build` — pass; `dist/` rebuilt
- `npm run package:check` — pass

## Remaining operator gate

Do not close this ticket or start Ticket 401 until an operator:

1. reloads the rebuilt `dist/` in Chrome and runs the applicable Ticket 303
   manual matrix, confirming the comparison tab closes on success, cancellation,
   load failure, and panel closure;
2. reviews the pre-run and result disclosures for Tickets 301, 302, 303, and
   305 in the actual side panel; and
3. confirms or changes the provisional keep/defer recommendations above. File
   a follow-up ticket for any requested change before recording the Sprint 3
   go/no-go decision.
