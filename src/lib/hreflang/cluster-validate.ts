import { safeFetch } from '../network/safe-fetch';
import { SAFE_FETCH_LIMITS } from '../network/limits';
import type { RedirectHop, SafeFetchResult } from '../network/types';
import type { CaptureError, Finding } from '../schemas/audit';
import { resolveUaProfile } from '../ua-profiles/resolve-profile';
import type { UaProfileResult, UaProfileSelection } from '../ua-profiles/types';
import type { HreflangAlternateRef } from './compare-sources';
import { HREFLANG_CLUSTER_LIMITS, type HreflangClusterLimits } from './cluster-limits';
import { extractHreflangAlternatesFromHtml } from './extract-html-alternates';
import { normalizeHreflangUrl } from './normalize-url';
import { HREFLANG_SOURCE_REF } from './rules';
import { validateHreflangTag } from './validate-tag';

export const HREFLANG_CLUSTER_FETCH_SOURCE = 'extension-fetch' as const;

export type ClusterAlternateInput = {
  hreflang: string;
  href: string;
};

export type ClusterFetchError = CaptureError & {
  requestedUrl?: string;
  finalUrl?: string;
  status?: number;
  redirectHops?: RedirectHop[];
};

export type HreflangClusterMemberResult = {
  hreflang: string;
  requestedUrl: string;
  finalUrl: string | null;
  status: number | null;
  redirectHops: RedirectHop[];
  alternates: HreflangAlternateRef[] | null;
  fetched: boolean;
  fetchError: ClusterFetchError | null;
};

export type HreflangClusterTruncation = {
  totalAlternates: number;
  fetchTargets: number;
  fetchedCount: number;
  skippedCount: number;
  wallTimeExceeded: boolean;
  alternateCapHit: boolean;
};

export type HreflangClusterProgress = {
  requestId: string;
  phase: 'fetching' | 'evaluating' | 'done' | 'cancelled';
  completed: number;
  total: number;
  currentUrl?: string;
};

export type HreflangClusterValidationResult = {
  requestId: string;
  seedUrl: string;
  startedAt: string;
  endedAt: string;
  cancelled: boolean;
  limits: HreflangClusterLimits;
  truncation: HreflangClusterTruncation;
  members: HreflangClusterMemberResult[];
  findings: Finding[];
  errors: ClusterFetchError[];
  /** User-agent profile applied to every alternate fetch in this run (Ticket 305). */
  uaProfile: UaProfileResult;
  limitations: string[];
};

export type ValidateHreflangClusterInput = {
  requestId: string;
  seedUrl: string;
  alternates: readonly ClusterAlternateInput[];
  limits?: Partial<HreflangClusterLimits>;
  /** Defaults to browser-default (no header override) when omitted. */
  uaProfile?: UaProfileSelection;
  onProgress?: (progress: HreflangClusterProgress) => void;
  /** Test hook to stub safeFetch. */
  fetchImpl?: typeof safeFetch;
};

const BASE_LIMITATIONS = [
  'Hreflang cluster validation is an extension-initiated fetch experiment, not Googlebot or crawler parity.',
  'Only successfully fetched members contribute reciprocity findings; fetch failures are recorded as capture errors.',
  'Fetches omit credentials/cookies and use safe-fetch caps (timeout, bytes, redirects, concurrency).',
];

const cancelledRequests = new Set<string>();
const activeRequests = new Set<string>();
const abortControllers = new Map<string, AbortController>();

function nowIso(): string {
  return new Date().toISOString();
}

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'unknown';
}

function mergeLimits(overrides?: Partial<HreflangClusterLimits>): HreflangClusterLimits {
  return { ...HREFLANG_CLUSTER_LIMITS, ...overrides };
}

export function cancelClusterValidation(requestId?: string): boolean {
  if (requestId) {
    cancelledRequests.add(requestId);
    abortControllers.get(requestId)?.abort();
    return true;
  }
  for (const id of activeRequests) {
    cancelledRequests.add(id);
    abortControllers.get(id)?.abort();
  }
  return activeRequests.size > 0;
}

export function isClusterValidationCancelled(requestId: string): boolean {
  return cancelledRequests.has(requestId);
}

export function activeClusterValidationCount(): number {
  return activeRequests.size;
}

function clearCancellationState(requestId: string): void {
  cancelledRequests.delete(requestId);
  activeRequests.delete(requestId);
  abortControllers.delete(requestId);
}

function mapFetchFailure(
  requestedUrl: string,
  result: Extract<SafeFetchResult, { ok: false }>,
  capturedAt: string,
): ClusterFetchError {
  return {
    id: `hreflang-cluster-fetch-${slug(requestedUrl)}-${capturedAt}`,
    code: `hreflang-cluster-${result.code}`,
    source: HREFLANG_CLUSTER_FETCH_SOURCE,
    message: result.message,
    url: requestedUrl,
    capturedAt,
    requestedUrl: result.requestedUrl,
    finalUrl: result.finalUrl,
    status: result.status,
    redirectHops: result.redirectHops,
  };
}

function nonHtmlMemberError(requestedUrl: string, capturedAt: string): ClusterFetchError {
  return {
    id: `hreflang-cluster-fetch-${slug(requestedUrl)}-${capturedAt}`,
    code: 'hreflang-cluster-non-html',
    source: HREFLANG_CLUSTER_FETCH_SOURCE,
    message: 'Response was not HTML; hreflang alternates were not extracted.',
    url: requestedUrl,
    capturedAt,
  };
}

function statusFailure(
  requestedUrl: string,
  status: number,
  capturedAt: string,
  finalUrl?: string,
  redirectHops?: RedirectHop[],
): ClusterFetchError {
  return {
    id: `hreflang-cluster-fetch-${slug(requestedUrl)}-${capturedAt}`,
    code: 'hreflang-cluster-non-200',
    source: HREFLANG_CLUSTER_FETCH_SOURCE,
    message: `Alternate fetch returned HTTP ${status}.`,
    url: requestedUrl,
    capturedAt,
    requestedUrl,
    finalUrl,
    status,
    redirectHops,
  };
}

type FetchTarget = {
  hreflang: string;
  requestedUrl: string;
};

function dedupeFetchTargets(alternates: readonly ClusterAlternateInput[]): FetchTarget[] {
  const seen = new Set<string>();
  const targets: FetchTarget[] = [];
  for (const alt of alternates) {
    const href = alt.href.trim();
    if (!href) continue;
    let normalized: string;
    try {
      normalized = normalizeHreflangUrl(new URL(href).href);
    } catch {
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    targets.push({
      hreflang: alt.hreflang.toLowerCase().trim(),
      requestedUrl: href,
    });
  }
  return targets;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  shouldContinue: () => boolean,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    for (;;) {
      if (!shouldContinue()) return;
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

function isHtmlResponse(contentType: string | undefined, body: string): boolean {
  const media = contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (media === 'text/html' || media.startsWith('text/html+')) return true;
  const head = body.trimStart().slice(0, 256).toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html');
}

function evaluateFetchedClusterFindings(input: {
  capturedAt: string;
  members: readonly HreflangClusterMemberResult[];
  evidenceId: string;
}): Finding[] {
  const findings: Finding[] = [];
  const fetched = input.members.filter((member) => member.fetched && member.alternates);
  if (fetched.length === 0) return findings;

  const memberByNorm = new Map<string, HreflangClusterMemberResult>();
  for (const member of fetched) {
    if (!member.finalUrl) continue;
    memberByNorm.set(normalizeHreflangUrl(member.finalUrl), member);
  }

  for (const member of fetched) {
    const alternates = member.alternates ?? [];
    const memberNorm = member.finalUrl ? normalizeHreflangUrl(member.finalUrl) : null;
    const memberLabel = member.finalUrl ?? member.requestedUrl;

    const seenLangs = new Map<string, number>();
    for (const alt of alternates) {
      const key = alt.hreflang.toLowerCase();
      const count = (seenLangs.get(key) ?? 0) + 1;
      seenLangs.set(key, count);
      if (count === 2) {
        findings.push({
          id: `hreflang-cluster-duplicate-${slug(memberNorm ?? member.requestedUrl)}-${slug(key)}-${input.evidenceId}`,
          ruleId: 'hreflang-cluster-duplicate-alternate',
          severity: 'error',
          category: 'international',
          affectedUrl: memberLabel,
          description: `Fetched alternate ${memberLabel} declares hreflang="${key}" more than once in its return set.`,
          evidenceIds: [input.evidenceId],
          recommendation:
            'Keep exactly one alternate target per hreflang value on each cluster member.',
          sourceRef: HREFLANG_SOURCE_REF,
          capturedAt: input.capturedAt,
        });
      }

      const validation = validateHreflangTag(key);
      if (!validation.valid) {
        if (validation.typo) {
          findings.push({
            id: `hreflang-cluster-typo-${slug(memberNorm ?? member.requestedUrl)}-${slug(key)}-${input.evidenceId}`,
            ruleId: 'hreflang-cluster-likely-typo',
            severity: 'warning',
            category: 'international',
            affectedUrl: memberLabel,
            description: `Fetched alternate ${memberLabel} declares hreflang="${key}" that looks like a common typo.`,
            evidenceIds: [input.evidenceId],
            recommendation: `Consider changing hreflang="${key}" to hreflang="${validation.typo}".`,
            sourceRef: HREFLANG_SOURCE_REF,
            capturedAt: input.capturedAt,
          });
        } else {
          findings.push({
            id: `hreflang-cluster-invalid-${slug(memberNorm ?? member.requestedUrl)}-${slug(key)}-${input.evidenceId}`,
            ruleId: 'hreflang-cluster-invalid-language',
            severity: 'error',
            category: 'international',
            affectedUrl: memberLabel,
            description: `Fetched alternate ${memberLabel} declares invalid hreflang="${key}": ${validation.reason}.`,
            evidenceIds: [input.evidenceId],
            recommendation:
              'Use x-default, a valid ISO 639-1 language code, or language-region (e.g. en, en-gb, pt-br).',
            sourceRef: HREFLANG_SOURCE_REF,
            capturedAt: input.capturedAt,
          });
        }
      }
    }

    if (memberNorm) {
      const hasSelf = alternates.some(
        (alt) =>
          alt.hreflang.toLowerCase() === member.hreflang.toLowerCase() &&
          normalizeHreflangUrl(alt.href) === memberNorm,
      );
      if (!hasSelf) {
        findings.push({
          id: `hreflang-cluster-missing-self-${slug(memberNorm)}-${input.evidenceId}`,
          ruleId: 'hreflang-cluster-missing-self-ref',
          severity: 'error',
          category: 'international',
          affectedUrl: memberLabel,
          description: `Fetched alternate ${memberLabel} does not self-reference with hreflang="${member.hreflang}" in its return set.`,
          evidenceIds: [input.evidenceId],
          recommendation:
            'Each hreflang cluster member should include a self-referencing alternate link.',
          sourceRef: HREFLANG_SOURCE_REF,
          capturedAt: input.capturedAt,
        });
      }
    }

    for (const other of fetched) {
      if (other.requestedUrl === member.requestedUrl) continue;
      if (!other.finalUrl) continue;
      const otherNorm = normalizeHreflangUrl(other.finalUrl);
      const hasReturn = alternates.some(
        (alt) =>
          alt.hreflang.toLowerCase() === other.hreflang.toLowerCase() &&
          normalizeHreflangUrl(alt.href) === otherNorm,
      );
      if (!hasReturn) {
        findings.push({
          id: `hreflang-cluster-missing-return-${slug(memberNorm ?? member.requestedUrl)}-to-${slug(otherNorm)}-${input.evidenceId}`,
          ruleId: 'hreflang-cluster-missing-return',
          severity: 'error',
          category: 'international',
          affectedUrl: memberLabel,
          description: `Among fetched cluster members, ${memberLabel} does not return hreflang="${other.hreflang}" → ${other.finalUrl}.`,
          evidenceIds: [input.evidenceId],
          recommendation:
            'Each fetched cluster member should reference every other fetched member with the matching hreflang code.',
          sourceRef: HREFLANG_SOURCE_REF,
          capturedAt: input.capturedAt,
        });
      }
    }
  }

  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Opt-in hreflang cluster validation: fetch alternate targets and evaluate
 * reciprocity among successfully fetched members only.
 */
export async function validateHreflangCluster(
  input: ValidateHreflangClusterInput,
): Promise<HreflangClusterValidationResult> {
  const limits = mergeLimits(input.limits);
  const fetchFn = input.fetchImpl ?? safeFetch;
  const startedAt = nowIso();
  const startedMs = Date.now();
  const evidenceId = `hreflang-cluster-${input.requestId}`;
  const uaProfile = resolveUaProfile(input.uaProfile ?? { id: 'browser-default' });
  const allTargets = dedupeFetchTargets(input.alternates);
  const cappedTargets = allTargets.slice(0, limits.maxAlternates);
  const alternateCapHit = allTargets.length > cappedTargets.length;

  activeRequests.add(input.requestId);
  const abortController = new AbortController();
  abortControllers.set(input.requestId, abortController);

  const emitProgress = (progress: Omit<HreflangClusterProgress, 'requestId'>): void => {
    input.onProgress?.({ requestId: input.requestId, ...progress });
  };

  emitProgress({
    phase: 'fetching',
    completed: 0,
    total: cappedTargets.length,
  });

  let completed = 0;
  let wallTimeExceeded = false;

  const shouldContinue = (): boolean => {
    if (isClusterValidationCancelled(input.requestId)) {
      abortController.abort();
      return false;
    }
    if (Date.now() - startedMs > limits.maxWallTimeMs) {
      wallTimeExceeded = true;
      abortController.abort();
      return false;
    }
    return true;
  };

  const rawResults = await mapWithConcurrency(
    cappedTargets,
    SAFE_FETCH_LIMITS.maxConcurrency,
    shouldContinue,
    async (target) => {
      if (!shouldContinue()) {
        return {
          hreflang: target.hreflang,
          requestedUrl: target.requestedUrl,
          finalUrl: null,
          status: null,
          redirectHops: [],
          alternates: null,
          fetched: false,
          fetchError: null,
        } satisfies HreflangClusterMemberResult;
      }

      emitProgress({
        phase: 'fetching',
        completed,
        total: cappedTargets.length,
        currentUrl: target.requestedUrl,
      });

      const capturedAt = nowIso();
      const result = await fetchFn({
        url: target.requestedUrl,
        includeBody: true,
        expectMime: 'text/html',
        requestId: `${input.requestId}-${slug(target.requestedUrl)}`,
        signal: abortController.signal,
        ...(uaProfile.userAgent ? { userAgent: uaProfile.userAgent } : {}),
      });

      completed += 1;
      emitProgress({
        phase: 'fetching',
        completed,
        total: cappedTargets.length,
        currentUrl: target.requestedUrl,
      });

      if (!result.ok) {
        return {
          hreflang: target.hreflang,
          requestedUrl: target.requestedUrl,
          finalUrl: result.finalUrl ?? null,
          status: result.status ?? null,
          redirectHops: result.redirectHops,
          alternates: null,
          fetched: false,
          fetchError: mapFetchFailure(target.requestedUrl, result, capturedAt),
        } satisfies HreflangClusterMemberResult;
      }

      if (result.status < 200 || result.status >= 300) {
        return {
          hreflang: target.hreflang,
          requestedUrl: target.requestedUrl,
          finalUrl: result.finalUrl,
          status: result.status,
          redirectHops: result.redirectHops,
          alternates: null,
          fetched: false,
          fetchError: statusFailure(
            target.requestedUrl,
            result.status,
            capturedAt,
            result.finalUrl,
            result.redirectHops,
          ),
        } satisfies HreflangClusterMemberResult;
      }

      const body = result.bodyText ?? '';
      if (!isHtmlResponse(result.headers['content-type'], body)) {
        return {
          hreflang: target.hreflang,
          requestedUrl: target.requestedUrl,
          finalUrl: result.finalUrl,
          status: result.status,
          redirectHops: result.redirectHops,
          alternates: null,
          fetched: false,
          fetchError: nonHtmlMemberError(target.requestedUrl, capturedAt),
        } satisfies HreflangClusterMemberResult;
      }

      const alternates = extractHreflangAlternatesFromHtml(body, result.finalUrl);
      return {
        hreflang: target.hreflang,
        requestedUrl: target.requestedUrl,
        finalUrl: result.finalUrl,
        status: result.status,
        redirectHops: result.redirectHops,
        alternates,
        fetched: true,
        fetchError: null,
      } satisfies HreflangClusterMemberResult;
    },
  );

  const memberResults = rawResults.map((result, index) => {
    const target = cappedTargets[index]!;
    return (
      result ?? {
        hreflang: target.hreflang,
        requestedUrl: target.requestedUrl,
        finalUrl: null,
        status: null,
        redirectHops: [],
        alternates: null,
        fetched: false,
        fetchError: null,
      }
    );
  });

  const cancelled = isClusterValidationCancelled(input.requestId);
  const endedAt = nowIso();

  emitProgress({
    phase: cancelled ? 'cancelled' : 'evaluating',
    completed,
    total: cappedTargets.length,
  });

  const errors = memberResults
    .map((member) => member.fetchError)
    .filter((error): error is ClusterFetchError => error != null);

  const findings = evaluateFetchedClusterFindings({
    capturedAt: endedAt,
    members: memberResults,
    evidenceId,
  });

  emitProgress({
    phase: cancelled ? 'cancelled' : 'done',
    completed,
    total: cappedTargets.length,
  });

  clearCancellationState(input.requestId);

  const fetchedCount = memberResults.filter((member) => member.fetched).length;
  const limitations = [...BASE_LIMITATIONS];
  if (alternateCapHit) {
    limitations.push(
      `Alternate list truncated to ${limits.maxAlternates} fetch targets (${allTargets.length} declared).`,
    );
  }
  if (wallTimeExceeded) {
    limitations.push(
      `Cluster validation stopped after the ${limits.maxWallTimeMs}ms wall-time budget.`,
    );
  }
  if (cancelled) {
    limitations.push('Validation was cancelled before all targets were fetched.');
  }

  return {
    requestId: input.requestId,
    seedUrl: input.seedUrl,
    startedAt,
    endedAt,
    cancelled,
    limits,
    truncation: {
      totalAlternates: input.alternates.length,
      fetchTargets: allTargets.length,
      fetchedCount,
      skippedCount: cappedTargets.length - completed,
      wallTimeExceeded,
      alternateCapHit,
    },
    members: memberResults,
    findings,
    errors,
    uaProfile,
    limitations,
  };
}

/** Reset cancellation/active tracking — test helper only. */
export function resetClusterValidationState(): void {
  cancelledRequests.clear();
  activeRequests.clear();
  abortControllers.clear();
}
