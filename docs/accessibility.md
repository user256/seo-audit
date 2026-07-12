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
2. **Tab** through Allow / Start audit / Refresh / Test page access — each control
   shows a visible `:focus-visible` ring.
3. On an unsupported tab (`chrome://`), confirm the phase badge reads
   “Unsupported tab” and Allow/Start audit stay hidden.
4. On an https page without access, focus **Allow this site** and activate with
   Enter/Space; after grant, **Start audit** is reachable by keyboard.
5. After an audit, **Tab** into findings category `<summary>` elements; Space
   toggles expand/collapse.
6. Open **Open report**, confirm focus moves to the Markdown textarea; edit text;
   **Back to findings** returns without clearing the session.
7. In report Source mode, Ctrl/Cmd+B and Ctrl/Cmd+I still format selection.
8. Resize the side panel near **320 CSS px** — primary actions wrap and remain
   clickable/focusable (not clipped off-screen).
9. Toggle OS light/dark appearance — body text remains readable (AA contrast
   targets for `--fg` on `--bg` as measured above).

## Design notes

- Severity uses **text labels** plus colour chips (`aria-label="Severity …"`).
- Status and phase changes use `aria-live="polite"`.
- Skip link jumps to `#workspace-main`.
- Preview links keep `rel="noopener noreferrer"`; images and raw HTML hosts are
  stripped (Ticket 108).
