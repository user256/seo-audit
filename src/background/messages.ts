import { collectDomForActiveTab, type CollectDomResult } from '../lib/collect-dom';
import {
  cancelCssJsComparison,
  runCssJsComparison,
  type CssJsComparisonProgress,
  type CssJsComparisonResult,
} from '../lib/css-js-compare';
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
import type { UaProfileSelection } from '../lib/ua-profiles/types';
import type { AuditSession } from '../lib/schemas/audit';
import {
  fetchSitemap,
  serializeSitemapFetchResult,
  type SitemapFetchResult,
} from '../lib/sitemap/fetch-sitemap';
import { SessionRepository } from '../lib/storage/session-repository';
import { getActiveTabSnapshot, pingActiveTab, type ActiveTabSnapshot } from '../lib/tab-access';
import {
  cancelSoft404Probe,
  runSoft404Probe,
  type Soft404ProbeProgress,
  type Soft404ProbeResult,
} from '../lib/soft-404';
import {
  cancelVariantTests,
  runVariantTests,
  type VariantKindOptions,
  type VariantTestProgress,
  type VariantTestRunResult,
} from '../lib/variants';
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
  | {
      type: 'SAVE_VARIANT_TEST_RUN';
      sessionId: string;
      result: VariantTestRunResult;
    }
  | {
      type: 'SAVE_SOFT_404_PROBE_RUN';
      sessionId: string;
      result: Soft404ProbeResult;
    }
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
      uaProfile?: UaProfileSelection;
    }
  | { type: 'CANCEL_HREFLANG_CLUSTER'; requestId?: string }
  | {
      type: 'RUN_URL_VARIANT_TESTS';
      requestId: string;
      baseUrl: string;
      kindOptions: VariantKindOptions;
      method?: 'HEAD' | 'GET';
      uaProfile?: UaProfileSelection;
    }
  | { type: 'CANCEL_URL_VARIANT_TESTS'; requestId?: string }
  | {
      type: 'RUN_SOFT_404_PROBE';
      requestId: string;
      auditedUrl: string;
      probeUrl: string;
      uaProfile?: UaProfileSelection;
    }
  | { type: 'CANCEL_SOFT_404_PROBE'; requestId?: string }
  | {
      type: 'RUN_CSS_JS_COMPARISON';
      requestId: string;
      activeTabId: number;
      auditedUrl: string;
    }
  | { type: 'CANCEL_CSS_JS_COMPARISON'; requestId?: string };

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
  | { type: 'VARIANT_TEST_RUN_SAVED'; sessionId: string }
  | { type: 'SOFT_404_PROBE_RUN_SAVED'; sessionId: string }
  | { type: 'NAVIGATION_WATCHING'; tabId: number }
  | { type: 'NAVIGATION_OBSERVATION'; observation: NavigationObservationStatus }
  | { type: 'ROBOTS_FETCH_RESULT'; result: RobotsFetchResult }
  | { type: 'SITEMAP_FETCH_RESULT'; result: SitemapFetchResult }
  | { type: 'HREFLANG_CLUSTER_RESULT'; result: HreflangClusterValidationResult }
  | { type: 'HREFLANG_CLUSTER_CANCELLED'; requestId?: string; cancelled: boolean }
  | { type: 'URL_VARIANT_TESTS_RESULT'; result: VariantTestRunResult }
  | { type: 'URL_VARIANT_TESTS_CANCELLED'; requestId?: string; cancelled: boolean }
  | { type: 'SOFT_404_PROBE_RESULT'; result: Soft404ProbeResult }
  | { type: 'SOFT_404_PROBE_CANCELLED'; requestId?: string; cancelled: boolean }
  | { type: 'CSS_JS_COMPARISON_RESULT'; result: CssJsComparisonResult }
  | { type: 'CSS_JS_COMPARISON_CANCELLED'; requestId?: string; cancelled: boolean }
  | { type: 'ERROR'; message: string };

/** Broadcast from the service worker while cluster validation runs. */
export type HreflangClusterProgressMessage = {
  type: 'HREFLANG_CLUSTER_PROGRESS';
  progress: HreflangClusterProgress;
};

/** Broadcast from the service worker while URL variant tests run. */
export type UrlVariantTestsProgressMessage = {
  type: 'URL_VARIANT_TESTS_PROGRESS';
  progress: VariantTestProgress;
};

/** Broadcast from the service worker while a soft-404 probe runs. */
export type Soft404ProbeProgressMessage = {
  type: 'SOFT_404_PROBE_PROGRESS';
  progress: Soft404ProbeProgress;
};

/** Broadcast from the service worker while a CSS/JS comparison runs. */
export type CssJsComparisonProgressMessage = {
  type: 'CSS_JS_COMPARISON_PROGRESS';
  progress: CssJsComparisonProgress;
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

function broadcastVariantTestProgress(progress: VariantTestProgress): void {
  const message: UrlVariantTestsProgressMessage = {
    type: 'URL_VARIANT_TESTS_PROGRESS',
    progress,
  };
  void chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may be closed; progress is best-effort.
  });
}

function broadcastSoft404ProbeProgress(progress: Soft404ProbeProgress): void {
  const message: Soft404ProbeProgressMessage = {
    type: 'SOFT_404_PROBE_PROGRESS',
    progress,
  };
  void chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may be closed; progress is best-effort.
  });
}

function broadcastCssJsComparisonProgress(progress: CssJsComparisonProgress): void {
  const message: CssJsComparisonProgressMessage = {
    type: 'CSS_JS_COMPARISON_PROGRESS',
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
    case 'COLLECT_DOM_SNAPSHOT': {
      const collected = await collectDomForActiveTab(
        repo,
        message.selectedCheckIds ? new Set(message.selectedCheckIds) : undefined,
      );
      if (collected.ok && collected.sitemapResult) {
        return {
          type: 'COLLECT_DOM_RESULT',
          result: {
            ...collected,
            sitemapResult: serializeSitemapFetchResult(collected.sitemapResult),
          },
        };
      }
      return { type: 'COLLECT_DOM_RESULT', result: collected };
    }
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
    case 'SAVE_VARIANT_TEST_RUN': {
      try {
        await repo.saveVariantTestRun(message.sessionId, message.result);
        return { type: 'VARIANT_TEST_RUN_SAVED', sessionId: message.sessionId };
      } catch (error) {
        return {
          type: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to save variant test run.',
        };
      }
    }
    case 'SAVE_SOFT_404_PROBE_RUN': {
      try {
        await repo.saveSoft404ProbeRun(message.sessionId, message.result);
        return { type: 'SOFT_404_PROBE_RUN_SAVED', sessionId: message.sessionId };
      } catch (error) {
        return {
          type: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to save soft-404 probe run.',
        };
      }
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
        result: serializeSitemapFetchResult(await fetchSitemap(message.rootUrls)),
      };
    case 'VALIDATE_HREFLANG_CLUSTER':
      return {
        type: 'HREFLANG_CLUSTER_RESULT',
        result: await validateHreflangCluster({
          requestId: message.requestId,
          seedUrl: message.seedUrl,
          alternates: message.alternates,
          uaProfile: message.uaProfile,
          onProgress: broadcastClusterProgress,
        }),
      };
    case 'CANCEL_HREFLANG_CLUSTER':
      return {
        type: 'HREFLANG_CLUSTER_CANCELLED',
        requestId: message.requestId,
        cancelled: cancelClusterValidation(message.requestId),
      };
    case 'RUN_URL_VARIANT_TESTS':
      return {
        type: 'URL_VARIANT_TESTS_RESULT',
        result: await runVariantTests({
          requestId: message.requestId,
          baseUrl: message.baseUrl,
          kindOptions: message.kindOptions,
          method: message.method,
          uaProfile: message.uaProfile,
          onProgress: broadcastVariantTestProgress,
        }),
      };
    case 'CANCEL_URL_VARIANT_TESTS':
      return {
        type: 'URL_VARIANT_TESTS_CANCELLED',
        requestId: message.requestId,
        cancelled: cancelVariantTests(message.requestId),
      };
    case 'RUN_SOFT_404_PROBE':
      return {
        type: 'SOFT_404_PROBE_RESULT',
        result: await runSoft404Probe({
          requestId: message.requestId,
          auditedUrl: message.auditedUrl,
          probeUrl: message.probeUrl,
          uaProfile: message.uaProfile,
          onProgress: broadcastSoft404ProbeProgress,
        }),
      };
    case 'CANCEL_SOFT_404_PROBE':
      return {
        type: 'SOFT_404_PROBE_CANCELLED',
        requestId: message.requestId,
        cancelled: cancelSoft404Probe(message.requestId),
      };
    case 'RUN_CSS_JS_COMPARISON':
      return {
        type: 'CSS_JS_COMPARISON_RESULT',
        result: await runCssJsComparison({
          requestId: message.requestId,
          activeTabId: message.activeTabId,
          auditedUrl: message.auditedUrl,
          onProgress: broadcastCssJsComparisonProgress,
        }),
      };
    case 'CANCEL_CSS_JS_COMPARISON':
      return {
        type: 'CSS_JS_COMPARISON_CANCELLED',
        requestId: message.requestId,
        cancelled: cancelCssJsComparison(message.requestId),
      };
    default: {
      const _exhaustive: never = message;
      return { type: 'ERROR', message: `Unhandled message: ${JSON.stringify(_exhaustive)}` };
    }
  }
}
