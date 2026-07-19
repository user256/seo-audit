# Ticket 216: SVG Icon `<title>` Elements Falsely Counted as Duplicate Document Titles

**Sprint:** 1 — Inspect One Page
**Status:** Done
**Owner:** unassigned
**Estimate:** S

---

## Context

Found during the Sprint 2 three-site operator review (Ticket 299 / Block C of
`docs/operator-gates.md`) against `milroysofsoho.com`: the audit reported
`title-duplicate` with 11 values. Fetching the page directly showed exactly
one real `<title>` in `<head>`; the other 10 were `<title id="pi-...">`
elements inside `<svg>` payment-icon graphics (American Express, Apple Pay,
Visa, etc.) — a standard accessible-name pattern for SVG icons, unrelated to
the document title.

`collectDomFactsInPage` (`src/content/dom-collector.ts`) collected the title
field with:

```ts
const nodes = Array.from(document.querySelectorAll('title'));
```

`querySelectorAll('title')` matches by tag name only, across namespaces, so it
picks up `SVGTitleElement` nodes alongside the real `HTMLTitleElement`. Any
page with SVG icon sprites containing `<title>` accessible names (common on
Shopify/e-commerce sites) produces a false `title-duplicate` finding — a
factual defect, not a real page bug, and exactly the kind of false positive
the operator gates exist to catch before Sprint 2 signs off.

## Goal

Only count genuine HTML document `<title>` elements toward title
presence/duplication; never count SVG (or other foreign-namespace) `<title>`
elements.

## Acceptance criteria

- [x] `collectDomFactsInPage` filters title nodes to `HTMLTitleElement`
  instances before computing `state`/`count`/`values`.
- [x] A regression test loads a fixture with one real document title plus two
  SVG icon `<title>` elements and asserts `facts.title.state === 'present'`
  with the real title value (not `duplicate`).
- [x] `npm run lint`, `npm test`, and `npm run build` pass.

## Out of scope

- Auditing other DOM-collector fields for the same namespace hazard (none of
  the other tag names collected — `meta`, `link`, `script[type=json-ld]` — are
  valid inside SVG foreign content, so this class of bug is specific to
  `title`).
- Re-running the Milroys operator pass (that's tracked under Ticket 299/Block
  C, not this ticket).

## Dependencies

- **Blocks:** 299 (the Sprint 2 three-site review should re-check Milroys
  findings once this lands)
- **Blocked by:** —
- **External:** —

## Notes / decisions log

- 2026-07-19 — Filed and fixed during the Ticket 299 operator review pass. Root
  cause confirmed by fetching `milroysofsoho.com` directly and diffing the raw
  `<title>` elements against the audit's reported count.

---

## Definition of done

This ticket is closeable when all acceptance criteria are checked, its changes
are merged, the corresponding `tickets/overview.md` bullet is completed, and
any new follow-up is filed separately.
