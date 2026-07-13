import { UA_PROFILE_LIMITS } from './limits';
import type { UaProfileId } from './types';

/**
 * Persisted UA profile choice (Ticket 305). Uses `chrome.storage.local`
 * (permission already declared for session storage) — local-only, never a
 * remote sync, and holds nothing but the selected profile id and custom
 * string the user typed.
 */
export type UaProfilePreference = {
  profileId: UaProfileId;
  customUserAgent: string;
};

const STORAGE_KEY = 'uaProfilePreference';

export const DEFAULT_UA_PROFILE_PREFERENCE: UaProfilePreference = {
  profileId: 'browser-default',
  customUserAgent: '',
};

const VALID_PROFILE_IDS: readonly UaProfileId[] = ['browser-default', 'googlebot-style', 'custom'];

function isValidPreference(value: unknown): value is UaProfilePreference {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<UaProfilePreference>;
  if (typeof candidate.profileId !== 'string') return false;
  if (!VALID_PROFILE_IDS.includes(candidate.profileId as UaProfileId)) return false;
  if (typeof candidate.customUserAgent !== 'string') return false;
  if (candidate.customUserAgent.length > UA_PROFILE_LIMITS.maxCustomUaChars) return false;
  return true;
}

/** Best-effort load; falls back to the default when storage is unavailable or the value is invalid. */
export async function loadUaProfilePreference(): Promise<UaProfilePreference> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const value = stored[STORAGE_KEY];
    if (isValidPreference(value)) return value;
  } catch {
    // storage.local unavailable — panel memory still works with the default.
  }
  return { ...DEFAULT_UA_PROFILE_PREFERENCE };
}

/** Best-effort save; a failure never blocks the in-memory selection from taking effect. */
export async function saveUaProfilePreference(preference: UaProfilePreference): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: preference });
  } catch {
    // Non-fatal — the panel keeps working from in-memory state only.
  }
}
