import { safeFetch } from '../network/safe-fetch';
import { resolveUaProfile } from '../ua-profiles/resolve-profile';
import type { UaProfileSelection } from '../ua-profiles/types';
import { evaluateSoft404Heuristics } from './evaluate-probe';
import { validateProbeUrl } from './generate-probe-url';
import { mapFetchToPageCapture } from './map-capture';
import { SOFT_404_PROBE_LIMITS, type Soft404ProbeLimits } from './limits';
import type { Soft404ProbeProgress, Soft404ProbeResult } from './types';

export type RunSoft404ProbeInput = {
  requestId: string;
  auditedUrl: string;
  probeUrl: string;
  limits?: Partial<Soft404ProbeLimits>;
  /** Defaults to browser-default (no header override) when omitted. */
  uaProfile?: UaProfileSelection;
  onProgress?: (progress: Soft404ProbeProgress) => void;
  /** Test hook to stub safeFetch. */
  fetchImpl?: typeof safeFetch;
};

const BASE_LIMITATIONS = [
  'Soft-404 probe is an extension-initiated fetch experiment, not Googlebot or search-engine soft-404 parity.',
  'Observations are heuristic comparisons only — never definitive server-error classifications.',
  'Fetches omit credentials/cookies and use safe-fetch caps (timeout, bytes, redirects, concurrency).',
  'Only one probe URL is requested per user action.',
];

const cancelledRequests = new Set<string>();
const activeRequests = new Set<string>();
const abortControllers = new Map<string, AbortController>();

function nowIso(): string {
  return new Date().toISOString();
}

function mergeLimits(overrides?: Partial<Soft404ProbeLimits>): Soft404ProbeLimits {
  return { ...SOFT_404_PROBE_LIMITS, ...overrides };
}

export function cancelSoft404Probe(requestId?: string): boolean {
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

export function isSoft404ProbeCancelled(requestId: string): boolean {
  return cancelledRequests.has(requestId);
}

export function activeSoft404ProbeCount(): number {
  return activeRequests.size;
}

function clearCancellationState(requestId: string): void {
  cancelledRequests.delete(requestId);
  activeRequests.delete(requestId);
  abortControllers.delete(requestId);
}

function emptyCapture(
  role: 'probe' | 'audited',
  requestedUrl: string,
): Soft404ProbeResult['probe'] {
  return {
    role,
    requestedUrl,
    finalUrl: null,
    status: null,
    contentType: null,
    title: null,
    bodyByteLength: 0,
    bodyHash: null,
    fingerprint: null,
    redirectHops: [],
    elapsedMs: 0,
    fetchError: null,
    skipped: true,
  };
}

/**
 * Run a user-approved soft-404 comparison: fetch probe + audited URLs, then
 * evaluate conservative heuristics.
 */
export async function runSoft404Probe(input: RunSoft404ProbeInput): Promise<Soft404ProbeResult> {
  const limits = mergeLimits(input.limits);
  const fetchFn = input.fetchImpl ?? safeFetch;
  const startedAt = nowIso();
  const startedMs = Date.now();
  const uaProfile = resolveUaProfile(input.uaProfile ?? { id: 'browser-default' });

  const validated = validateProbeUrl(input.auditedUrl, input.probeUrl);
  if (!validated.ok) {
    return {
      requestId: input.requestId,
      auditedUrl: input.auditedUrl,
      probeUrl: input.probeUrl,
      origin: '',
      startedAt,
      endedAt: nowIso(),
      cancelled: false,
      limits,
      probe: emptyCapture('probe', input.probeUrl),
      audited: emptyCapture('audited', input.auditedUrl),
      observations: [],
      uaProfile,
      limitations: [...BASE_LIMITATIONS, validated.message],
    };
  }

  activeRequests.add(input.requestId);
  const abortController = new AbortController();
  abortControllers.set(input.requestId, abortController);

  const emitProgress = (progress: Omit<Soft404ProbeProgress, 'requestId'>): void => {
    input.onProgress?.({ requestId: input.requestId, ...progress });
  };

  const shouldContinue = (): boolean => {
    if (isSoft404ProbeCancelled(input.requestId)) {
      abortController.abort();
      return false;
    }
    if (Date.now() - startedMs > limits.maxWallTimeMs) {
      abortController.abort();
      return false;
    }
    return true;
  };

  emitProgress({ phase: 'fetching-probe', currentUrl: validated.probeUrl });

  let probeCapture = emptyCapture('probe', validated.probeUrl);
  if (shouldContinue()) {
    const probeFetch = await fetchFn({
      url: validated.probeUrl,
      includeBody: true,
      signal: abortController.signal,
      requestId: `${input.requestId}-probe`,
      ...(uaProfile.userAgent ? { userAgent: uaProfile.userAgent } : {}),
    });
    const skipped = !shouldContinue() && !probeFetch.ok && probeFetch.code === 'aborted';
    probeCapture = mapFetchToPageCapture({
      role: 'probe',
      requestedUrl: validated.probeUrl,
      result: probeFetch,
      skipped,
    });
  }

  emitProgress({ phase: 'fetching-audited', currentUrl: input.auditedUrl });

  let auditedCapture = emptyCapture('audited', input.auditedUrl);
  if (shouldContinue()) {
    const auditedFetch = await fetchFn({
      url: input.auditedUrl,
      includeBody: true,
      signal: abortController.signal,
      requestId: `${input.requestId}-audited`,
      ...(uaProfile.userAgent ? { userAgent: uaProfile.userAgent } : {}),
    });
    const skipped = !shouldContinue() && !auditedFetch.ok && auditedFetch.code === 'aborted';
    auditedCapture = mapFetchToPageCapture({
      role: 'audited',
      requestedUrl: input.auditedUrl,
      result: auditedFetch,
      skipped,
    });
  }

  const cancelled = isSoft404ProbeCancelled(input.requestId);
  const wallTimeExceeded = Date.now() - startedMs > limits.maxWallTimeMs;

  emitProgress({ phase: cancelled ? 'cancelled' : 'evaluating' });

  const observations =
    cancelled || probeCapture.fetchError || auditedCapture.fetchError
      ? []
      : evaluateSoft404Heuristics({
          origin: validated.origin,
          probe: probeCapture,
          audited: auditedCapture,
        });

  emitProgress({ phase: cancelled ? 'cancelled' : 'done' });

  clearCancellationState(input.requestId);

  const limitations = [...BASE_LIMITATIONS];
  if (wallTimeExceeded) {
    limitations.push(`Run stopped after the ${limits.maxWallTimeMs}ms wall-time budget.`);
  }
  if (cancelled) {
    limitations.push('Soft-404 probe was cancelled before both fetches completed.');
  }
  if (probeCapture.fetchError) {
    limitations.push(`Probe fetch failed: ${probeCapture.fetchError.message}`);
  }
  if (auditedCapture.fetchError) {
    limitations.push(`Audited page fetch failed: ${auditedCapture.fetchError.message}`);
  }

  return {
    requestId: input.requestId,
    auditedUrl: input.auditedUrl,
    probeUrl: validated.probeUrl,
    origin: validated.origin,
    startedAt,
    endedAt: nowIso(),
    cancelled,
    limits,
    probe: probeCapture,
    audited: auditedCapture,
    observations,
    uaProfile,
    limitations,
  };
}

/** Reset cancellation/active tracking — test helper only. */
export function resetSoft404ProbeState(): void {
  cancelledRequests.clear();
  activeRequests.clear();
  abortControllers.clear();
}
