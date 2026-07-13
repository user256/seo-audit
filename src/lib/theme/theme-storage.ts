/**
 * Local-only persistence for the custom theme (Ticket 405). Uses
 * `chrome.storage.local` (same permission already declared for UA-profile and
 * session storage) — never synced, never sent anywhere. A missing or
 * partially-invalid stored value degrades to the shipped default rather than
 * failing the panel (mirrors `src/lib/ua-profiles/preference-storage.ts`).
 */
import { fillThemeTokens, isHexColor, THEME_TOKEN_KEYS, type ThemeTokenSet } from './tokens';

const STORAGE_KEY = 'customTheme';

/** Stored shape allows partial/missing keys per mode; unknown/invalid keys are dropped on load. */
export type StoredCustomTheme = {
  light?: Partial<ThemeTokenSet>;
  dark?: Partial<ThemeTokenSet>;
};

function sanitizeTokenSet(value: unknown): Partial<ThemeTokenSet> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  const result: Partial<ThemeTokenSet> = {};
  for (const key of THEME_TOKEN_KEYS) {
    const raw = candidate[key];
    if (typeof raw === 'string' && isHexColor(raw)) {
      result[key] = raw;
    }
  }
  return result;
}

function sanitizeStoredTheme(value: unknown): StoredCustomTheme {
  if (!value || typeof value !== 'object') return {};
  const candidate = value as Record<string, unknown>;
  const light = sanitizeTokenSet(candidate.light);
  const dark = sanitizeTokenSet(candidate.dark);
  return {
    ...(light ? { light } : {}),
    ...(dark ? { dark } : {}),
  };
}

/** Best-effort load; falls back to `{}` (which fully degrades to shipped defaults) on any failure. */
export async function loadCustomTheme(): Promise<StoredCustomTheme> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return sanitizeStoredTheme(stored[STORAGE_KEY]);
  } catch {
    return {};
  }
}

/** Best-effort save; a failure never blocks the in-memory theme from taking effect. */
export async function saveCustomTheme(theme: StoredCustomTheme): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: theme });
  } catch {
    // Non-fatal — the panel keeps working from in-memory state only.
  }
}

/** "Reset to default" — removes the stored override entirely. */
export async function clearCustomTheme(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch {
    // Non-fatal — the panel keeps working from in-memory state only.
  }
}

/** Loads the stored theme and fills any missing/invalid key from the shipped default. */
export async function loadResolvedTheme() {
  const stored = await loadCustomTheme();
  return { stored, resolved: fillThemeTokens(stored) };
}
