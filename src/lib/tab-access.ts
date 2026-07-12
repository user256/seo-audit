import { evaluateUrl } from './origins';

export type ActiveTabSnapshot =
  | {
      status: 'ready';
      tabId: number;
      url: string;
      origin: string;
      pattern: string;
      granted: boolean;
    }
  | {
      status: 'unsupported';
      tabId?: number;
      url?: string;
      reason: string;
    }
  | {
      status: 'missing';
      reason: string;
    };

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

export async function hasOriginAccess(pattern: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [pattern] });
}

export async function requestOriginAccess(pattern: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [pattern] });
}

/**
 * Snapshot of the active tab plus whether optional host access is granted.
 * Never requests permission — callers must use requestOriginAccess on user action.
 */
export async function getActiveTabSnapshot(): Promise<ActiveTabSnapshot> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return {
      status: 'missing',
      reason: 'No active tab was found. Focus a browser tab and try again.',
    };
  }

  const eligibility = evaluateUrl(tab.url);
  if (!eligibility.ok) {
    return {
      status: 'unsupported',
      tabId: tab.id,
      url: eligibility.url,
      reason: eligibility.reason,
    };
  }

  const granted = await hasOriginAccess(eligibility.pattern);
  return {
    status: 'ready',
    tabId: tab.id,
    url: eligibility.url,
    origin: eligibility.origin,
    pattern: eligibility.pattern,
    granted,
  };
}

/**
 * Injects a no-op content script and awaits a round-trip response.
 * Requires prior origin access (or activeTab); returns a structured error otherwise.
 */
export async function pingActiveTab(
  tabId: number,
): Promise<{ ok: true; pong: true; href: string } | { ok: false; error: string }> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      // Inline: executeScript funcs cannot close over imports.
      func: () => ({ pong: true as const, href: location.href }),
    });
    const first = results[0]?.result as { pong?: boolean; href?: string } | undefined;
    if (!first?.pong) {
      return { ok: false, error: 'Content script did not respond to ping.' };
    }
    return { ok: true, pong: true, href: first.href ?? '' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
