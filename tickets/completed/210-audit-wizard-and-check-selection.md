# Ticket 210: Audit Wizard and Check Selection

**Sprint:** 2 — Crawl and Index Signals
**Status:** Complete
**Owner:** agent/ticket-210-audit-wizard
**Estimate:** L

## Context

The dashboard (Ticket 111) delivers glance-first UX, and “Start audit” then runs
every rule at once. The specification promises “tools + an **optional wizard**”.
As the check set grows (Sprint 2 crawl signals, Sprint 3 opt-in network and
experiment probes), users need to choose which checks to run — and the
experiments *must* be individually consented regardless. The Check Catalogue
(Ticket 209) supplies the metadata and availability model; this ticket adds the
selection surface on top of it and becomes the single consent point that the
Sprint 3 experiment tickets (301–304) plug into.

## Goal

Let a user optionally choose which catalogued checks to run before starting an
audit, defaulting to the full safe set so the one-click fast path is unchanged.

## Acceptance criteria

- [x] A “Choose checks” affordance opens a selection view listing catalogue
  checks grouped by category, each with label, description, and a cost badge
  (DOM / network / experiment) sourced from the catalogue (Ticket 209).
- [x] Checks whose required access or captured evidence is missing are shown
  disabled with the reason (never silently omitted), using the catalogue’s
  `availability(ctx)` resolver.
- [x] Opt-in / experimental checks are unchecked by default and disclose their
  permission and network consequence before they can be selected.
- [x] “Start audit” without opening the wizard runs the default safe set exactly
  as today — the wizard is never a mandatory gate, so it cannot reintroduce the
  empty-screen problem Ticket 111 fixed.
- [x] The saved session records which checks were selected, which were skipped,
  and why, so a partial audit is self-describing (and stays honest in exports).
- [x] Selection view is keyboard-operable, has accessible names and visible
  focus, is usable at 320 CSS px, and meets WCAG AA contrast in both themes.
- [x] Unit tests cover default selection, availability-driven disabling, opt-in
  consent copy, and that a selected subset runs exactly those checks.

## Out of scope

- Executing the Sprint 2/3 network and experiment checks themselves — those
  tickets own their runners; this only selects and consents them.
- Saved selection presets/profiles (file as a follow-up if wanted).
- Scheduling or re-running audits.
- Changing the least-privilege permission model (`<all_urls>` stays forbidden).

## Dependencies

- **Blocks:** consent UX for 301–304 (they surface through this wizard)
- **Blocked by:** 111, 209
- **External:** none

## Approach

Treat the wizard as a filter over the catalogue that produces a check-ID set for
the existing audit runner — not a new execution path. Keep “Start audit” as the
default full-set run; the wizard only narrows it. Persist the selected/skipped
set on the session so findings and exports never overstate coverage.

## Notes / decisions log

- 2026-07-12 — Filed as the priority UX follow-on to the dashboard (111), per the
  product direction “dashboard first, then the wizard / selecting specific checks
  to run.” Numbered in Sprint 2 to keep the Sprint 1 go/no-go gate clean; can be
  pulled to the front of the post-gate priority lane without renumbering.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
