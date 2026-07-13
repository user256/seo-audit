/**
 * Applies a theme by writing CSS custom properties only (Ticket 405) — never
 * inline per-element styles, never a remote stylesheet/font. A single
 * injected `<style>` element declares `:root` (light) plus a
 * `@media (prefers-color-scheme: dark)` block, so a custom theme still
 * respects the OS/browser colour-scheme preference exactly like the shipped
 * `sidepanel.css` defaults do.
 */
import { DEFAULT_THEME_TOKENS, isHexColor, THEME_TOKEN_CSS_VAR, THEME_TOKEN_KEYS } from './tokens';
import type { ThemeMode, ThemeTokens, ThemeTokenSet } from './tokens';

export const CUSTOM_THEME_STYLE_ELEMENT_ID = 'seo-audit-custom-theme';

/** Defence in depth: never let a non-hex value reach the injected stylesheet text. */
function safeTokenSet(tokens: ThemeTokenSet, mode: ThemeMode): ThemeTokenSet {
  const fallback = DEFAULT_THEME_TOKENS[mode];
  const result = { ...fallback };
  for (const key of THEME_TOKEN_KEYS) {
    const value = tokens[key];
    if (typeof value === 'string' && isHexColor(value)) {
      result[key] = value;
    }
  }
  return result;
}

function declarationsFor(tokens: ThemeTokenSet, mode: ThemeMode, indent: string): string {
  const safe = safeTokenSet(tokens, mode);
  return THEME_TOKEN_KEYS.map((key) => `${indent}${THEME_TOKEN_CSS_VAR[key]}: ${safe[key]};`).join(
    '\n',
  );
}

export function buildThemeCss(tokens: ThemeTokens): string {
  return [
    ':root {',
    declarationsFor(tokens.light, 'light', '  '),
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root {',
    declarationsFor(tokens.dark, 'dark', '    '),
    '  }',
    '}',
    '',
  ].join('\n');
}

function customThemeStyleElement(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(CUSTOM_THEME_STYLE_ELEMENT_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const styleEl = doc.createElement('style');
  styleEl.id = CUSTOM_THEME_STYLE_ELEMENT_ID;
  doc.head.append(styleEl);
  return styleEl;
}

/** Injects/updates the custom-theme `<style>` element. Idempotent — safe to call on every edit. */
export function applyTheme(tokens: ThemeTokens, doc: Document = document): void {
  const styleEl = customThemeStyleElement(doc);
  styleEl.textContent = buildThemeCss(tokens);
}

/** "Reset to default" — removes the override so the shipped `sidepanel.css` tokens take over. */
export function resetTheme(doc: Document = document): void {
  doc.getElementById(CUSTOM_THEME_STYLE_ELEMENT_ID)?.remove();
}
