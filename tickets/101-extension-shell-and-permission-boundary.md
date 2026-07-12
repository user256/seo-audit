# Ticket 101: Extension Shell and Permission Boundary

**Sprint:** 1 — Inspect One Page  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

The project has no extension code. The audit needs page and origin access, but
the baseline must not request `<all_urls>` permanently. A minimal MV3 shell and
an explicit active-origin permission flow are prerequisites for every audit.

## Goal

Ship a loadable MV3 side-panel extension that audits only user-authorised HTTP(S)
origins.

## Acceptance criteria

- [ ] `manifest.json` uses Manifest V3, declares `storage`, `activeTab`, and
  `sidePanel`, and has no required blanket host permission.
- [ ] A toolbar action opens the side panel and shows the active tab URL,
  origin-access state, and a clear “Allow this site” action.
- [ ] Access is requested with `chrome.permissions.request` for exactly the
  active origin (`https://host/*` or `http://host/*`); `chrome://`, extension,
  file, and other unsupported URLs are explained without requesting access.
- [ ] The service worker, side-panel page, and no-op content-script injection
  round trip are covered by unit tests with Chrome APIs mocked.
- [ ] `npm run lint`, `npm test`, and `npm run build` pass; the generated
  archive loads as an unpacked extension in Chrome.

## Out of scope

- Network/header capture.
- Persistent access to every website.
- User-Agent or content-setting changes.

## Dependencies

- **Blocks:** 102–106
- **Blocked by:** 100
- **External:** Chrome 114+ (side panel API)

## Approach

Use a plain ES-module-free MV3 layout initially: service worker, side-panel
HTML/CSS/JS, and a content script injected only after permission succeeds.
Centralise URL eligibility and origin-pattern generation so later features
cannot invent their own permission behaviour.

## Notes / decisions log

- 2026-07-12 — `activeTab` is transient; explicit optional host permission is
  required for repeatable origin-scoped auditing and background fetches.

