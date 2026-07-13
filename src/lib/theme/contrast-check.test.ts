import { describe, expect, it } from 'vitest';
import { checkThemeContrast, CONTRAST_PAIRS } from './contrast-check';
import { DEFAULT_THEME_TOKENS, THEME_PRESETS } from './tokens';

describe('checkThemeContrast', () => {
  it('checks every declared pair and reports a ratio for each', () => {
    const results = checkThemeContrast(DEFAULT_THEME_TOKENS.light);
    expect(results).toHaveLength(CONTRAST_PAIRS.length);
    for (const result of results) {
      expect(result.ratio).toBeGreaterThan(0);
    }
  });

  it('flags a failing pair without blocking (saving is allowed, warning is not silent)', () => {
    const nearlyIdentical = {
      ...DEFAULT_THEME_TOKENS.light,
      fg: '#f5f0e9', // one shade off the background — fails AA on purpose
    };
    const results = checkThemeContrast(nearlyIdentical);
    const textOnBackground = results.find((r) => r.id === 'text-on-background');
    expect(textOnBackground?.passesAA).toBe(false);
    expect(textOnBackground?.ratio).toBeLessThan(4.5);
  });

  it('passes AA for a genuinely high-contrast pair', () => {
    const results = checkThemeContrast({
      ...DEFAULT_THEME_TOKENS.light,
      fg: '#000000',
      bg: '#ffffff',
    });
    const textOnBackground = results.find((r) => r.id === 'text-on-background');
    expect(textOnBackground?.passesAA).toBe(true);
    expect(textOnBackground?.ratio).toBeCloseTo(21, 0);
  });

  it('every shipped preset passes AA on every declared pair, in both light and dark', () => {
    for (const preset of THEME_PRESETS) {
      for (const mode of ['light', 'dark'] as const) {
        const results = checkThemeContrast(preset.tokens[mode]);
        const failing = results.filter((r) => !r.passesAA);
        expect(failing, `${preset.id}/${mode}: ${JSON.stringify(failing)}`).toEqual([]);
      }
    }
  });
});
