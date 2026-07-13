import {
  collectDomFactsInPage,
  DEFAULT_DOM_COLLECT_LIMITS,
  type DomFacts,
} from '../../content/dom-collector';
import { parseDomFacts } from '../schemas/dom-evidence';
import { boundDomFactUrls, DOM_LIMITS } from '../schemas/dom-limits';
import { getActiveTabSnapshot } from '../tab-access';

export type GlanceInventoryResult =
  | { ok: true; facts: DomFacts; tabUrl: string }
  | { ok: false; error: string; code: string };

/**
 * Lightweight DOM inventory for the SEO dashboard. Does not save a session or
 * run findings — Start audit remains the deep test + persist path.
 */
export async function glanceDomInventoryForActiveTab(): Promise<GlanceInventoryResult> {
  const tab = await getActiveTabSnapshot();
  if (tab.status === 'missing' || tab.status === 'unsupported') {
    return { ok: false, error: tab.reason, code: 'unsupported' };
  }
  if (!tab.granted) {
    return {
      ok: false,
      error: 'Origin access was not granted for the active tab.',
      code: 'permission-denied',
    };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.tabId },
      func: collectDomFactsInPage,
      args: [DEFAULT_DOM_COLLECT_LIMITS],
    });
    const raw = results[0]?.result as DomFacts | undefined | null;
    if (raw == null) {
      return {
        ok: false,
        error: 'DOM inventory returned no result. Reload the extension and retry.',
        code: 'collector-empty-result',
      };
    }
    const boundedUrls = boundDomFactUrls(raw, DOM_LIMITS.maxUrlChars);
    const parsed = parseDomFacts({
      ...raw,
      documentUrl: boundedUrls.documentUrl,
      baseUri: boundedUrls.baseUri,
    });
    if (!parsed.ok) {
      return {
        ok: false,
        error: `${parsed.error} ${parsed.issues.join('; ')}`,
        code: 'dom-evidence-invalid',
      };
    }
    return { ok: true, facts: parsed.value as DomFacts, tabUrl: tab.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, code: 'collector-failed' };
  }
}
