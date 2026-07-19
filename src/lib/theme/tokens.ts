/**
 * User-defined theme editor (Ticket 405). Token set mirrors the CSS custom
 * properties already driving `src/sidepanel/sidepanel.css` — the editor never
 * invents new variables, it only lets a user override the existing ones.
 */

export const THEME_TOKEN_KEYS = [
  'bg',
  'fg',
  'surface',
  'border',
  'muted',
  'accent',
  'brand',
  'link',
  'sevInfoBg',
  'sevInfoFg',
  'sevWarningBg',
  'sevWarningFg',
  'sevErrorBg',
  'sevErrorFg',
  'sevCriticalBg',
  'sevCriticalFg',
] as const;

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];

/** Maps each token key to the exact CSS custom property it overrides. */
export const THEME_TOKEN_CSS_VAR: Record<ThemeTokenKey, string> = {
  bg: '--bg',
  fg: '--fg',
  surface: '--surface',
  border: '--border',
  muted: '--muted',
  accent: '--accent',
  brand: '--brand',
  link: '--link',
  sevInfoBg: '--sev-info-bg',
  sevInfoFg: '--sev-info-fg',
  sevWarningBg: '--sev-warning-bg',
  sevWarningFg: '--sev-warning-fg',
  sevErrorBg: '--sev-error-bg',
  sevErrorFg: '--sev-error-fg',
  sevCriticalBg: '--sev-critical-bg',
  sevCriticalFg: '--sev-critical-fg',
};

export const THEME_TOKEN_LABEL: Record<ThemeTokenKey, string> = {
  bg: 'Page background',
  fg: 'Text',
  surface: 'Surface (cards)',
  border: 'Border',
  muted: 'Muted text',
  accent: 'Accent',
  brand: 'Brand',
  link: 'Link',
  sevInfoBg: 'Severity — info background',
  sevInfoFg: 'Severity — info text',
  sevWarningBg: 'Severity — warning background',
  sevWarningFg: 'Severity — warning text',
  sevErrorBg: 'Severity — error background',
  sevErrorFg: 'Severity — error text',
  sevCriticalBg: 'Severity — critical background',
  sevCriticalFg: 'Severity — critical text',
};

export type ThemeTokenSet = Record<ThemeTokenKey, string>;

export type ThemeMode = 'light' | 'dark';

export type ThemeTokens = {
  light: ThemeTokenSet;
  dark: ThemeTokenSet;
};

/** Exact values shipped in `sidepanel.css` today — the CannyForge reskin. */
const CANNYFORGE_LIGHT: ThemeTokenSet = {
  bg: '#f7f5ff',
  fg: '#1b143f',
  surface: '#ffffff',
  border: '#e5e7eb',
  muted: '#655e82',
  accent: '#ca8a04',
  brand: '#6d4aff',
  link: '#5533c9',
  sevInfoBg: '#e2dbff',
  sevInfoFg: '#372580',
  sevWarningBg: '#fdf3d9',
  sevWarningFg: '#6b4b02',
  sevErrorBg: '#fbe4e4',
  sevErrorFg: '#8a2323',
  sevCriticalBg: '#7a1f2e',
  sevCriticalFg: '#ffffff',
};

const CANNYFORGE_DARK: ThemeTokenSet = {
  bg: '#08031f',
  fg: '#f7f5ff',
  surface: '#1b1340',
  border: '#362a63',
  muted: '#b09dff',
  accent: '#fbbf24',
  brand: '#6d4aff',
  link: '#9a82ff',
  sevInfoBg: '#2a2258',
  sevInfoFg: '#cdbfff',
  sevWarningBg: '#3a2a0a',
  sevWarningFg: '#fbbf24',
  sevErrorBg: '#3a1414',
  sevErrorFg: '#ff9a8a',
  sevCriticalBg: '#fbbf24',
  sevCriticalFg: '#1b143f',
};

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  light: CANNYFORGE_LIGHT,
  dark: CANNYFORGE_DARK,
};

/** The original ink/cream/lime neo-brutalist skin, preserved as a selectable preset. */
const CLASSIC_LIGHT: ThemeTokenSet = {
  bg: '#f5f0e8',
  fg: '#1a1a1a',
  surface: '#ffffff',
  border: '#1a1a1a',
  muted: '#5c5c5c',
  accent: '#d4ff00',
  brand: '#ff5c38',
  link: '#b23415',
  sevInfoBg: '#e8e2d6',
  sevInfoFg: '#333333',
  sevWarningBg: '#ffe0d3',
  sevWarningFg: '#8a3a12',
  sevErrorBg: '#f3c9c4',
  sevErrorFg: '#7a1710',
  sevCriticalBg: '#7a1414',
  sevCriticalFg: '#ffffff',
};

const CLASSIC_DARK: ThemeTokenSet = {
  bg: '#1a1a1a',
  fg: '#f5f0e8',
  surface: '#232320',
  border: '#5c5c5c',
  muted: '#b8b2a6',
  accent: '#d4ff00',
  brand: '#ff5c38',
  link: '#ff9a7a',
  sevInfoBg: '#2a2a26',
  sevInfoFg: '#d8d2c6',
  sevWarningBg: '#3a2213',
  sevWarningFg: '#ffb489',
  sevErrorBg: '#3a1512',
  sevErrorFg: '#ff9a8a',
  sevCriticalBg: '#ff5c38',
  sevCriticalFg: '#1a1a1a',
};

const HIGH_CONTRAST_LIGHT: ThemeTokenSet = {
  bg: '#ffffff',
  fg: '#000000',
  surface: '#ffffff',
  border: '#000000',
  muted: '#262626',
  accent: '#ffe600',
  brand: '#0000ee',
  link: '#0000ee',
  sevInfoBg: '#ffffff',
  sevInfoFg: '#000000',
  sevWarningBg: '#fff3cd',
  sevWarningFg: '#664d03',
  sevErrorBg: '#f8d7da',
  sevErrorFg: '#58151c',
  sevCriticalBg: '#000000',
  sevCriticalFg: '#ffffff',
};

const HIGH_CONTRAST_DARK: ThemeTokenSet = {
  bg: '#000000',
  fg: '#ffffff',
  surface: '#000000',
  border: '#ffffff',
  muted: '#d9d9d9',
  accent: '#ffe600',
  brand: '#66b3ff',
  link: '#66b3ff',
  sevInfoBg: '#000000',
  sevInfoFg: '#ffffff',
  sevWarningBg: '#3a2f00',
  sevWarningFg: '#ffe066',
  sevErrorBg: '#3a0000',
  sevErrorFg: '#ff8080',
  sevCriticalBg: '#ffffff',
  sevCriticalFg: '#000000',
};

const NEUTRAL_LIGHT: ThemeTokenSet = {
  bg: '#f2f2f2',
  fg: '#1f1f1f',
  surface: '#ffffff',
  border: '#4d4d4d',
  muted: '#6b6b6b',
  accent: '#d9d9d9',
  brand: '#808080',
  link: '#3d5a80',
  sevInfoBg: '#e6e6e6',
  sevInfoFg: '#333333',
  sevWarningBg: '#ece0d1',
  sevWarningFg: '#6b4423',
  sevErrorBg: '#e0d1d1',
  sevErrorFg: '#6b1f1f',
  sevCriticalBg: '#4d4d4d',
  sevCriticalFg: '#ffffff',
};

const NEUTRAL_DARK: ThemeTokenSet = {
  bg: '#1f1f1f',
  fg: '#e6e6e6',
  surface: '#2b2b2b',
  border: '#808080',
  muted: '#a6a6a6',
  accent: '#595959',
  brand: '#a6a6a6',
  link: '#8fb4d9',
  sevInfoBg: '#2b2b2b',
  sevInfoFg: '#cccccc',
  sevWarningBg: '#3d332b',
  sevWarningFg: '#e0b088',
  sevErrorBg: '#3d2b2b',
  sevErrorFg: '#e08080',
  sevCriticalBg: '#808080',
  sevCriticalFg: '#000000',
};

export type ThemePreset = {
  id: string;
  label: string;
  description: string;
  tokens: ThemeTokens;
};

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'cannyforge-default',
    label: 'CannyForge default',
    description: 'The shipped violet, lavender, and gold CannyForge skin.',
    tokens: DEFAULT_THEME_TOKENS,
  },
  {
    id: 'classic-brutalist',
    label: 'Classic (brutalist)',
    description: 'The original ink/cream/lime neo-brutalist skin.',
    tokens: { light: CLASSIC_LIGHT, dark: CLASSIC_DARK },
  },
  {
    id: 'high-contrast',
    label: 'High contrast',
    description: 'Maximised black/white contrast for low-vision users.',
    tokens: { light: HIGH_CONTRAST_LIGHT, dark: HIGH_CONTRAST_DARK },
  },
  {
    id: 'neutral',
    label: 'Neutral',
    description: 'Desaturated greys for a low-distraction workspace.',
    tokens: { light: NEUTRAL_LIGHT, dark: NEUTRAL_DARK },
  },
];

export function findPreset(presetId: string): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => preset.id === presetId);
}

/** Fills any missing key in a partial token set from the shipped default for that mode. */
export function fillTokenSet(
  partial: Partial<ThemeTokenSet> | undefined,
  mode: ThemeMode,
): ThemeTokenSet {
  const fallback = DEFAULT_THEME_TOKENS[mode];
  const result = { ...fallback };
  if (!partial) return result;
  for (const key of THEME_TOKEN_KEYS) {
    const value = partial[key];
    if (typeof value === 'string' && isHexColor(value)) {
      result[key] = value;
    }
  }
  return result;
}

/** A missing/partial custom theme always degrades to the shipped default (per-key, per-mode). */
export function fillThemeTokens(partial: {
  light?: Partial<ThemeTokenSet>;
  dark?: Partial<ThemeTokenSet>;
}): ThemeTokens {
  return {
    light: fillTokenSet(partial.light, 'light'),
    dark: fillTokenSet(partial.dark, 'dark'),
  };
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
