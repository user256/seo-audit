import {
  collectDomFactsInPage,
  DEFAULT_MAX_JSON_LD_CHARS,
  type DomFacts,
} from '../content/dom-collector';
import { domFactsToPageSnapshot } from '../content/dom-facts-to-snapshot';
import type { AuditSession, CaptureError, PageSnapshot } from './schemas/audit';
import { createEmptySession, SessionRepository } from './storage/session-repository';
import { getActiveTabSnapshot } from './tab-access';

export type CollectDomResult =
  | {
      ok: true;
      sessionId: string;
      snapshot: PageSnapshot;
      evidenceCount: number;
    }
  | { ok: false; error: string; captureError?: CaptureError };

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function collectDomForActiveTab(
  repo: SessionRepository = new SessionRepository(),
): Promise<CollectDomResult> {
  const tab = await getActiveTabSnapshot();
  if (tab.status === 'missing' || tab.status === 'unsupported') {
    return { ok: false, error: tab.reason };
  }
  if (!tab.granted) {
    const captureError: CaptureError = {
      id: newId('cerr'),
      code: 'permission-denied',
      source: 'domCollector',
      message: 'Origin access was not granted for the active tab.',
      url: tab.url,
      capturedAt: new Date().toISOString(),
    };
    return {
      ok: false,
      error: captureError.message,
      captureError,
    };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.tabId },
      func: collectDomFactsInPage,
      args: [DEFAULT_MAX_JSON_LD_CHARS],
    });
    const facts = results[0]?.result as DomFacts | undefined;
    if (!facts || typeof facts !== 'object' || !('documentUrl' in facts)) {
      return { ok: false, error: 'DOM collector returned no facts.' };
    }

    const snapshot = domFactsToPageSnapshot(facts, newId('snap'));
    const extensionVersion = chrome.runtime.getManifest().version;
    const session: AuditSession = createEmptySession({
      id: newId('sess'),
      tabUrl: tab.url,
      finalUrl: facts.documentUrl || tab.url,
      extensionVersion,
      featureAvailability: {
        domCollector: true,
        headerCapture: 'unavailable',
        robotsFetch: 'unavailable',
      },
      captureTime: facts.collectedAt,
    });
    session.snapshots = [snapshot];

    const saved = await repo.save(session);
    return {
      ok: true,
      sessionId: saved.id,
      snapshot,
      evidenceCount: snapshot.evidence.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const captureError: CaptureError = {
      id: newId('cerr'),
      code: 'collector-failed',
      source: 'domCollector',
      message,
      url: tab.url,
      capturedAt: new Date().toISOString(),
    };
    return { ok: false, error: message, captureError };
  }
}
