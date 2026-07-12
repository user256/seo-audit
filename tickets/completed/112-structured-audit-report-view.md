# Ticket 112: Structured Audit Report View

**Sprint:** 1 — Inspect One Page (remediation)
**Status:** Complete
**Owner:** unassigned
**Estimate:** L

## Context

Sprint 1's audit output currently under-delivers on the product's core promise.
"Start audit" runs the page rules and lists findings, but **"Open report" just
shows a blank Markdown textarea** ([sidepanel.ts](../src/sidepanel/sidepanel.ts)
toggles `#report-section`, which mounts the notes editor) — it never composes the
captured facts, findings, evidence, or severity summary into an actual report.
Combined with only one class of checks running today (page/DOM rules), the tool
reads as "ran a single check, then gave me an empty text box" rather than "audited
this page and produced a report."

Ticket 105 deliberately scoped the editor as a *notes* surface, and Ticket 402
owns file export — but neither gives an in-panel, readable **report** of what the
audit found. That gap is what this ticket closes. (The perception of "a single
check" is separately addressed by the check catalogue and wizard, Tickets
209/210; this ticket ensures that even one check renders as a real, legible
report that names what ran and what did not.)

## Goal

Make "Open report" render a structured, readable audit report composed from the
session — with the user's Markdown notes as one section, not the whole report.

## Acceptance criteria

- [x] The report view renders a composed document from the saved session:
  audit header (target URL, final URL, capture time, extension version), a
  "checks run / skipped (and why)" list, a severity + category summary, and the
  page-facts snapshot (title, description, canonical, robots, headings, links,
  images) drawn from the existing dashboard model.
- [x] Each finding renders as its own report section: severity, description,
  evidence (from the evidence store, bounded), recommendation, and the
  best-practice source link — reusing the finding/evidence schemas, not
  re-deriving them.
- [x] The user's Markdown notes remain editable and are woven into the report as
  a clearly-labelled "Analyst notes" section; Markdown stays the only persisted
  report text and preview HTML stays transient and sanitised (Ticket 105/108
  invariants hold).
- [x] Unavailable/oversized/`CaptureError` inputs render as explicit "not
  captured" report rows — never as passes or blanks — so a partial audit reads
  honestly.
- [x] The composed report is the single in-memory representation the Ticket 402
  Markdown/JSON export serialises, so panel and export cannot drift.
- [x] Tests cover report composition for a clean session, a session with mixed
  severities, and a partial/`CaptureError` session; snapshots are deterministic.

## Out of scope

- File download / export formatting (Ticket 402 consumes this representation).
- Multi-page or historical/site-level roll-ups (Sprint 4 / 401).
- New rules or network checks (209/210 and Sprint 2 grow the check set).
- PDF or print-specific layout.

## Dependencies

- **Blocks:** 199 (Sprint 1 go/no-go should not pass with an empty-textbox
  report), 402
- **Blocked by:** 104 (findings), 105/108 (report editor), 111 (dashboard model)
- **External:** none

## Approach

Introduce a pure `buildAuditReport(session)` that returns a structured report
model (sections + the dashboard/facts snapshot + findings + notes), and a
renderer that turns it into the sanitised preview. Keep the Markdown editor as
the notes input feeding one section. Treat this report model as the contract
Ticket 402 serialises, so there is one source of truth for "what the report says."

## Notes / decisions log

- 2026-07-12 — Filed after user review: "the plugin is essentially running a
  single check and then Open report just shows a text box as opposed to any
  reporting." Report must compose findings/evidence/summary, not just collect notes.
- 2026-07-12 — `buildAuditReport(session)` is the deterministic in-memory
  report contract. The panel previews its Markdown projection and persists only
  analyst notes, preserving the report-editor isolation invariant.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
