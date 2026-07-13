# Ticket 405: User-Defined Theme Editor

**Sprint:** 4 — Durable Audits and Release Readiness
**Status:** Done
**Owner:** unassigned
**Estimate:** M

## Context

The side panel is themed with a Canonicals-inspired skin driven entirely by CSS
custom properties on `:root` ([sidepanel.css](../src/sidepanel/sidepanel.css) —
`--bg`, `--fg`, `--surface`, `--border`, `--accent`, `--brand`, `--muted`,
`--link`, severity tokens). That token layer already makes the theme swappable;
users have asked to define their own. Because this is pure local styling with no
audit-data or permission implications, it belongs with the settings surface
(Ticket 403) in the release-readiness sprint rather than the inspection work.

## Goal

Let a user define, preview, persist, and reset a custom colour theme built on the
existing CSS-variable token set, without loading any remote assets.

## Acceptance criteria

- [x] A theme editor (in the settings/privacy surface from Ticket 403) exposes the
  brand token set — surface, text, border, accent, brand, muted, link, and the
  severity colours — with colour inputs and a live in-panel preview. — Ticket
  403 doesn't exist yet, so this ticket adds a minimal, always-visible
  **Appearance** section instead (`src/sidepanel/index.html`,
  `src/sidepanel/theme-editor-view.ts`); the full token set including `bg`
  (context lists it as part of the same token layer) has one colour input per
  token per mode, applied live via `applyTheme` on every edit.
- [x] Built-in presets are selectable (Canonicals default + at least one
  high-contrast and one neutral), and "Reset to default" restores the shipped
  theme. — `THEME_PRESETS` in `src/lib/theme/tokens.ts`
  (`canonicals-default`/`high-contrast`/`neutral`); Reset removes the injected
  override `<style>` entirely so `sidepanel.css`'s shipped rules take over
  exactly (`resetTheme` + `clearCustomTheme`).
- [x] Custom themes persist locally (extension storage) and reload on panel open;
  separate light/dark values are supported and respect `prefers-color-scheme`.
  — `chrome.storage.local` under the `customTheme` key
  (`src/lib/theme/theme-storage.ts`), loaded in `bootstrap()`
  (`src/sidepanel/sidepanel.ts`). `ThemeTokens = { light, dark }`; applied as
  a `:root` rule plus a `@media (prefers-color-scheme: dark) { :root {...} }`
  block (`src/lib/theme/apply-theme.ts`) rather than inline styles, precisely
  so the media query keeps re-resolving on an OS/browser scheme change — see
  `docs/theme-editor.md`.
- [x] Each edited foreground/background pair is checked with the existing
  contrast utility ([contrast.ts](../src/lib/contrast.ts)); pairs failing WCAG AA
  are flagged with a warning (saving is allowed but not silent). —
  `src/lib/theme/contrast-check.ts` reuses `contrastRatio`/`WCAG_AA_NORMAL_TEXT`
  directly; 8 declared pairs per mode rendered live under each fieldset in
  `theme-editor-view.ts`, warning-only (never blocks saving).
- [x] The theme is applied by setting CSS variables only — no inline per-element
  styles, no remote fonts/stylesheets, and the extension CSP is unchanged. —
  Single injected `<style id="seo-audit-custom-theme">` element containing only
  `--custom-property: #hex;` declarations (`apply-theme.test.ts` asserts no
  `@import`/`url()`/script content); every value is re-validated against a
  strict hex regex before interpolation. No manifest/CSP change.
- [x] Tests cover token round-trip persistence, preset/reset application, and the
  AA contrast-warning logic. — `src/lib/theme/theme-storage.test.ts`,
  `apply-theme.test.ts`, `tokens.test.ts`, `contrast-check.test.ts`,
  `src/sidepanel/theme-editor-view.test.ts` (30 new tests total).

## Out of scope

- Custom fonts/typography uploads or bundling brand webfonts (separate follow-up).
- Layout/spacing/border-width editing — colour tokens only in this ticket.
- Theme import/export files or sharing (could be a later ticket).
- Per-site or per-session themes.

## Dependencies

- **Blocks:** none
- **Blocked by:** 111 (token-driven dashboard), 403 (settings surface)
- **External:** none

## Approach

Persist a token map and, on load, write it to `document.documentElement.style`
custom properties over the defaults. Keep the shipped theme as the fallback so a
missing/partial custom theme degrades to defaults. Reuse `contrast.ts` for the AA
checks rather than a new implementation. The token layer is sprint-agnostic, so
this can be pulled earlier than Sprint 4 if prioritised — it only needs the
settings surface to live in.

## Notes / decisions log

- 2026-07-12 — Filed at user request ("we need a theme editor so users can define
  their own"). Enabled by the CSS-variable token layer added in the Canonicals
  reskin.
- 2026-07-13 — Implemented ahead of Ticket 403 (per the ticket's own Approach
  note: "this can be pulled earlier than Sprint 4 if prioritised — it only
  needs the settings surface to live in"). Ticket 403 doesn't exist yet, so
  this ticket adds only a minimal, always-visible **Appearance** section
  (`src/sidepanel/index.html`) rather than inventing 403's full
  settings/privacy UI — no origin/permission/data-retention controls were
  added here, that stays 403's scope.
- 2026-07-13 — Departed from the Approach note's
  `document.documentElement.style` suggestion: inline styles have higher CSS
  specificity than a `@media (prefers-color-scheme: dark)` rule, which would
  have permanently pinned the light values and broken the "respect
  prefers-color-scheme" acceptance criterion. Used a single injected
  `<style>` element with its own `:root` + dark-media block instead — still
  "setting CSS variables only," still no inline per-element styles, and the
  dark-mode requirement is satisfied. See `docs/theme-editor.md`.
- 2026-07-13 — Included `bg` (page background) in the editable token set even
  though the AC bullet's inline list omits it — the ticket's own Context
  section lists `--bg` as part of the same token layer, and it is the
  necessary bg half of the primary `fg`-on-`bg` contrast pair, so leaving it
  out would have made the contrast checker incomplete for the most important
  pair.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
