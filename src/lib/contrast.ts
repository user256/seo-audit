/**
 * Relative-luminance / contrast helpers for deterministic WCAG checks
 * (Ticket 109). Used instead of axe colour-contrast under JSDOM, which cannot
 * measure rendered colours (canvas getContext is unimplemented).
 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio of two sRGB hex colours (order-independent). */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Normal text AA threshold. */
export const WCAG_AA_NORMAL_TEXT = 4.5;
