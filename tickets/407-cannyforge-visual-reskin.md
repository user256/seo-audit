# Ticket 407: CannyForge Visual Reskin

**Sprint:** 4 — Durable Audits and Release Readiness
**Status:** Done — pending user visual smoke check
**Owner:** unassigned
**Estimate:** M

---

## Context

The shipped side-panel skin was a neo-brutalist ink/cream/lime design (zero
border-radius, 3px hard borders, hard offset shadows, uppercase mono labels).
Requested directly by the user as a full reskin to the CannyForge design
system (`/home/user256/resources/cannyforge/DESIGN.md`): violet-led, spacious,
premium, soft lavender light mode / layered indigo dark mode, gold used only
as a restrained forge accent. Filed retroactively — this was a direct user
request executed in-session, not from the ticket backlog, same pattern as
Tickets 405/406 being pulled ahead of their sprint.

## Goal

Replace the shipped skin's colour palette AND shape language (radius, borders,
shadows, typography) with the CannyForge system, without breaking the existing
user-theme-editor infrastructure (Ticket 405/406) or accessibility guarantees.

## Acceptance criteria

- [x] `src/sidepanel/sidepanel.css` restyled: Inter typography, rounded corners
  (pill buttons/badges, 12–16px cards/fields), soft violet elevation shadows
  replacing hard offset shadows, a restrained gold top-edge accent on card
  surfaces and section-heading bullets.
- [x] `src/lib/theme/tokens.ts` `DEFAULT_THEME_TOKENS` becomes the CannyForge
  palette (light + dark), each independently computed to clear WCAG AA
  (4.5:1) on every pair in `CONTRAST_PAIRS` — verified in
  `contrast-check.test.ts`.
- [x] The original ink/cream/lime skin is preserved, not deleted — added as a
  new **"Classic (brutalist)"** preset in `THEME_PRESETS`, selectable from the
  existing theme-editor UI alongside High contrast and Neutral.
- [x] `docs/theme-editor.md` and `docs/accessibility.md` updated to describe
  four presets and the renamed default preset id (`canonicals-default` →
  `cannyforge-default`).
- [x] `npm run lint`, `npm test` (407 tests), and `npm run build` pass.
- [ ] User has visually smoke-checked the reloaded unpacked extension in both
  light and dark OS appearance and confirmed no layout/contrast regressions
  (agent has no browser access in this session to verify rendering directly —
  only build output and automated contrast math were checked).

## Out of scope

- Structural layout changes beyond radius/shadow/spacing already implied by
  the design system (no new sections, no re-ordering of panel content).
- Bundling actual Inter/Instrument Serif font files (still CSP-blocked;
  system sans stack carries the look, same caveat as the prior skin's
  DM Sans/Space Mono naming).

## Dependencies

- **Blocks:** — (cosmetic; does not gate Sprint 1–3 operator work)
- **Blocked by:** — (built on the existing Ticket 405/406 theme-token
  infrastructure, already merged)
- **External:** user visual confirmation (last unchecked box above)

## Notes / decisions log

- 2026-07-19 — Filed and implemented same-session per direct user request
  ("reskin this in the cannyforge colour scheme"). User chose "full CannyForge
  look" (colours + shape language) over a colours-only swap when asked to
  scope the change, with the old skin kept as a selectable preset rather than
  deleted.

---

## Definition of done

This ticket is closeable when all acceptance criteria are checked (including
user visual confirmation), its changes are merged, the corresponding
`tickets/overview.md` bullet is completed, and any new follow-up is filed
separately.
