import { SAFE_FETCH_HEADER_ALLOWLIST, type SafeFetchHeaderName } from './limits';
import { clipHeaderValue, clipUrl } from './headers';
import type { RedirectHop } from './types';
import {
  attachNavigationObserver,
  createNavigationObserverState,
  getNavigationObservation,
  recordBrowserNavigation,
  type NavigationObserverState,
} from './navigation-observation';
import type { NavigationObservationStatus } from './types';

/** Minimal webRequest-shaped events for pure processing + tests. */
export type MainFrameHeadersReceived = {
  tabId: number;
  requestId: string;
  url: string;
  statusCode: number;
  responseHeaders?: { name: string; value?: string }[];
  type: string;
};

export type MainFrameBeforeRedirect = {
  tabId: number;
  requestId: string;
  url: string;
  redirectUrl: string;
  statusCode: number;
  type: string;
};

export type MainFrameCompleted = {
  tabId: number;
  requestId: string;
  url: string;
  statusCode: number;
  type: string;
};

export type MainFrameError = {
  tabId: number;
  requestId: string;
  url: string;
  error: string;
  type: string;
};

export type PendingNavigation = {
  requestId: string;
  tabId: number;
  requestedUrl: string;
  currentUrl: string;
  statusCode: number | null;
  redirectHops: RedirectHop[];
  headers: Partial<Record<SafeFetchHeaderName, string>>;
  /** Duplicate header values joined for allowlisted names. */
  headerDuplicates: Partial<Record<SafeFetchHeaderName, string[]>>;
  error?: string;
};

export type NavigationCaptureController = {
  state: NavigationObserverState;
  pending: Map<number, PendingNavigation>;
  watchTab: (tabId: number) => void;
  unwatchTab: (tabId: number) => void;
  getObservation: (tabId: number, requestedUrl?: string) => NavigationObservationStatus;
  onHeadersReceived: (details: MainFrameHeadersReceived) => void;
  onBeforeRedirect: (details: MainFrameBeforeRedirect) => void;
  onCompleted: (details: MainFrameCompleted) => void;
  onErrorOccurred: (details: MainFrameError) => void;
};

function isMainFrame(type: string): boolean {
  return type === 'main_frame';
}

function collectHeaders(responseHeaders: { name: string; value?: string }[] | undefined): {
  headers: Partial<Record<SafeFetchHeaderName, string>>;
  headerDuplicates: Partial<Record<SafeFetchHeaderName, string[]>>;
} {
  const buckets = new Map<SafeFetchHeaderName, string[]>();
  for (const header of responseHeaders ?? []) {
    const name = header.name.toLowerCase() as SafeFetchHeaderName;
    if (!(SAFE_FETCH_HEADER_ALLOWLIST as readonly string[]).includes(name)) continue;
    const value = clipHeaderValue(header.value ?? '');
    const list = buckets.get(name) ?? [];
    list.push(value);
    buckets.set(name, list);
  }
  const headers: Partial<Record<SafeFetchHeaderName, string>> = {};
  const headerDuplicates: Partial<Record<SafeFetchHeaderName, string[]>> = {};
  for (const [name, values] of buckets) {
    headers[name] = values.join(', ');
    if (values.length > 1) headerDuplicates[name] = values;
  }
  return { headers, headerDuplicates };
}

function ensurePending(
  pending: Map<number, PendingNavigation>,
  tabId: number,
  requestId: string,
  url: string,
): PendingNavigation {
  const existing = pending.get(tabId);
  if (existing && existing.requestId === requestId) return existing;
  const created: PendingNavigation = {
    requestId,
    tabId,
    requestedUrl: clipUrl(url),
    currentUrl: clipUrl(url),
    statusCode: null,
    redirectHops: [],
    headers: {},
    headerDuplicates: {},
  };
  pending.set(tabId, created);
  return created;
}

/**
 * Pure main-frame navigation capture for Ticket 201.
 * Only records `browser-navigation` evidence when the tab was watched before
 * the navigation started (via watchTab → attachNavigationObserver).
 */
export function createNavigationCaptureController(): NavigationCaptureController {
  const state = createNavigationObserverState();
  const pending = new Map<number, PendingNavigation>();

  return {
    state,
    pending,
    watchTab(tabId: number): void {
      attachNavigationObserver(state, tabId);
    },
    unwatchTab(tabId: number): void {
      state.attachedTabIds.delete(tabId);
      state.observations.delete(tabId);
      pending.delete(tabId);
    },
    getObservation(tabId: number, requestedUrl?: string): NavigationObservationStatus {
      return getNavigationObservation(state, { tabId, requestedUrl });
    },
    onHeadersReceived(details: MainFrameHeadersReceived): void {
      if (!isMainFrame(details.type) || details.tabId < 0) return;
      if (!state.attachedTabIds.has(details.tabId)) return;
      const entry = ensurePending(pending, details.tabId, details.requestId, details.url);
      entry.currentUrl = clipUrl(details.url);
      entry.statusCode = details.statusCode;
      const picked = collectHeaders(details.responseHeaders);
      entry.headers = { ...entry.headers, ...picked.headers };
      for (const [name, values] of Object.entries(picked.headerDuplicates) as [
        SafeFetchHeaderName,
        string[],
      ][]) {
        const prior = entry.headerDuplicates[name] ?? [];
        entry.headerDuplicates[name] = [...prior, ...values];
      }
    },
    onBeforeRedirect(details: MainFrameBeforeRedirect): void {
      if (!isMainFrame(details.type) || details.tabId < 0) return;
      if (!state.attachedTabIds.has(details.tabId)) return;
      const entry = ensurePending(pending, details.tabId, details.requestId, details.url);
      entry.redirectHops.push({
        fromUrl: clipUrl(details.url),
        toUrl: clipUrl(details.redirectUrl),
        status: details.statusCode,
      });
      entry.currentUrl = clipUrl(details.redirectUrl);
      entry.statusCode = details.statusCode;
    },
    onCompleted(details: MainFrameCompleted): void {
      if (!isMainFrame(details.type) || details.tabId < 0) return;
      if (!state.attachedTabIds.has(details.tabId)) return;
      const entry = pending.get(details.tabId);
      if (!entry || entry.requestId !== details.requestId) {
        // Completed without prior headers — still record what we can.
        ensurePending(pending, details.tabId, details.requestId, details.url);
      }
      const finalEntry = pending.get(details.tabId)!;
      finalEntry.currentUrl = clipUrl(details.url);
      finalEntry.statusCode = details.statusCode;
      try {
        recordBrowserNavigation(state, {
          status: 'observed',
          source: 'browser-navigation',
          tabId: details.tabId,
          requestedUrl: finalEntry.requestedUrl,
          finalUrl: finalEntry.currentUrl,
          statusCode: finalEntry.statusCode ?? details.statusCode,
          redirectHops: finalEntry.redirectHops,
          headers: finalEntry.headers,
          observedAt: new Date().toISOString(),
        });
      } catch {
        // Not attached — ignore (race with unwatch).
      }
      pending.delete(details.tabId);
    },
    onErrorOccurred(details: MainFrameError): void {
      if (!isMainFrame(details.type) || details.tabId < 0) return;
      if (!state.attachedTabIds.has(details.tabId)) return;
      pending.delete(details.tabId);
      // Leave observation empty so getObservation reports unavailable / not yet observed.
    },
  };
}
