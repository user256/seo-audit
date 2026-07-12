# Ticket 404: Quality Gates and Release Packaging

**Sprint:** 4 — Durable Audits and Release Readiness  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

A browser extension release needs more than a passing unit suite: manifest
validity, package contents, dependency provenance, and repeatable manual checks
are all store-review and user-trust concerns.

## Goal

Create a reproducible, verified release package and documented quality gates.

## Acceptance criteria

- [ ] `npm run lint`, `npm test`, `npm run build`, and `npm run package:check`
  are documented and run in CI on a clean checkout.
- [ ] Build emits a versioned ZIP containing only required extension assets;
  package check rejects `.env`, keys, test fixtures, source maps if not wanted,
  `node_modules`, and unapproved files.
- [ ] Manifest linting and a Chrome unpacked smoke checklist cover side panel,
  optional-origin permission, IndexedDB persistence, export, and permission
  revocation.
- [ ] Third-party runtime assets are pinned, locally bundled, license-attributed,
  and listed with source/version/hash; extension CSP permits no remote scripts.
- [ ] README includes install/development/build instructions, feature limits,
  permissions rationale, privacy behaviour, and known experimental status.

## Out of scope

- Publishing to the Chrome Web Store.
- Automated end-to-end tests requiring live third-party sites.

## Dependencies

- **Blocks:** 499
- **Blocked by:** 401–403
- **External:** CI runner and Chrome test installation

