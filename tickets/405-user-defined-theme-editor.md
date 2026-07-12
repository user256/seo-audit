# Ticket 405: User-Defined Theme Editor

**Sprint:** 4 — Durable Audits and Release Readiness
**Status:** Not started
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

- [ ] A theme editor (in the settings/privacy surface from Ticket 403) exposes the
  brand token set — surface, text, border, accent, brand, muted, link, and the
  severity colours — with colour inputs and a live in-panel preview.
- [ ] Built-in presets are selectable (Canonicals default + at least one
  high-contrast and one neutral), and "Reset to default" restores the shipped
  theme.
- [ ] Custom themes persist locally (extension storage) and reload on panel open;
  separate light/dark values are supported and respect `prefers-color-scheme`.
- [ ] Each edited foreground/background pair is checked with the existing
  contrast utility ([contrast.ts](../src/lib/contrast.ts)); pairs failing WCAG AA
  are flagged with a warning (saving is allowed but not silent).
- [ ] The theme is applied by setting CSS variables only — no inline per-element
  styles, no remote fonts/stylesheets, and the extension CSP is unchanged.
- [ ] Tests cover token round-trip persistence, preset/reset application, and the
  AA contrast-warning logic.

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

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
