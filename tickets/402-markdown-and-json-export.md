# Ticket 402: Markdown and JSON Export

**Sprint:** 4 — Durable Audits and Release Readiness  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

The specification requires portable reports. Exports must preserve evidence and
limits without leaking browser or local-only data.

## Goal

Export a selected audit session as deterministic Markdown and JSON files.

## Acceptance criteria

- [ ] Markdown export includes audit target/final URL, capture time, extension
  version, capture limits/errors, severity summary, findings with evidence and
  recommendations, and the user’s Markdown report notes.
- [ ] JSON export validates against a published versioned export schema and
  contains raw structured evidence without preview HTML, credentials, cookies,
  page form data, or internal database keys.
- [ ] Findings and fields have deterministic ordering; filenames are safe,
  human-readable, and based on host/date/session ID.
- [ ] Export works for partial captures and clearly retains their limitations.
- [ ] Golden-file tests cover a normal session, a partial session, escaping,
  report notes, and schema validation.

## Out of scope

- Uploading to APIs or email.
- PDF generation.
- Altering source audit records during export.

## Dependencies

- **Blocks:** 404, 499
- **Blocked by:** 105, 204, 301, 302, 305, 401
- **External:** browser downloads API

