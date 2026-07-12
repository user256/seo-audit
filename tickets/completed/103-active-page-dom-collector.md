# Ticket 103: Active-Page DOM Collector

**Sprint:** 1 — Inspect One Page
**Status:** Done
**Owner:** unassigned
**Estimate:** L

## Context

The first useful audit must collect page-side SEO signals reliably and without
depending on the side panel’s DOM. This collector supplies facts; it does not
decide whether they are good or bad.

## Goal

Capture a normalised, privacy-bounded SEO snapshot from the authorised active
page.

## Acceptance criteria

- [x] Injected collector returns document URL, title, meta description, meta
  robots, canonical links, alternate/hreflang links, Open Graph/Twitter tags,
  language, viewport, headings, link counts, image-alt summary, and JSON-LD
  script text with per-field source selectors/counts.
- [x] Collector distinguishes absent, empty, duplicate, malformed, and
  inaccessible values, and never treats a thrown page getter as a normal value.
- [x] JSON-LD is size-capped and recorded as raw text plus parse status; no page
  script executes during parsing.
- [x] The collector has fixtures for duplicate canonical, multiple robots
  directives, malformed JSON-LD, relative URLs, and pages with no head.
- [x] Captured output validates against Ticket 102’s `PageSnapshot` schema and
  is saved through the session repository.

## Out of scope

- Response headers, robots.txt, sitemap fetches.
- Shadow-DOM crawling or interaction with page controls.
- Claiming that the captured DOM equals the server response.

## Dependencies

- **Blocks:** 104–106
- **Blocked by:** 101, 102
- **External:** user grants current-origin access

## Approach

Use a serialisable content-script function with strict response-size limits.
Resolve relative canonical and alternate URLs against `document.baseURI`, while
retaining the original attribute as evidence.

## Notes / decisions log

- 2026-07-12 — `collectDomFactsInPage` is self-contained for
  `chrome.scripting.executeScript`. Facts map to Evidence via
  `domFactsToPageSnapshot`. Side panel “Collect DOM snapshot” saves a new
  session through `SessionRepository`. Missing permission becomes a
  `CaptureError`, not a finding.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
