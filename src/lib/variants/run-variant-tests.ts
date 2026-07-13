import { safeFetch } from '../network/safe-fetch';
import { SAFE_FETCH_LIMITS } from '../network/limits';
import type { SafeFetchResult } from '../network/types';
import { resolveUaProfile } from '../ua-profiles/resolve-profile';
import type { UaProfileSelection } from '../ua-profiles/types';
import {
  buildVariantObservations,
  canonicalFromLinkHeader,
  groupVariantFinals,
} from './compare-finals';
import { generateVariants } from './generate-variants';
import { VARIANT_TEST_LIMITS, type VariantTestLimits } from './limits';
import type {
  VariantKindOptions,
  VariantTestProgress,
  VariantTestRow,
  VariantTestRunResult,
} from './types';

export type RunVariantTestsInput = {
  requestId: string;
  baseUrl: string;
  kindOptions: VariantKindOptions;
  method?: 'HEAD' | 'GET';
  limits?: Partial<VariantTestLimits>;
  /** Defaults to browser-default (no header override) when omitted. */
  uaProfile?: UaProfileSelection;
  onProgress?: (progress: VariantTestProgress) => void;
  /** Test hook to stub safeFetch. */
  fetchImpl?: typeof safeFetch;
};

const BASE_LIMITATIONS = [
  'URL variant tests are extension-initiated fetches, not browser navigation or crawler parity.',
  'Fetches omit credentials/cookies and use safe-fetch caps (timeout, redirects, concurrency).',
  'Observations describe inconsistent final URLs; they do not assume a preferred host.',
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

function mergeLimits(overrides?: Partial<VariantTestLimits>): VariantTestLimits {
  return { ...VARIANT_TEST_LIMITS, ...overrides };
}

export function cancelVariantTests(requestId?: string): boolean {
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

export function isVariantTestsCancelled(requestId: string): boolean {
  return cancelledRequests.has(requestId);
}

export function activeVariantTestCount(): number {
  return activeRequests.size;
}

function clearCancellationState(requestId: string): void {
  cancelledRequests.delete(requestId);
  activeRequests.delete(requestId);
  abortControllers.delete(requestId);
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

function mapFetchRow(
  variant: { url: string; kind: VariantTestRow['kind']; label: string },
  result: SafeFetchResult,
  skipped: boolean,
): VariantTestRow {
  if (!result.ok) {
    return {
      kind: variant.kind,
      label: variant.label,
      requestUrl: variant.url,
      finalUrl: result.finalUrl ?? null,
      status: result.status ?? null,
      redirectHops: result.redirectHops,
      elapsedMs: result.timing.durationMs,
      contentType: null,
      canonicalUrl: null,
      error: { code: result.code, message: result.message },
      skipped,
    };
  }

  const contentType = result.headers['content-type'] ?? null;
  const canonicalUrl = canonicalFromLinkHeader(result.headers.link);

  return {
    kind: variant.kind,
    label: variant.label,
    requestUrl: variant.url,
    finalUrl: result.finalUrl,
    status: result.status,
    redirectHops: result.redirectHops,
    elapsedMs: result.timing.durationMs,
    contentType,
    canonicalUrl,
    error: null,
    skipped,
  };
}

/**
 * Run bounded redirect tests for user-approved URL variants.
 */
export async function runVariantTests(input: RunVariantTestsInput): Promise<VariantTestRunResult> {
  const limits = mergeLimits(input.limits);
  const fetchFn = input.fetchImpl ?? safeFetch;
  const method = input.method ?? 'HEAD';
  const startedAt = nowIso();
  const startedMs = Date.now();
  const uaProfile = resolveUaProfile(input.uaProfile ?? { id: 'browser-default' });

  const generated = generateVariants(input.baseUrl, input.kindOptions);
  if (!generated.ok) {
    return {
      requestId: input.requestId,
      baseUrl: input.baseUrl,
      startedAt,
      endedAt: nowIso(),
      cancelled: false,
      limits,
      kindOptions: input.kindOptions,
      method,
      results: [],
      finalGroups: [],
      observations: [],
      uaProfile,
      limitations: [...BASE_LIMITATIONS, generated.message],
      truncation: {
        totalGenerated: 0,
        fetchTargets: 0,
        completedCount: 0,
        variantCapHit: false,
        wallTimeExceeded: false,
      },
    };
  }

  const allVariants = generated.variants;
  const targets = allVariants.slice(0, limits.maxVariants);
  const variantCapHit = allVariants.length > targets.length;

  activeRequests.add(input.requestId);
  const abortController = new AbortController();
  abortControllers.set(input.requestId, abortController);

  const emitProgress = (progress: Omit<VariantTestProgress, 'requestId'>): void => {
    input.onProgress?.({ requestId: input.requestId, ...progress });
  };

  emitProgress({ phase: 'fetching', completed: 0, total: targets.length });

  let completed = 0;
  let wallTimeExceeded = false;

  const shouldContinue = (): boolean => {
    if (isVariantTestsCancelled(input.requestId)) {
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
    targets,
    SAFE_FETCH_LIMITS.maxConcurrency,
    shouldContinue,
    async (variant) => {
      if (!shouldContinue()) {
        return {
          kind: variant.kind,
          label: variant.label,
          requestUrl: variant.url,
          finalUrl: null,
          status: null,
          redirectHops: [],
          elapsedMs: 0,
          contentType: null,
          canonicalUrl: null,
          error: null,
          skipped: true,
        } satisfies VariantTestRow;
      }

      emitProgress({
        phase: 'fetching',
        completed,
        total: targets.length,
        currentUrl: variant.url,
      });

      const result = await fetchFn({
        url: variant.url,
        method,
        requestId: `${input.requestId}-${slug(variant.url)}`,
        signal: abortController.signal,
        ...(uaProfile.userAgent ? { userAgent: uaProfile.userAgent } : {}),
      });

      completed += 1;
      emitProgress({
        phase: 'fetching',
        completed,
        total: targets.length,
        currentUrl: variant.url,
      });

      const skipped = !shouldContinue() && result.ok === false && result.code === 'aborted';
      return mapFetchRow(variant, result, skipped);
    },
  );

  const results = targets.map((variant, index) => {
    const row = rawResults[index];
    return (
      row ?? {
        kind: variant.kind,
        label: variant.label,
        requestUrl: variant.url,
        finalUrl: null,
        status: null,
        redirectHops: [],
        elapsedMs: 0,
        contentType: null,
        canonicalUrl: null,
        error: null,
        skipped: true,
      }
    );
  });

  const cancelled = isVariantTestsCancelled(input.requestId);

  emitProgress({
    phase: cancelled ? 'cancelled' : 'comparing',
    completed,
    total: targets.length,
  });

  const finalGroups = groupVariantFinals(results);
  const observations = buildVariantObservations(results, finalGroups);
  const endedAt = nowIso();

  emitProgress({
    phase: cancelled ? 'cancelled' : 'done',
    completed,
    total: targets.length,
  });

  clearCancellationState(input.requestId);

  const limitations = [...BASE_LIMITATIONS];
  if (variantCapHit) {
    limitations.push(
      `Variant list truncated to ${limits.maxVariants} fetch targets (${allVariants.length} generated).`,
    );
  }
  if (wallTimeExceeded) {
    limitations.push(`Run stopped after the ${limits.maxWallTimeMs}ms wall-time budget.`);
  }
  if (cancelled) {
    limitations.push('Variant tests were cancelled before all targets were fetched.');
  }

  return {
    requestId: input.requestId,
    baseUrl: generated.baseUrl,
    startedAt,
    endedAt,
    cancelled,
    limits,
    kindOptions: input.kindOptions,
    method,
    results,
    finalGroups,
    observations,
    uaProfile,
    limitations,
    truncation: {
      totalGenerated: allVariants.length,
      fetchTargets: targets.length,
      completedCount: completed,
      variantCapHit,
      wallTimeExceeded,
    },
  };
}

/** Reset cancellation/active tracking — test helper only. */
export function resetVariantTestState(): void {
  cancelledRequests.clear();
  activeRequests.clear();
  abortControllers.clear();
}
