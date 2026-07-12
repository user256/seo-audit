# Ticket 401: Session Browser and Historical Comparison

**Sprint:** 4 — Durable Audits and Release Readiness  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

Local session storage becomes valuable when users can return to an investigation
and see what changed, not only the most recent page capture.

## Goal

Let users find, reopen, compare, and delete local audit sessions.

## Acceptance criteria

- [ ] Session browser supports search by host/URL/title and shows capture date,
  finding counts, and capture-error state without loading full snapshots first.
- [ ] A user can select two compatible sessions and see added, removed, and
  changed facts/findings with rule ID and evidence diffs.
- [ ] Comparisons identify incompatible schema versions and partial captures
  instead of producing misleading diffs.
- [ ] Users can delete one session or all local audit data with confirmation;
  deletion removes associated Markdown reports and derived data.
- [ ] Tests cover sorting/filtering, comparison determinism, migrations, and
  cascading deletion.

## Out of scope

- Cloud backup or shared/team sessions.
- Scheduled re-audits.

## Dependencies

- **Blocks:** 402–404, 499
- **Blocked by:** 102, 399
- **External:** none

