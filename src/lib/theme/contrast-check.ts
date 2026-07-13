/**
 * WCAG AA contrast warnings for the theme editor (Ticket 405). Reuses the
 * existing deterministic contrast helpers rather than a new implementation
 * (`src/lib/contrast.ts`, also used by `src/sidepanel/a11y.test.ts`).
 */
import { contrastRatio, WCAG_AA_NORMAL_TEXT } from '../contrast';
import { THEME_TOKEN_LABEL, type ThemeTokenKey, type ThemeTokenSet } from './tokens';

export type ContrastPairDefinition = {
  id: string;
  label: string;
  fg: ThemeTokenKey;
  bg: ThemeTokenKey;
};

/** Every foreground/background pair the shipped CSS actually renders together. */
export const CONTRAST_PAIRS: readonly ContrastPairDefinition[] = [
  { id: 'text-on-background', label: 'Text on background', fg: 'fg', bg: 'bg' },
  { id: 'text-on-surface', label: 'Text on surface', fg: 'fg', bg: 'surface' },
  { id: 'muted-on-background', label: 'Muted text on background', fg: 'muted', bg: 'bg' },
  { id: 'link-on-background', label: 'Link on background', fg: 'link', bg: 'bg' },
  {
    id: 'severity-info',
    label: 'Severity — info',
    fg: 'sevInfoFg',
    bg: 'sevInfoBg',
  },
  {
    id: 'severity-warning',
    label: 'Severity — warning',
    fg: 'sevWarningFg',
    bg: 'sevWarningBg',
  },
  {
    id: 'severity-error',
    label: 'Severity — error',
    fg: 'sevErrorFg',
    bg: 'sevErrorBg',
  },
  {
    id: 'severity-critical',
    label: 'Severity — critical',
    fg: 'sevCriticalFg',
    bg: 'sevCriticalBg',
  },
];

export type ContrastCheckResult = {
  id: string;
  label: string;
  fgKey: ThemeTokenKey;
  bgKey: ThemeTokenKey;
  fgValue: string;
  bgValue: string;
  ratio: number;
  passesAA: boolean;
};

/** Checks every known fg/bg pair in a token set against WCAG AA (4.5:1 normal text). */
export function checkThemeContrast(tokens: ThemeTokenSet): ContrastCheckResult[] {
  return CONTRAST_PAIRS.map((pair) => {
    const fgValue = tokens[pair.fg];
    const bgValue = tokens[pair.bg];
    let ratio = 0;
    try {
      ratio = contrastRatio(fgValue, bgValue);
    } catch {
      ratio = 0;
    }
    return {
      id: pair.id,
      label: pair.label,
      fgKey: pair.fg,
      bgKey: pair.bg,
      fgValue,
      bgValue,
      ratio,
      passesAA: ratio >= WCAG_AA_NORMAL_TEXT,
    };
  });
}

export function describePair(pair: ContrastPairDefinition): string {
  return `${THEME_TOKEN_LABEL[pair.fg]} on ${THEME_TOKEN_LABEL[pair.bg]}`;
}
