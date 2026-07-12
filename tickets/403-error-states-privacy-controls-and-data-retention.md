# Ticket 403: Error States, Privacy Controls, and Data Retention

**Sprint:** 4 — Durable Audits and Release Readiness  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

Audit content can contain commercially sensitive URLs and observations. The
release needs crisp error handling, a transparent local-data policy, and user
control over retained data and origin permissions.

## Goal

Make failures, stored data, and granted access visible and controllable.

## Acceptance criteria

- [ ] Provide a settings/privacy surface listing stored record categories,
  approximate storage use, granted origins, experimental permissions, and
  retention behaviour.
- [ ] Users can revoke one origin permission, revoke experimental permissions,
  delete selected/all local data, and understand the effect before confirmation.
- [ ] Network, parser, quota, unsupported-page, permission, and debugger errors
  have non-sensitive messages, recovery actions, and structured diagnostics.
- [ ] No telemetry or remote analytics is added; the privacy policy and README
  explicitly state this and document all network destinations.
- [ ] Tests verify destructive actions, revoked access handling, and that
  diagnostic records redact credentials/query values designated sensitive.

## Out of scope

- Encryption at rest beyond browser profile protections.
- Account-based retention policies.

## Dependencies

- **Blocks:** 404, 499
- **Blocked by:** 101, 102, 399, 401
- **External:** Chrome permission APIs

