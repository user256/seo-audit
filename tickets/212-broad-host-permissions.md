# Ticket 212: Broad Host Permissions (Drop Per-Origin Allow NUX)

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

Ticket 101 shipped optional per-origin `chrome.permissions.request` (“Allow this
site”) to honour a least-privilege invariant. In practice that NUX is painful
for sitemap indexes, multi-host hreflang clusters, robots, and header capture —
exactly the Sprint 2 surfaces. Hreflang Pro’s `<all_urls>` model is the better
product fit: install once, audit freely, keep caps and disclosures on *what*
we fetch rather than *whether* we may touch a host.

## Goal

Replace optional per-origin host grants with required broad HTTP(S) host
permissions and remove the Allow-this-site gate from the normal audit path.

## Acceptance criteria

- [ ] Manifest declares required `host_permissions` for `http://*/*` and
  `https://*/*` (or equivalent `<all_urls>` scoped to web origins only — prefer
  http(s) patterns so `chrome://` / `file://` stay unsupported).
- [ ] Side panel no longer requires “Allow this site” before DOM collect,
  glance, Start audit, or Sprint 2 fetches; unsupported URL types remain
  blocked with an explanation.
- [ ] Ticket 206’s safe-fetch contract still enforces method, redirect cap,
  timeout, byte cap, concurrency, credential policy, and truncation — broad
  host access does **not** mean unbounded crawling.
- [ ] README, `docs/architecture.md`, privacy/permissions wording, and
  `CLAUDE.md` product invariants match the new model (Store justification:
  multi-host sitemap/hreflang/robots inspection of the user’s chosen audit).
- [ ] Tests and UI copy updated; `npm test`, lint, build, `package:check` pass.

## Out of scope

- Implementing sitemap/robots/header parsers themselves (201–203).
- Remote analytics, CDN assets, or sending audit data off-machine.
- Automatically crawling an entire site without a user-started, capped action.

## Dependencies

- **Blocks:** 201–203, 206 (fetch UX), 213
- **Blocked by:** 199 (prefer after Sprint 1 gate) — may start earlier if
  product prioritises permission UX unblocking Sprint 2 spikes
- **External:** Chrome Web Store host-permission justification text

## Notes / decisions log

- 2026-07-13 — Product decision: per-origin Allow NUX is the wrong trade-off;
  adopt blanket HTTP(S) host access. Local-first / no-exfiltration invariants
  remain. Filed from Hreflang Pro plunder discussion.
