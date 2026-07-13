import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SafeFetchResult } from '../network/types';
import {
  AUDITED_PRODUCT,
  PROBE_DISTINCT_VALID,
  PROBE_ERROR_TEMPLATE,
  PROBE_IDENTICAL_TEMPLATE,
} from './fixtures/html';
import { cancelSoft404Probe, resetSoft404ProbeState, runSoft404Probe } from './run-soft-404-probe';

const ORIGIN = 'https://shop.example';
const AUDITED_URL = `${ORIGIN}/products/widget`;
const PROBE_URL = `${ORIGIN}/seo-audit-probe-missing`;

function okFetch(
  url: string,
  body: string | null,
  overrides: Partial<Extract<SafeFetchResult, { ok: true }>> = {},
): Extract<SafeFetchResult, { ok: true }> {
  const text = body ?? '';
  return {
    ok: true,
    source: 'extension-fetch',
    requestId: `mock-${url}`,
    method: 'GET',
    requestedUrl: url,
    finalUrl: overrides.finalUrl ?? url,
    status: overrides.status ?? 200,
    redirectHops: overrides.redirectHops ?? [],
    headers: { 'content-type': 'text/html; charset=utf-8' },
    timing: {
      startedAt: '2026-07-13T12:00:00.000Z',
      endedAt: '2026-07-13T12:00:01.000Z',
      durationMs: 1,
    },
    truncated: false,
    bodyByteLength: text.length,
    mimeMatched: true,
    limitations: [],
    bodyText: text,
    ...overrides,
  };
}

describe('runSoft404Probe', () => {
  beforeEach(() => {
    resetSoft404ProbeState();
  });

  afterEach(() => {
    resetSoft404ProbeState();
    vi.useRealTimers();
  });

  it('records captures and flags a possible soft 404 for identical templates', async () => {
    const fetchImpl = vi.fn(async ({ url }: { url: string }) => {
      if (url === PROBE_URL) return okFetch(url, PROBE_IDENTICAL_TEMPLATE);
      if (url === AUDITED_URL) return okFetch(url, AUDITED_PRODUCT);
      throw new Error(`unexpected url ${url}`);
    });

    const result = await runSoft404Probe({
      requestId: 'soft-404-identical',
      auditedUrl: AUDITED_URL,
      probeUrl: PROBE_URL,
      fetchImpl,
    });

    expect(result.cancelled).toBe(false);
    expect(result.probe.status).toBe(200);
    expect(result.audited.title).toBe('Blue Widget');
    expect(result.probe.bodyHash).toBe(result.audited.bodyHash);
    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.observations[0]?.ruleId).toBe('soft-404-possible');
    expect(result.limitations.some((line) => line.includes('heuristic'))).toBe(true);
  });

  it('returns no observations for true 404 probe responses', async () => {
    const fetchImpl = vi.fn(async ({ url }: { url: string }) => {
      if (url === PROBE_URL) return okFetch(url, null, { status: 404 });
      if (url === AUDITED_URL) return okFetch(url, AUDITED_PRODUCT);
      throw new Error(`unexpected url ${url}`);
    });

    const result = await runSoft404Probe({
      requestId: 'soft-404-true-404',
      auditedUrl: AUDITED_URL,
      probeUrl: PROBE_URL,
      fetchImpl,
    });

    expect(result.probe.status).toBe(404);
    expect(result.observations).toEqual([]);
  });

  it('returns no observations for distinct valid probe content', async () => {
    const fetchImpl = vi.fn(async ({ url }: { url: string }) => {
      if (url === PROBE_URL) return okFetch(url, PROBE_DISTINCT_VALID);
      if (url === AUDITED_URL) return okFetch(url, AUDITED_PRODUCT);
      throw new Error(`unexpected url ${url}`);
    });

    const result = await runSoft404Probe({
      requestId: 'soft-404-distinct',
      auditedUrl: AUDITED_URL,
      probeUrl: PROBE_URL,
      fetchImpl,
    });

    expect(result.observations).toEqual([]);
  });

  it('flags error-template probes with HTTP 200', async () => {
    const fetchImpl = vi.fn(async ({ url }: { url: string }) => {
      if (url === PROBE_URL) return okFetch(url, PROBE_ERROR_TEMPLATE);
      if (url === AUDITED_URL) return okFetch(url, AUDITED_PRODUCT);
      throw new Error(`unexpected url ${url}`);
    });

    const result = await runSoft404Probe({
      requestId: 'soft-404-error-template',
      auditedUrl: AUDITED_URL,
      probeUrl: PROBE_URL,
      fetchImpl,
    });

    expect(result.observations.some((item) => item.kind === 'error-template-title')).toBe(true);
  });

  it('rejects cross-origin probe URLs before fetching', async () => {
    const fetchImpl = vi.fn();
    const result = await runSoft404Probe({
      requestId: 'soft-404-cross-origin',
      auditedUrl: AUDITED_URL,
      probeUrl: 'https://other.example/seo-audit-probe-x',
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.observations).toEqual([]);
    expect(result.limitations.some((line) => line.includes('origin'))).toBe(true);
  });

  it('supports cancellation while fetches are in flight', async () => {
    const fetchImpl = vi.fn(
      ({ url, signal }: { url: string; signal?: AbortSignal }) =>
        new Promise<SafeFetchResult>((resolve) => {
          const fail = (): void => {
            resolve({
              ok: false,
              source: 'extension-fetch',
              requestId: `mock-${url}`,
              method: 'GET',
              requestedUrl: url,
              redirectHops: [],
              timing: {
                startedAt: '2026-07-13T12:00:00.000Z',
                endedAt: '2026-07-13T12:00:01.000Z',
                durationMs: 1,
              },
              code: 'aborted',
              message: 'Fetch was cancelled.',
              truncated: false,
              limitations: [],
            });
          };
          if (signal?.aborted) {
            fail();
            return;
          }
          signal?.addEventListener('abort', fail, { once: true });
        }),
    );

    const run = runSoft404Probe({
      requestId: 'soft-404-cancel',
      auditedUrl: AUDITED_URL,
      probeUrl: PROBE_URL,
      fetchImpl,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(cancelSoft404Probe('soft-404-cancel')).toBe(true);

    const result = await run;
    expect(result.cancelled).toBe(true);
    expect(result.limitations.some((line) => line.includes('cancelled'))).toBe(true);
  });
});
