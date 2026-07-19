# Accessibility baseline (Tickets 106 + 109)

Side-panel audit workspace accessibility notes for Sprint 1.

## Automated checks

`src/sidepanel/a11y.test.ts` runs `axe-core` against a workspace fixture
(**excluding** `color-contrast`, which JSDOM cannot evaluate because
`HTMLCanvasElement.getContext` is unimplemented). Colour contrast for shipped
light/dark tokens is asserted with deterministic WCAG ratios in the same file
via `src/lib/contrast.ts`.

```bash
npm test
```

Documented AA (≥ 4.5:1) pairs:

| Theme | Pair                          | Colours                |
| ----- | ----------------------------- | ---------------------- |
| Light | `--fg` on `--bg`              | `#1a1a1a` on `#f7f7f5` |
| Light | `--muted` on `--bg`           | `#555555` on `#f7f7f5` |
| Light | `--accent-text` on `--accent` | `#ffffff` on `#0b5fff` |
| Dark  | `--fg` on `--bg`              | `#eceef2` on `#12141a` |
| Dark  | `--muted` on `--bg`           | `#b0b6c2` on `#12141a` |
| Dark  | `--accent-text` on `--accent` | `#0b1220` on `#6ea8ff` |

## Manual keyboard smoke checklist

Run after loading unpacked `dist/` in Chrome (see also
`docs/sprint-1-smoke.md`):

1. Open the side panel with the toolbar action.
2. **Tab** through Start audit / Refresh / Test page access — each control
   shows a visible `:focus-visible` ring.
3. On an unsupported tab (`chrome://`), confirm the phase badge reads
   “Unsupported tab” and Start audit stays hidden.
4. On an https page, **Start audit** is reachable by keyboard without an Allow
   step (required HTTP(S) host permissions).
5. After an audit, **Tab** into findings category `<summary>` elements; Space
   toggles expand/collapse.
6. Open **Open report**, confirm focus moves to the Markdown textarea; edit text;
   **Back to findings** returns without clearing the session.
7. In report Source mode, Ctrl/Cmd+B and Ctrl/Cmd+I still format selection.
8. Resize the side panel near **320 CSS px** — primary actions wrap and remain
   clickable/focusable (not clipped off-screen).
9. Toggle OS light/dark appearance — body text remains readable (AA contrast
   targets for `--fg` on `--bg` as measured above).
10. With site access on an https page, expand **Crawl signals** panels with
    keyboard (**Tab** into each `<summary>`, Space toggles). **Fetch robots**
    and **Discover & fetch sitemap** disable while a fetch is in flight
    (`aria-busy="true"`).
11. Confirm availability badges (`present`, `unavailable`, `absent`, `error`,
    `needs access`) are exposed to screen readers via `role="status"` and
    `aria-label`.
12. Expand **Appearance → Theme editor** (always visible, no site access
    needed). Pick **High contrast**, confirm the whole panel re-skins
    immediately; **Tab** through the colour inputs and confirm each has a
    visible label and focus ring; click **Reset to default** and confirm the
    shipped skin returns exactly.

## Theme editor (Ticket 405)

- Custom colours are applied only via injected `<style>` CSS custom
  properties (`src/lib/theme/apply-theme.ts`) — never inline per-element
  styles, so `:focus-visible` and other rules in `sidepanel.css` keep working
  unchanged.
- Every declared foreground/background pair (text/background, text/surface,
  muted/background, link/background, and the four severity pairs) is checked
  against WCAG AA on every edit (`src/lib/theme/contrast-check.ts`); failing
  pairs render a visible, non-`aria-hidden` warning with the exact ratio —
  saving is never blocked, so this is advisory rather than a hard gate.
- All four shipped presets (CannyForge default, classic brutalist, high
  contrast, neutral) pass AA on every checked pair in both light and dark,
  asserted in `contrast-check.test.ts`.
- See `docs/theme-editor.md` for the full design.

## Crawl signals (Ticket 205)

- Three labelled `<details>` panels: navigation/headers, robots.txt, sitemap.
- Capture errors render as plain text with a distinct **error** availability
  badge — they are not styled as pass/fail findings.
- Long redirect hops, header lists, and sitemap candidate lists truncate with
  “Showing N of M”.
- Findings below remain the reconciliation surface for indexability rules.

## Design notes

- Severity uses **text labels** plus colour chips (`aria-label="Severity …"`).
- Status and phase changes use `aria-live="polite"`.
- Skip link jumps to `#workspace-main`.
- Preview links keep `rel="noopener noreferrer"`; images and raw HTML hosts are
  stripped (Ticket 108).
