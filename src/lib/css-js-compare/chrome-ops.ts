import {
  disableCssInPage,
  type CssDisableInjectionResult,
} from '../../content/css-disable-injection';
import { collectDomFactsInPage, type DomFacts } from '../../content/dom-collector';
import {
  collectVisibleTextFingerprintInPage,
  type VisibleTextFingerprint,
} from '../../content/visible-text-fingerprint';
import { DEFAULT_DOM_COLLECT_LIMITS } from '../schemas/dom-limits';
import type { CssJsCompareChromeOps } from './types';

/**
 * Real chrome.tabs / chrome.scripting implementation (Ticket 303). Kept
 * separate from the runner so tests can inject a fake CssJsCompareChromeOps
 * without touching the global `chrome` object.
 */
export const defaultCssJsCompareChromeOps: CssJsCompareChromeOps = {
  async captureDomFacts(tabId: number): Promise<DomFacts | null> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: collectDomFactsInPage,
        args: [DEFAULT_DOM_COLLECT_LIMITS],
      });
      return (results[0]?.result as DomFacts | undefined) ?? null;
    } catch {
      return null;
    }
  },

  async captureVisibleText(
    tabId: number,
    maxChars: number,
  ): Promise<VisibleTextFingerprint | null> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: collectVisibleTextFingerprintInPage,
        args: [maxChars],
      });
      return (results[0]?.result as VisibleTextFingerprint | undefined) ?? null;
    } catch {
      return null;
    }
  },

  async createTab(url: string): Promise<number> {
    const tab = await chrome.tabs.create({ url, active: false });
    if (!tab.id) {
      throw new Error('chrome.tabs.create did not return a tab id.');
    }
    return tab.id;
  },

  async waitForTabLoad(tabId: number, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const finish = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(ok);
      };

      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo): void => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') finish(true);
      };

      const timer = setTimeout(() => finish(false), timeoutMs);
      chrome.tabs.onUpdated.addListener(listener);

      // The tab may already be complete by the time the listener attaches.
      chrome.tabs
        .get(tabId)
        .then((tab) => {
          if (tab.status === 'complete') finish(true);
        })
        .catch(() => {
          // Tab may have been closed already — waitForTabLoad simply times out.
        });
    });
  },

  async disableCss(tabId: number): Promise<CssDisableInjectionResult | null> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: disableCssInPage,
      });
      return (results[0]?.result as CssDisableInjectionResult | undefined) ?? null;
    } catch {
      return null;
    }
  },

  async closeTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      // Tab may already be closed (e.g. by the user) — cleanup is best-effort.
    }
  },
};
