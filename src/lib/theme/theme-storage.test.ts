import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCustomTheme,
  loadCustomTheme,
  loadResolvedTheme,
  saveCustomTheme,
} from './theme-storage';
import { DEFAULT_THEME_TOKENS } from './tokens';

describe('custom theme storage', () => {
  let stored: Record<string, unknown> = {};

  beforeEach(() => {
    stored = {};
    chrome.storage.local.get = (async (key: string) => ({ [key]: stored[key] })) as never;
    chrome.storage.local.set = (async (items: Record<string, unknown>) => {
      stored = { ...stored, ...items };
    }) as never;
    chrome.storage.local.remove = (async (key: string) => {
      delete stored[key];
    }) as never;
  });

  it('returns an empty theme when nothing is stored', async () => {
    expect(await loadCustomTheme()).toEqual({});
  });

  it('round-trips a saved custom theme through storage.local', async () => {
    await saveCustomTheme({ light: { accent: '#00ff00' }, dark: { fg: '#123456' } });
    const loaded = await loadCustomTheme();
    expect(loaded).toEqual({ light: { accent: '#00ff00' }, dark: { fg: '#123456' } });
  });

  it('drops unknown/invalid keys and values on load', async () => {
    await saveCustomTheme({
      light: { accent: '#00ff00', notARealToken: '#fff', border: 'red' } as never,
    });
    const loaded = await loadCustomTheme();
    expect(loaded).toEqual({ light: { accent: '#00ff00' } });
  });

  it('falls back to an empty theme when storage.local.get throws', async () => {
    chrome.storage.local.get = (async () => {
      throw new Error('storage unavailable');
    }) as never;
    expect(await loadCustomTheme()).toEqual({});
  });

  it('clearCustomTheme removes the stored key so the shipped default reloads', async () => {
    await saveCustomTheme({ light: { accent: '#00ff00' } });
    await clearCustomTheme();
    expect(await loadCustomTheme()).toEqual({});
  });

  it('loadResolvedTheme fills a partial stored theme with shipped defaults', async () => {
    await saveCustomTheme({ light: { accent: '#00ff00' } });
    const { stored: storedTheme, resolved } = await loadResolvedTheme();
    expect(storedTheme).toEqual({ light: { accent: '#00ff00' } });
    expect(resolved.light.accent).toBe('#00ff00');
    expect(resolved.light.fg).toBe(DEFAULT_THEME_TOKENS.light.fg);
    expect(resolved.dark).toEqual(DEFAULT_THEME_TOKENS.dark);
  });
});
