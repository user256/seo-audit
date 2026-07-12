import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance, WCAG_AA_NORMAL_TEXT } from './contrast';

describe('contrast helpers', () => {
  it('expands 3-digit hex and rejects invalid input', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
    expect(() => relativeLuminance('nope')).toThrow(/Invalid hex/);
  });

  it('computes black-on-white above AA', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});
