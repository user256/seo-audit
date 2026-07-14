import {
  collectDomFactsInPage,
  DEFAULT_DOM_COLLECT_LIMITS,
  type DomFacts,
} from '../content/dom-collector';
import { domFactsToPageSnapshot } from '../content/dom-facts-to-snapshot';
import { navigationCapture } from '../background/navigation-listeners';
import { buildCrawlNetworkEvidence } from './crawl/build-crawl-evidence';
import { fetchRobotsForOrigin, type RobotsFetchResult } from './robots/fetch-robots';
import { discoverSitemapCandidates } from './sitemap/discover';
import { fetchSitemap, type SitemapFetchResult } from './sitemap/fetch-sitemap';
import { evaluatePageSnapshot, type PageSummary } from './rules/engine';
import { availabilityFromEvidence, resolveAuditCheckSelection } from './rules/check-selection';
import type {
  AuditCheckSelection,
  AuditSession,
  CaptureError,
  Evidence,
  Finding,
  PageSnapshot,
} from './schemas/audit';
import { parseDomFacts } from './schemas/dom-evidence';
import {
  boundDomFactUrls,
  DEFAULT_DOM_COLLECT_LIMITS as SCHEMA_LIMITS,
  DOM_LIMITS,
} from './schemas/dom-limits';
import { createEmptySession, SessionRepository } from './storage/session-repository';
import { getActiveTabSnapshot } from './tab-access';
import { clipUrl } from './network/headers';

export type CollectDomResult =
  | {
      ok: true;
      sessionId: string;
      snapshot: PageSnapshot;
      evidenceCount: number;
      findings: Finding[];
      summary: PageSummary;
      captureErrors: CaptureError[];
      checkSelection: AuditCheckSelection;
      /** Robots capture used during this audit (for Crawl signals hydration). */
      robotsResult: RobotsFetchResult | null;
      /** Sitemap capture used during this audit (for Crawl signals hydration). */
      sitemapResult: SitemapFetchResult | null;
    }
  | { ok: false; error: string; captureError?: CaptureError };

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sameDocumentUrl(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.href === right.href;
  } catch {
    return a === b;
  }
}

function enforceSnapshotBudget(snapshot: PageSnapshot): {
  snapshot: PageSnapshot;
  truncated: boolean;
} {
  const encoded = JSON.stringify(snapshot);
  if (encoded.length <= DOM_LIMITS.maxSnapshotChars) {
    return { snapshot, truncated: false };
  }

  const evidence = snapshot.evidence.map((item) => {
    if (item.source !== 'script[type=application/ld+json]') return item;
    const field = item.value as {
      state?: string;
      value?: { raw?: string; truncated?: boolean; parseStatus?: string }[];
      limits?: unknown;
    };
    if (!field || field.state !== 'present' || !Array.isArray(field.value)) return item;
    return {
      ...item,
      value: {
        ...field,
        value: field.value.map((entry) => ({
          ...entry,
          raw: '',
          truncated: true,
          parseStatus: 'truncated',
          parseDetail: 'Snapshot byte budget exceeded; JSON-LD raw text dropped',
        })),
        limits: {
          truncated: true as const,
          reason: `Snapshot clipped to ${DOM_LIMITS.maxSnapshotChars} characters`,
        },
      },
    };
  });

  const next: PageSnapshot = {
    ...snapshot,
    evidence: [
      ...evidence.filter((e) => e.source !== 'capture.limits'),
      {
        id: 'limits-budget-0',
        kind: 'dom',
        source: 'capture.limits',
        value: {
          truncated: true as const,
          fields: [
            {
              source: 'page-snapshot',
              reason: `Snapshot clipped to ${DOM_LIMITS.maxSnapshotChars} characters`,
            },
          ],
        },
        capturedAt: snapshot.capturedAt,
      },
    ],
  };
  return { snapshot: next, truncated: true };
}

export async function collectDomForActiveTab(
  repo: SessionRepository = new SessionRepository(),
  selectedCheckIds?: ReadonlySet<string>,
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

  const urlBefore = tab.url;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.tabId },
      func: collectDomFactsInPage,
      args: [DEFAULT_DOM_COLLECT_LIMITS],
    });

    const tabAfter = await getActiveTabSnapshot();
    if (tabAfter.status === 'ready' && !sameDocumentUrl(urlBefore, tabAfter.url)) {
      const captureError: CaptureError = {
        id: newId('cerr'),
        code: 'navigation-race',
        source: 'domCollector',
        message: `Active tab navigated during DOM collection (before: ${urlBefore}; after: ${tabAfter.url}).`,
        url: tabAfter.url,
        capturedAt: new Date().toISOString(),
      };
      return { ok: false, error: captureError.message, captureError };
    }

    const rawFacts = results[0]?.result as DomFacts | undefined | null;
    if (rawFacts == null) {
      const captureError: CaptureError = {
        id: newId('cerr'),
        code: 'collector-empty-result',
        source: 'domCollector',
        message:
          'DOM collector returned no result (injection failed or threw in the page). Reload the extension and retry.',
        url: urlBefore,
        capturedAt: new Date().toISOString(),
      };
      return { ok: false, error: captureError.message, captureError };
    }

    // Navigation-race identity uses exact browser URLs before URL bounding, but
    // only when the collector returned URL fields. Otherwise fall through to
    // schema validation (`dom-evidence-invalid`).
    if (
      typeof rawFacts.documentUrl === 'string' &&
      !sameDocumentUrl(urlBefore, rawFacts.documentUrl)
    ) {
      const captureError: CaptureError = {
        id: newId('cerr'),
        code: 'navigation-race',
        source: 'domCollector',
        message: `Captured document URL diverged from the active tab (tab: ${urlBefore}; document: ${rawFacts.documentUrl}).`,
        url: rawFacts.documentUrl,
        capturedAt:
          typeof rawFacts.collectedAt === 'string'
            ? rawFacts.collectedAt
            : new Date().toISOString(),
      };
      return { ok: false, error: captureError.message, captureError };
    }

    const boundedUrls =
      typeof rawFacts.documentUrl === 'string' && typeof rawFacts.baseUri === 'string'
        ? boundDomFactUrls(rawFacts, SCHEMA_LIMITS.maxUrlChars)
        : undefined;
    const factsForParse: unknown = boundedUrls
      ? {
          ...rawFacts,
          documentUrl: boundedUrls.documentUrl,
          baseUri: boundedUrls.baseUri,
        }
      : rawFacts;
    const parsed = parseDomFacts(factsForParse);
    if (!parsed.ok) {
      const captureError: CaptureError = {
        id: newId('cerr'),
        code: 'dom-evidence-invalid',
        source: 'domCollector',
        message: `${parsed.error} ${parsed.issues.join('; ')}`,
        url: urlBefore,
        capturedAt: new Date().toISOString(),
      };
      return { ok: false, error: captureError.message, captureError };
    }

    const facts = parsed.value as DomFacts;
    const captureErrors: CaptureError[] = [];
    let snapshot = domFactsToPageSnapshot(
      facts,
      newId('snap'),
      SCHEMA_LIMITS,
      boundedUrls?.urlBounds,
    );
    const budget = enforceSnapshotBudget(snapshot);
    snapshot = budget.snapshot;
    if (budget.truncated) {
      captureErrors.push({
        id: newId('cerr'),
        code: 'snapshot-budget',
        source: 'domCollector',
        message: `Page snapshot exceeded ${DOM_LIMITS.maxSnapshotChars} characters; oversized evidence was clipped.`,
        url: facts.documentUrl,
        capturedAt: facts.collectedAt,
      });
    }

    navigationCapture.watchTab(tab.tabId);
    const navigation = navigationCapture.getObservation(tab.tabId, clipUrl(urlBefore));
    const networkEvidence: Evidence[] = [];
    if (navigation.status === 'observed') {
      networkEvidence.push({
        id: newId('ev'),
        kind: 'network',
        source: 'browser-navigation',
        value: {
          statusCode: navigation.statusCode,
          requestedUrl: navigation.requestedUrl,
          finalUrl: navigation.finalUrl,
          redirectHops: navigation.redirectHops,
          headers: navigation.headers,
          observedAt: navigation.observedAt,
        },
        capturedAt: navigation.observedAt,
      });
    } else {
      captureErrors.push({
        id: newId('cerr'),
        code: navigation.code,
        source: 'headerCapture',
        message: `${navigation.message} Use Capture navigation (reload) before auditing if headers are required.`,
        url: urlBefore,
        capturedAt: new Date().toISOString(),
      });
    }

    let robotsFetch: boolean | 'unavailable' = 'unavailable';
    let robotsResult: RobotsFetchResult | null = null;
    let sitemapResult: SitemapFetchResult | null = null;
    try {
      const origin = new URL(urlBefore).origin;
      const robots = await fetchRobotsForOrigin(origin);
      robotsResult = robots;
      if (robots.ok) {
        robotsFetch = true;
        networkEvidence.push(
          ...buildCrawlNetworkEvidence({
            auditedUrl: urlBefore,
            robots,
            capturedAt: robots.fetchedAt,
          }),
        );

        try {
          const candidates = discoverSitemapCandidates({
            origin,
            robotsSitemaps: robots.parsed.sitemaps,
          });
          if (candidates.length > 0) {
            const sitemap = await fetchSitemap(candidates.map((c) => c.url));
            sitemapResult = sitemap;
            if (sitemap.ok) {
              networkEvidence.push(
                ...buildCrawlNetworkEvidence({
                  auditedUrl: urlBefore,
                  sitemap,
                  capturedAt: new Date().toISOString(),
                }),
              );
            } else {
              captureErrors.push({
                id: newId('cerr'),
                code: sitemap.error.code,
                source: 'sitemapFetch',
                message: sitemap.error.message,
                url: sitemap.error.url ?? urlBefore,
                capturedAt: sitemap.error.capturedAt,
              });
            }
          }
        } catch (err) {
          captureErrors.push({
            id: newId('cerr'),
            code: 'sitemap-fetch-failed',
            source: 'sitemapFetch',
            message: err instanceof Error ? err.message : String(err),
            url: urlBefore,
            capturedAt: new Date().toISOString(),
          });
        }
      } else {
        captureErrors.push({
          id: newId('cerr'),
          code: robots.error.code,
          source: 'robotsFetch',
          message: robots.error.message,
          url: robots.error.url ?? urlBefore,
          capturedAt: new Date().toISOString(),
        });
        try {
          const candidates = discoverSitemapCandidates({ origin });
          if (candidates.length > 0) {
            const sitemap = await fetchSitemap(candidates.map((c) => c.url));
            sitemapResult = sitemap;
            if (sitemap.ok) {
              networkEvidence.push(
                ...buildCrawlNetworkEvidence({
                  auditedUrl: urlBefore,
                  sitemap,
                  capturedAt: new Date().toISOString(),
                }),
              );
            } else {
              captureErrors.push({
                id: newId('cerr'),
                code: sitemap.error.code,
                source: 'sitemapFetch',
                message: sitemap.error.message,
                url: sitemap.error.url ?? urlBefore,
                capturedAt: sitemap.error.capturedAt,
              });
            }
          }
        } catch (err) {
          captureErrors.push({
            id: newId('cerr'),
            code: 'sitemap-fetch-failed',
            source: 'sitemapFetch',
            message: err instanceof Error ? err.message : String(err),
            url: urlBefore,
            capturedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      captureErrors.push({
        id: newId('cerr'),
        code: 'robots-fetch-failed',
        source: 'robotsFetch',
        message: err instanceof Error ? err.message : String(err),
        url: urlBefore,
        capturedAt: new Date().toISOString(),
      });
    }

    if (networkEvidence.length > 0) {
      snapshot = {
        ...snapshot,
        evidence: [...snapshot.evidence, ...networkEvidence],
      };
    }

    const extensionVersion = chrome.runtime.getManifest().version;
    const featureAvailability = {
      domCollector: true as const,
      headerCapture: (navigation.status === 'observed' ? true : 'unavailable') as
        | true
        | 'unavailable',
      robotsFetch,
    };
    const checkSelection = resolveAuditCheckSelection({
      requestedCheckIds: selectedCheckIds,
      availability: availabilityFromEvidence(true, snapshot.evidence),
    });
    const { findings, summary } = evaluatePageSnapshot(snapshot, {
      featureAvailability,
      captureErrors,
      checkIds: new Set(checkSelection.selectedCheckIds),
    });
    const session: AuditSession = createEmptySession({
      id: newId('sess'),
      tabUrl: urlBefore,
      finalUrl: facts.documentUrl || urlBefore,
      extensionVersion,
      featureAvailability,
      captureTime: facts.collectedAt,
    });
    session.snapshots = [snapshot];
    session.findings = findings;
    session.captureErrors = captureErrors;
    session.checkSelection = checkSelection;

    const encoded = JSON.stringify(session);
    if (encoded.length > DOM_LIMITS.maxSessionChars) {
      const captureError: CaptureError = {
        id: newId('cerr'),
        code: 'session-budget',
        source: 'domCollector',
        message: `Audit session exceeded ${DOM_LIMITS.maxSessionChars} characters after bounding; refusing to save.`,
        url: facts.documentUrl,
        capturedAt: facts.collectedAt,
      };
      return { ok: false, error: captureError.message, captureError };
    }

    const saved = await repo.save(session);
    return {
      ok: true,
      sessionId: saved.id,
      snapshot,
      evidenceCount: snapshot.evidence.length,
      findings,
      summary,
      captureErrors,
      checkSelection: saved.checkSelection,
      robotsResult,
      sitemapResult,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const captureError: CaptureError = {
      id: newId('cerr'),
      code: 'collector-failed',
      source: 'domCollector',
      message,
      url: urlBefore,
      capturedAt: new Date().toISOString(),
    };
    return { ok: false, error: message, captureError };
  }
}
