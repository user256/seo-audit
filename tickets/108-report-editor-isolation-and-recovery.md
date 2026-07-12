# Ticket 108: Report Editor Isolation and Recovery

**Sprint:** 1 — Inspect One Page  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

The report editor follows the intended Notes-inspired source/preview model, but
its autosave queue has two integrity faults. An autosave rejection leaves the
promise chain rejected, preventing later saves; and the callback reads the
mutable current workspace session, so a delayed save can be written to a new
audit after another audit is collected. The sanitised preview still permits
Markdown images and supported raw HTML, contrary to Ticket 105’s explicit
no-embedded-remote-images policy.

## Goal

Ensure each report autosaves only to its owning session, recovers from failures,
and renders within the stated local-only preview boundary.

## Acceptance criteria

- [ ] Bind every editor controller/autosave operation to an immutable session
  ID; before replacing sessions, flush or cancel the previous controller and
  prove no old Markdown can be saved to the new session.
- [ ] Catch and display save failures without unhandled promise rejections;
  later edits retry successfully, saved/unsaved state remains truthful, and
  close/navigation has an explicit flush-or-warning policy.
- [ ] Define a Markdown preview allowlist. Raw HTML and image output are removed
  (or rendered inert), and the sanitiser prevents remote image/network loads as
  well as scripts, forms, styles, unsafe links, and event attributes.
- [ ] Preserve safe ordinary Markdown, table/code rendering, and external text
  links with `target="_blank" rel="noopener noreferrer"`.
- [ ] Add controller-level tests for rejected-then-successful autosaves,
  session switch during a debounce window, source/preview switching after a
  failed save, raw HTML, Markdown images, data URLs, and safe links.

## Out of scope

- Collaborative editing, undo history, attachments, or external image proxying.
- Export formatting (Ticket 402).

## Dependencies

- **Blocks:** 199, 402, 403
- **Blocked by:** 102, 105, 106
- **External:** none

## Approach

Keep Markdown as the source of truth, as in the Notes reference, but make the
editor lifecycle explicit: one controller owns one session and no background
save may outlive that ownership.

## Notes / decisions log

- 2026-07-12 — Filed by the post-Sprint-1 audit. A rejected debounced promise
  currently poisons the serial save chain, while the save callback resolves the
  session ID from mutable workspace state.

