import { collectDomForActiveTab, type CollectDomResult } from '../lib/collect-dom';
import {
  glanceDomInventoryForActiveTab,
  type GlanceInventoryResult,
} from '../lib/dashboard/glance';
import {
  cancelClusterValidation,
  validateHreflangCluster,
  type ClusterAlternateInput,
  type HreflangClusterProgress,
  type HreflangClusterValidationResult,
} from '../lib/hreflang/cluster-validate';
import type { NavigationObservationStatus } from '../lib/network/types';
import { fetchRobotsForOrigin, type RobotsFetchResult } from '../lib/robots/fetch-robots';
import type { AuditSession } from '../lib/schemas/audit';
import { fetchSitemap, type SitemapFetchResult } from '../lib/sitemap/fetch-sitemap';
import { SessionRepository } from '../lib/storage/session-repository';
import { getActiveTabSnapshot, pingActiveTab, type ActiveTabSnapshot } from '../lib/tab-access';
import { navigationCapture } from './navigation-listeners';

const repo = new SessionRepository();

export type ExtensionRequest =
  | { type: 'GET_ACTIVE_TAB_SNAPSHOT' }
  | { type: 'PING_ACTIVE_TAB'; tabId: number }
  | { type: 'GLANCE_DOM_INVENTORY' }
  | { type: 'COLLECT_DOM_SNAPSHOT'; selectedCheckIds?: string[] }
  | { type: 'LOAD_SESSION'; sessionId: string }
  | { type: 'FIND_LATEST_SESSION_FOR_URL'; url: string }
  | { type: 'SAVE_REPORT_MARKDOWN'; sessionId: string; markdown: string }
  | { type: 'WATCH_TAB_NAVIGATION'; tabId: number }
  | { type: 'GET_NAVIGATION_OBSERVATION'; tabId: number; requestedUrl?: string }
  | { type: 'RELOAD_AND_OBSERVE_NAVIGATION'; tabId: number }
  | { type: 'FETCH_ROBOTS_FOR_ORIGIN'; origin: string; bypassCache?: boolean }
  | { type: 'FETCH_SITEMAP'; rootUrls: string[] }
  | {
      type: 'VALIDATE_HREFLANG_CLUSTER';
      requestId: string;
      seedUrl: string;
      alternates: ClusterAlternateInput[];
    }
  | { type: 'CANCEL_HREFLANG_CLUSTER'; requestId?: string };

export type ExtensionResponse =
  | { type: 'ACTIVE_TAB_SNAPSHOT'; snapshot: ActiveTabSnapshot }
  | {
      type: 'PING_RESULT';
      result: Awaited<ReturnType<typeof pingActiveTab>>;
    }
  | { type: 'GLANCE_DOM_RESULT'; result: GlanceInventoryResult }
  | { type: 'COLLECT_DOM_RESULT'; result: CollectDomResult }
  | {
      type: 'SESSION_LOADED';
      result:
        | { status: 'ok'; session: AuditSession }
        | { status: 'missing'; id: string }
        | { status: 'quarantined'; reason: string };
    }
  | {
      type: 'LATEST_SESSION_FOR_URL';
      result: { status: 'ok'; session: AuditSession } | { status: 'none' };
    }
  | { type: 'REPORT_SAVED'; sessionId: string }
  | { type: 'NAVIGATION_WATCHING'; tabId: number }
  | { type: 'NAVIGATION_OBSERVATION'; observation: NavigationObservationStatus }
  | { type: 'ROBOTS_FETCH_RESULT'; result: RobotsFetchResult }
  | { type: 'SITEMAP_FETCH_RESULT'; result: SitemapFetchResult }
  | { type: 'HREFLANG_CLUSTER_RESULT'; result: HreflangClusterValidationResult }
  | { type: 'HREFLANG_CLUSTER_CANCELLED'; requestId?: string; cancelled: boolean }
  | { type: 'ERROR'; message: string };

/** Broadcast from the service worker while cluster validation runs. */
export type HreflangClusterProgressMessage = {
  type: 'HREFLANG_CLUSTER_PROGRESS';
  progress: HreflangClusterProgress;
};

function broadcastClusterProgress(progress: HreflangClusterProgress): void {
  const message: HreflangClusterProgressMessage = {
    type: 'HREFLANG_CLUSTER_PROGRESS',
    progress,
  };
  void chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may be closed; progress is best-effort.
  });
}

async function reloadAndObserve(tabId: number): Promise<NavigationObservationStatus> {
  navigationCapture.watchTab(tabId);
  const before = navigationCapture.getObservation(tabId);
  const beforeKey = before.status === 'observed' ? `${before.finalUrl}|${before.observedAt}` : null;

  await chrome.tabs.reload(tabId);

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
    const observation = navigationCapture.getObservation(tabId);
    if (observation.status === 'observed') {
      const key = `${observation.finalUrl}|${observation.observedAt}`;
      if (key !== beforeKey) return observation;
    }
  }
  return navigationCapture.getObservation(tabId);
}

export async function handleExtensionRequest(
  message: ExtensionRequest,
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GET_ACTIVE_TAB_SNAPSHOT':
      return {
        type: 'ACTIVE_TAB_SNAPSHOT',
        snapshot: await getActiveTabSnapshot(),
      };
    case 'PING_ACTIVE_TAB':
      return {
        type: 'PING_RESULT',
        result: await pingActiveTab(message.tabId),
      };
    case 'GLANCE_DOM_INVENTORY':
      return {
        type: 'GLANCE_DOM_RESULT',
        result: await glanceDomInventoryForActiveTab(),
      };
    case 'COLLECT_DOM_SNAPSHOT':
      return {
        type: 'COLLECT_DOM_RESULT',
        result: await collectDomForActiveTab(
          repo,
          message.selectedCheckIds ? new Set(message.selectedCheckIds) : undefined,
        ),
      };
    case 'LOAD_SESSION': {
      const loaded = await repo.get(message.sessionId);
      if (loaded.status === 'ok') {
        return { type: 'SESSION_LOADED', result: { status: 'ok', session: loaded.session } };
      }
      if (loaded.status === 'missing') {
        return { type: 'SESSION_LOADED', result: { status: 'missing', id: loaded.id } };
      }
      return {
        type: 'SESSION_LOADED',
        result: { status: 'quarantined', reason: loaded.record.reason },
      };
    }
    case 'FIND_LATEST_SESSION_FOR_URL': {
      const found = await repo.findLatestForUrl(message.url);
      if (found.status === 'ok') {
        return { type: 'LATEST_SESSION_FOR_URL', result: { status: 'ok', session: found.session } };
      }
      return { type: 'LATEST_SESSION_FOR_URL', result: { status: 'none' } };
    }
    case 'SAVE_REPORT_MARKDOWN': {
      const loaded = await repo.get(message.sessionId);
      if (loaded.status !== 'ok') {
        return {
          type: 'ERROR',
          message:
            loaded.status === 'missing'
              ? `Session ${message.sessionId} was not found.`
              : `Session ${message.sessionId} is quarantined and cannot be edited.`,
        };
      }
      loaded.session.reportMarkdown = message.markdown;
      await repo.save(loaded.session);
      return { type: 'REPORT_SAVED', sessionId: message.sessionId };
    }
    case 'WATCH_TAB_NAVIGATION': {
      navigationCapture.watchTab(message.tabId);
      return { type: 'NAVIGATION_WATCHING', tabId: message.tabId };
    }
    case 'GET_NAVIGATION_OBSERVATION':
      return {
        type: 'NAVIGATION_OBSERVATION',
        observation: navigationCapture.getObservation(message.tabId, message.requestedUrl),
      };
    case 'RELOAD_AND_OBSERVE_NAVIGATION':
      return {
        type: 'NAVIGATION_OBSERVATION',
        observation: await reloadAndObserve(message.tabId),
      };
    case 'FETCH_ROBOTS_FOR_ORIGIN':
      return {
        type: 'ROBOTS_FETCH_RESULT',
        result: await fetchRobotsForOrigin(message.origin, {
          bypassCache: message.bypassCache,
        }),
      };
    case 'FETCH_SITEMAP':
      return {
        type: 'SITEMAP_FETCH_RESULT',
        result: await fetchSitemap(message.rootUrls),
      };
    case 'VALIDATE_HREFLANG_CLUSTER':
      return {
        type: 'HREFLANG_CLUSTER_RESULT',
        result: await validateHreflangCluster({
          requestId: message.requestId,
          seedUrl: message.seedUrl,
          alternates: message.alternates,
          onProgress: broadcastClusterProgress,
        }),
      };
    case 'CANCEL_HREFLANG_CLUSTER':
      return {
        type: 'HREFLANG_CLUSTER_CANCELLED',
        requestId: message.requestId,
        cancelled: cancelClusterValidation(message.requestId),
      };
    default: {
      const _exhaustive: never = message;
      return { type: 'ERROR', message: `Unhandled message: ${JSON.stringify(_exhaustive)}` };
    }
  }
}
