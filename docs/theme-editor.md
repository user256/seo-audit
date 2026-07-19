# User-defined theme editor (Ticket 405)

Implementation: `src/lib/theme/` (tokens, presets, storage, CSS application)
and `src/sidepanel/theme-editor-view.ts` (UI). Wired into
`src/sidepanel/sidepanel.ts` as an **Appearance** section that is always
visible in the side panel, independent of tab/session state — there is no
Ticket 403 settings surface yet, so this ticket adds only the minimal section
it needs rather than inventing one.

## Token set

The editor exposes exactly the CSS custom properties that already drive
`sidepanel.css`'s CannyForge-inspired skin (`src/lib/theme/tokens.ts`):
`bg`, `fg` (text), `surface`, `border`, `muted`, `accent`, `brand`, `link`,
and the four severity pairs (`sevInfoBg`/`Fg`, `sevWarningBg`/`Fg`,
`sevErrorBg`/`Fg`, `sevCriticalBg`/`Fg`) — 16 tokens, each with an independent
**light** and **dark** value (`ThemeTokens = { light, dark }`).

Layout, spacing, border-width, and typography are explicitly out of scope
(see the ticket's "Out of scope" section) — this editor only ever writes
colour custom properties.

## Presets

`THEME_PRESETS` (`src/lib/theme/tokens.ts`) ships four built-ins, each with
both light and dark values that independently pass WCAG AA on every checked
pair (verified in `contrast-check.test.ts`):

| Preset              | Id                   | Intent                                                                       |
| ------------------- | -------------------- | ---------------------------------------------------------------------------- |
| CannyForge default  | `cannyforge-default` | The shipped violet/lavender/gold skin (identical to `DEFAULT_THEME_TOKENS`). |
| Classic (brutalist) | `classic-brutalist`  | The original ink/cream/lime neo-brutalist skin, preserved for continuity.    |
| High contrast       | `high-contrast`      | Maximised black/white contrast.                                              |
| Neutral             | `neutral`            | Desaturated greys, low-distraction workspace.                                |

Clicking a preset button replaces the in-memory tokens, re-applies the theme,
and persists it — the preset itself is not "sticky" as a separate concept;
once applied it is indistinguishable from a from-scratch custom theme with
those exact values (`matchingPresetId` in `sidepanel.ts` detects an exact
match to keep a preset button visually pressed).

## Applying a theme: CSS variables only, no inline styles

`src/lib/theme/apply-theme.ts` injects a single `<style id="seo-audit-custom-theme">`
element into `<head>` containing:

```css
:root {
  --bg: #...;
  --fg: #...;
  /* …every token… */
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #...;
    /* …every token, dark values… */
  }
}
```

This is deliberately **not** `document.documentElement.style.setProperty(...)`.
Inline styles have higher CSS specificity than any stylesheet rule — including
a `@media (prefers-color-scheme: dark)` block — so writing custom-theme
overrides as inline styles would permanently pin the light values and break
the "respect `prefers-color-scheme`" acceptance criterion. A same-specificity
`:root` rule declared later in the document (this injected `<style>` sits
after `sidepanel.css`'s `<link>`) wins by source order while still letting the
media query re-resolve when the OS/browser colour scheme changes.

Every value is re-validated against a strict 6-digit hex regex
(`isHexColor`) before being interpolated into the stylesheet text, both when
loading from storage and again immediately before injection
(`apply-theme.ts`'s `safeTokenSet`) — defence in depth against a corrupted
stored value ever producing anything other than a `--custom-property: #hex;`
declaration. No `@import`, `url()`, or script content is ever possible in the
generated CSS (`apply-theme.test.ts` asserts this).

"Reset to default" (`resetTheme`) simply removes the injected `<style>`
element, so `sidepanel.css`'s own shipped `:root` / dark-media rules take over
exactly — there is no "default theme" applied as an override that could drift
from the CSS file.

## Persistence

The full resolved token set is persisted in `chrome.storage.local` under the
`customTheme` key (`src/lib/theme/theme-storage.ts`) — the same local-only
storage already used for UA-profile preferences
(`src/lib/ua-profiles/preference-storage.ts`), never IndexedDB (that is audit
data) and never synced. On load, `loadResolvedTheme()`:

1. Reads the stored value, dropping any key that is not one of the 16 known
   token names or whose value is not a 6-digit hex colour
   (`sanitizeStoredTheme`).
2. Fills every missing/invalid key from the shipped default
   (`fillThemeTokens`), independently per mode — a partially-corrupted or
   partially-customised theme always degrades to the shipped default for the
   keys it is missing, never to an `undefined` CSS value.

A failed `chrome.storage.local` read or write degrades gracefully (falls back
to the in-memory default, or simply doesn't persist) rather than blocking the
panel — mirrors the UA-profile preference module's error handling.

## Contrast warnings

`src/lib/theme/contrast-check.ts` reuses the existing WCAG helpers
(`src/lib/contrast.ts`, `contrastRatio` / `WCAG_AA_NORMAL_TEXT` — the same
module `src/sidepanel/a11y.test.ts` already uses to document the shipped
tokens) rather than a new implementation. `CONTRAST_PAIRS` declares every
foreground/background pair the shipped CSS actually renders together (text on
background, text on surface, muted text on background, link on background,
and the four severity pairs). `checkThemeContrast(tokens)` returns a ratio and
an AA pass/fail for each pair, for whichever mode (light/dark) is being
edited.

The editor shows a live **Contrast check** section per mode: pairs that fail
AA are listed with their exact ratio and a warning — **saving is never
blocked**, matching the ticket's "saving is allowed but not silent"
requirement. This is advisory, not a hard gate: a user may deliberately want
lower contrast for a specific creative reason, but they cannot do so by
accident without seeing the number.

## UI

The **Appearance** section (`src/sidepanel/index.html`) is a top-level,
always-visible section (not gated on tab/session state, unlike the dashboard
or findings sections) containing a collapsible **Theme editor** `<details>`
panel, styled with the same `crawl-panel` classes as the crawl-signals
panels. Inside (`src/sidepanel/theme-editor-view.ts`):

- preset buttons (`aria-pressed` reflects an exact token match);
- a **Reset to default** button;
- a **Light theme** and a **Dark theme** `<fieldset>`, each with one labelled
  `<input type="color">` per token plus a text readout of the current hex
  value (colour swatches alone are not sufficiently informative to screen
  readers);
- the contrast-check report described above.

Every input's `change`/`input` handler goes through `sidepanel.ts`'s
`renderThemeEditorPanel`, which updates the in-memory `themeTokens`,
re-applies the theme (`applyTheme`), persists it (`saveCustomTheme`), and
re-renders — so the preview is live and the persisted state is always in sync
with what's on screen.
