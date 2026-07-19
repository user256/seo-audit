import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_TOKENS,
  fillThemeTokens,
  fillTokenSet,
  findPreset,
  isHexColor,
  THEME_PRESETS,
  THEME_TOKEN_KEYS,
} from './tokens';

describe('isHexColor', () => {
  it('accepts 6-digit hex only', () => {
    expect(isHexColor('#1a1a1a')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('1a1a1a')).toBe(false);
    expect(isHexColor('#1a1a1a; }body{display:none')).toBe(false);
  });
});

describe('fillTokenSet', () => {
  it('returns the shipped default untouched when nothing is stored', () => {
    expect(fillTokenSet(undefined, 'light')).toEqual(DEFAULT_THEME_TOKENS.light);
  });

  it('overrides only the keys present and valid, keeping defaults for the rest', () => {
    const filled = fillTokenSet({ fg: '#00ff00', border: 'not-a-colour' }, 'light');
    expect(filled.fg).toBe('#00ff00');
    expect(filled.border).toBe(DEFAULT_THEME_TOKENS.light.border);
    expect(filled.bg).toBe(DEFAULT_THEME_TOKENS.light.bg);
  });

  it('fills every declared token key', () => {
    const filled = fillTokenSet({}, 'dark');
    for (const key of THEME_TOKEN_KEYS) {
      expect(filled[key]).toBe(DEFAULT_THEME_TOKENS.dark[key]);
    }
  });
});

describe('fillThemeTokens', () => {
  it('degrades a partial/missing custom theme to shipped defaults per mode', () => {
    const filled = fillThemeTokens({ light: { accent: '#123456' } });
    expect(filled.light.accent).toBe('#123456');
    expect(filled.light.fg).toBe(DEFAULT_THEME_TOKENS.light.fg);
    expect(filled.dark).toEqual(DEFAULT_THEME_TOKENS.dark);
  });

  it('degrades a fully empty custom theme to the exact shipped default', () => {
    expect(fillThemeTokens({})).toEqual(DEFAULT_THEME_TOKENS);
  });
});

describe('THEME_PRESETS', () => {
  it('includes the CannyForge default plus at least one high-contrast and one neutral preset', () => {
    expect(findPreset('cannyforge-default')?.tokens).toEqual(DEFAULT_THEME_TOKENS);
    expect(findPreset('high-contrast')).toBeDefined();
    expect(findPreset('neutral')).toBeDefined();
  });

  it('every preset declares a full token set for both modes', () => {
    for (const preset of THEME_PRESETS) {
      for (const mode of ['light', 'dark'] as const) {
        for (const key of THEME_TOKEN_KEYS) {
          expect(isHexColor(preset.tokens[mode][key]), `${preset.id}.${mode}.${key}`).toBe(true);
        }
      }
    }
  });
});
