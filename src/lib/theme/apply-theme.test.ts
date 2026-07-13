import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyTheme,
  buildThemeCss,
  CUSTOM_THEME_STYLE_ELEMENT_ID,
  resetTheme,
} from './apply-theme';
import { DEFAULT_THEME_TOKENS, THEME_PRESETS, THEME_TOKEN_CSS_VAR } from './tokens';

describe('buildThemeCss', () => {
  it('declares every token as a CSS custom property on :root, plus a dark media block', () => {
    const css = buildThemeCss(DEFAULT_THEME_TOKENS);
    expect(css).toContain(':root {');
    expect(css).toContain('@media (prefers-color-scheme: dark) {');
    expect(css).toContain(`${THEME_TOKEN_CSS_VAR.fg}: ${DEFAULT_THEME_TOKENS.light.fg};`);
    expect(css).toContain(`${THEME_TOKEN_CSS_VAR.fg}: ${DEFAULT_THEME_TOKENS.dark.fg};`);
  });

  it('sets CSS variables only — no @import, no url(), no <script>', () => {
    for (const preset of THEME_PRESETS) {
      const css = buildThemeCss(preset.tokens);
      expect(css).not.toMatch(/@import/i);
      expect(css).not.toMatch(/url\(/i);
      expect(css).not.toMatch(/<script/i);
    }
  });

  it('falls back to the shipped default for a non-hex value (defence in depth)', () => {
    const tampered = {
      light: { ...DEFAULT_THEME_TOKENS.light, fg: 'javascript:alert(1)' },
      dark: DEFAULT_THEME_TOKENS.dark,
    };
    const css = buildThemeCss(tampered);
    expect(css).not.toContain('javascript:alert');
    expect(css).toContain(`${THEME_TOKEN_CSS_VAR.fg}: ${DEFAULT_THEME_TOKENS.light.fg};`);
  });
});

describe('applyTheme / resetTheme', () => {
  beforeEach(() => {
    document.getElementById(CUSTOM_THEME_STYLE_ELEMENT_ID)?.remove();
  });

  it('injects a single <style> element with the theme CSS', () => {
    applyTheme(DEFAULT_THEME_TOKENS);
    const styleEl = document.getElementById(CUSTOM_THEME_STYLE_ELEMENT_ID);
    expect(styleEl?.tagName).toBe('STYLE');
    expect(styleEl?.textContent).toContain(DEFAULT_THEME_TOKENS.light.fg);
  });

  it('is idempotent — re-applying updates the same element instead of adding another', () => {
    applyTheme(DEFAULT_THEME_TOKENS);
    const highContrast = THEME_PRESETS.find((p) => p.id === 'high-contrast')!;
    applyTheme(highContrast.tokens);
    const styleEls = document.querySelectorAll(`#${CUSTOM_THEME_STYLE_ELEMENT_ID}`);
    expect(styleEls).toHaveLength(1);
    expect(styleEls[0].textContent).toContain(highContrast.tokens.light.fg);
  });

  it('resetTheme removes the override so the shipped sidepanel.css tokens take over', () => {
    applyTheme(DEFAULT_THEME_TOKENS);
    resetTheme();
    expect(document.getElementById(CUSTOM_THEME_STYLE_ELEMENT_ID)).toBeNull();
  });
});
