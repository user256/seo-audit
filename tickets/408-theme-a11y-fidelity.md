# Ticket 408: Theme Accessibility Fidelity — Derive Contrast Samples and Honour Reduced Motion

**Sprint:** 4 — Durable Audits and Release Readiness
**Status:** Not started
**Owner:** unassigned
**Estimate:** S

---

## Context

Filed during the merge review of Ticket 407 (CannyForge visual reskin). The
reskin itself is sound — `contrast-check.test.ts` loops every entry of
`THEME_PRESETS` × light/dark against the unchanged `WCAG_AA_NORMAL_TEXT`
threshold, and all pairs clear 4.5:1 — but the review surfaced two accessibility
gaps that 407 did not introduce and did not fix:

1. **Stale hardcoded contrast samples.** `src/sidepanel/a11y.test.ts` declares
   `THEME_CONTRAST_SAMPLES` with the comment "Token pairs shipped in
   sidepanel.css", but hardcodes `#f7f7f5` / `#0b5fff` / `#12141a` — values that
   match neither the pre-407 ink/cream/lime skin nor the CannyForge palette. The
   test passes while measuring colours the extension has never shipped. This
   drift pre-dates 407, but 407 widens it: the assertion is now decorative.

2. **No `prefers-reduced-motion` handling.** There is no
   `prefers-reduced-motion` block anywhere in `src/`. Ticket 407 expanded the
   motion surface — hover `translateY` lifts plus shadow/transform transitions on
   `button.secondary` and the toolbar buttons in `src/sidepanel/sidepanel.css`.
   Users who have asked the OS to reduce motion still get them.

Neither gap blocks the Sprint 1–3 operator gates; both should land before
Ticket 404 (release packaging) claims an accessibility baseline.

## Goal

The panel's accessibility tests measure the tokens actually shipped, and the
reskin's motion effects are suppressed when the user has requested reduced
motion.

## Acceptance criteria

- [ ] `THEME_CONTRAST_SAMPLES` in `src/sidepanel/a11y.test.ts` is derived from
      `DEFAULT_THEME_TOKENS` in `src/lib/theme/tokens.ts` rather than hardcoded,
      so a future palette change cannot silently desynchronise the test from the
      shipped skin.
- [ ] The derived samples still assert `>= WCAG_AA_NORMAL_TEXT` for each pair in
      both light and dark, and the test fails if a token pair regresses below
      4.5:1 (verify by temporarily perturbing one token).
- [ ] `src/sidepanel/sidepanel.css` gains a `@media (prefers-reduced-motion:
      reduce)` block that removes or neutralises the hover `translateY` lifts and
      transform/shadow transitions, leaving focus-visible outlines and all
      non-motion styling intact.
- [ ] A test asserts the reduced-motion block exists and covers the transition
      declarations added by Ticket 407 (JSDOM cannot evaluate media queries, so
      assert on the stylesheet source, as the repo does elsewhere for CSP-style
      static checks).
- [ ] `npm run lint`, `npm test`, and `npm run build` pass.

## Out of scope

- Any change to the CannyForge palette values or the `THEME_PRESETS` list —
  Ticket 407's colours are verified and stay as shipped.
- Re-running the Ticket 407 user visual smoke check (its own last unchecked
  acceptance box, and an operator task).
- Bundling Inter/Instrument Serif font files — still CSP-blocked, tracked in
  407's out-of-scope section.
- Broader axe/JSDOM coverage work beyond the colour-contrast samples.

## Dependencies

- **Blocks:** 404 (release packaging should not certify an accessibility
  baseline measured against unshipped colours)
- **Blocked by:** — (Ticket 407 is merged)
- **External:** —

## Approach (optional)

Import `DEFAULT_THEME_TOKENS` into `a11y.test.ts` and build the sample map from
the same token keys `CONTRAST_PAIRS` already names, so the two tests share one
source of truth. For the CSS, a single trailing `@media` block that resets
`transition: none` and `transform: none` on the affected selectors is enough;
avoid a blanket `*` reset so focus and scroll behaviour are untouched.

## Browser / evidence notes (if applicable)

- **Permissions / APIs touched:** none.
- **Fixture coverage:** existing `a11y.test.ts` workspace fixture; no new
  fixture needed.

## Notes / decisions log

- 2026-07-19 — Filed during the merge review of Ticket 407. Both issues were
  confirmed by inspection: `grep -rn "prefers-reduced-motion" src/` returns
  nothing, and the `a11y.test.ts` hex values were diffed against both the
  pre-407 and post-407 token sets with no match. Merged 407 anyway rather than
  blocking it — the reskin's own contrast guarantees are independently tested
  and green.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch.
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
