import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_UA_PROFILE_PREFERENCE,
  loadUaProfilePreference,
  saveUaProfilePreference,
} from './preference-storage';

describe('ua profile preference storage', () => {
  beforeEach(() => {
    (chrome.storage.local.get as unknown as (...args: unknown[]) => unknown) = async () => ({});
    (chrome.storage.local.set as unknown as (...args: unknown[]) => unknown) = async () =>
      undefined;
  });

  it('returns the default preference when nothing is stored', async () => {
    const preference = await loadUaProfilePreference();
    expect(preference).toEqual(DEFAULT_UA_PROFILE_PREFERENCE);
  });

  it('round-trips a saved preference through storage.local', async () => {
    let stored: Record<string, unknown> = {};
    chrome.storage.local.get = (async (key: string) => ({ [key]: stored[key] })) as never;
    chrome.storage.local.set = (async (items: Record<string, unknown>) => {
      stored = { ...stored, ...items };
    }) as never;

    await saveUaProfilePreference({ profileId: 'googlebot-style', customUserAgent: '' });
    const loaded = await loadUaProfilePreference();
    expect(loaded).toEqual({ profileId: 'googlebot-style', customUserAgent: '' });
  });

  it('falls back to the default when the stored value is invalid', async () => {
    chrome.storage.local.get = (async (key: string) => ({
      [key]: { profileId: 'not-a-real-profile', customUserAgent: '' },
    })) as never;

    const preference = await loadUaProfilePreference();
    expect(preference).toEqual(DEFAULT_UA_PROFILE_PREFERENCE);
  });

  it('falls back to the default when storage.local.get throws', async () => {
    chrome.storage.local.get = (async () => {
      throw new Error('storage unavailable');
    }) as never;

    const preference = await loadUaProfilePreference();
    expect(preference).toEqual(DEFAULT_UA_PROFILE_PREFERENCE);
  });
});
