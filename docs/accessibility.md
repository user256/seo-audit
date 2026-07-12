# Accessibility baseline (Ticket 106)

Side-panel audit workspace accessibility notes for Sprint 1.

## Automated checks

`src/sidepanel/a11y.test.ts` runs `axe-core` against a fixture of the workspace
markup (findings + report chrome). Keep this green in CI.

```bash
npm test
```

## Manual keyboard smoke checklist

Run after loading unpacked `dist/` in Chrome:

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
   targets for `--fg` on `--bg`).

## Design notes

- Severity uses **text labels** plus colour chips (`aria-label="Severity …"`).
- Status and phase changes use `aria-live="polite"`.
- Skip link jumps to `#workspace-main`.
- Preview links keep `rel="noopener noreferrer"` (Ticket 105).
