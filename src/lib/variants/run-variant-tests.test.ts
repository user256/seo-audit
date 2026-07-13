import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SafeFetchResult } from '../network/types';
import { cancelVariantTests, resetVariantTestState, runVariantTests } from './run-variant-tests';
import { DEFAULT_VARIANT_KIND_OPTIONS } from './types';

function okFetch(
  url: string,
  overrides: Partial<Extract<SafeFetchResult, { ok: true }>> = {},
): Extract<SafeFetchResult, { ok: true }> {
  return {
    ok: true,
    source: 'extension-fetch',
    requestId: 'mock',
    method: 'HEAD',
    requestedUrl: url,
    finalUrl: overrides.finalUrl ?? url,
    status: overrides.status ?? 200,
    redirectHops: overrides.redirectHops ?? [],
    headers: overrides.headers ?? { 'content-type': 'text/html' },
    timing: {
      startedAt: '2026-07-13T12:00:00.000Z',
      endedAt: '2026-07-13T12:00:00.100Z',
      durationMs: 100,
    },
    truncated: false,
    bodyByteLength: 0,
    mimeMatched: null,
    limitations: [],
    ...overrides,
  };
}

function errFetch(
  url: string,
  overrides: Partial<Extract<SafeFetchResult, { ok: false }>> = {},
): Extract<SafeFetchResult, { ok: false }> {
  return {
    ok: false,
    source: 'extension-fetch',
    requestId: 'mock',
    method: 'HEAD',
    requestedUrl: url,
    redirectHops: [],
    timing: {
      startedAt: '2026-07-13T12:00:00.000Z',
      endedAt: '2026-07-13T12:00:00.100Z',
      durationMs: 100,
    },
    code: 'network-error',
    message: 'network failed',
    truncated: false,
    limitations: [],
    ...overrides,
  };
}

describe('runVariantTests', () => {
  beforeEach(() => {
    resetVariantTestState();
  });

  afterEach(() => {
    resetVariantTestState();
    vi.useRealTimers();
  });

  it('records redirect loops as fetch errors', async () => {
    const fetchImpl = vi.fn(async (request: { url: string }) =>
      errFetch(request.url, {
        code: 'redirect-limit',
        message: 'Redirect limit exceeded',
        finalUrl: `${request.url}?loop=1`,
        redirectHops: [
          { fromUrl: request.url, toUrl: `${request.url}?loop=1`, status: 301 },
          { fromUrl: `${request.url}?loop=1`, toUrl: request.url, status: 301 },
        ],
      }),
    );

    const result = await runVariantTests({
      requestId: 'loop-test',
      baseUrl: 'https://loop.example/',
      kindOptions: {
        scheme: false,
        www: false,
        trailingSlash: false,
        case: false,
        indexFilenames: false,
      },
      fetchImpl,
    });

    expect(result.results[0]?.error?.code).toBe('redirect-limit');
    expect(result.results[0]?.redirectHops).toHaveLength(2);
  });

  it('records cross-origin redirect hops and finals', async () => {
    const fetchImpl = vi.fn(async (request: { url: string }) => {
      if (request.url.startsWith('http://')) {
        return okFetch(request.url, {
          finalUrl: 'https://other.example/landing',
          redirectHops: [
            {
              fromUrl: request.url,
              toUrl: 'https://other.example/landing',
              status: 302,
            },
          ],
        });
      }
      return okFetch(request.url);
    });

    const result = await runVariantTests({
      requestId: 'cross-origin',
      baseUrl: 'https://shop.example/item',
      kindOptions: {
        scheme: true,
        www: false,
        trailingSlash: false,
        case: false,
        indexFilenames: false,
      },
      fetchImpl,
    });

    const httpRow = result.results.find((row) => row.requestUrl.startsWith('http://'));
    expect(httpRow?.finalUrl).toBe('https://other.example/landing');
    expect(httpRow?.redirectHops[0]?.toUrl).toBe('https://other.example/landing');
  });

  it('deduplicates duplicate generated variants before fetching', async () => {
    const fetchImpl = vi.fn(async (request: { url: string }) => okFetch(request.url));

    await runVariantTests({
      requestId: 'dedupe',
      baseUrl: 'https://example.com/',
      kindOptions: DEFAULT_VARIANT_KIND_OPTIONS,
      fetchImpl,
    });

    const requested = fetchImpl.mock.calls.map(([request]) => request.url);
    expect(new Set(requested).size).toBe(requested.length);
  });

  it('stops on wall-time budget with partial results', async () => {
    const fetchImpl = vi.fn(async (request: { url: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return okFetch(request.url);
    });

    const result = await runVariantTests({
      requestId: 'timeout-run',
      baseUrl: 'https://slow.example/page',
      kindOptions: DEFAULT_VARIANT_KIND_OPTIONS,
      limits: { maxWallTimeMs: 50, maxVariants: 24 },
      fetchImpl,
    });

    expect(result.truncation.wallTimeExceeded).toBe(true);
    expect(result.results.some((row) => row.skipped)).toBe(true);
    expect(result.truncation.completedCount).toBeLessThan(result.truncation.fetchTargets);
  }, 15_000);

  it('supports cancellation mid-run', async () => {
    const fetchImpl = vi.fn(
      (request: { url: string; signal?: AbortSignal }) =>
        new Promise<SafeFetchResult>((resolve) => {
          const timer = setTimeout(() => resolve(okFetch(request.url)), 1_000);
          request.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve(
              errFetch(request.url, {
                code: 'aborted',
                message: 'Fetch was cancelled.',
              }),
            );
          });
        }),
    );

    const runPromise = runVariantTests({
      requestId: 'cancel-me',
      baseUrl: 'https://cancel.example/page',
      kindOptions: {
        scheme: true,
        www: true,
        trailingSlash: true,
        case: false,
        indexFilenames: false,
      },
      fetchImpl,
    });

    cancelVariantTests('cancel-me');
    const result = await runPromise;
    expect(result.cancelled).toBe(true);
  });

  it('builds observations for mixed status results', async () => {
    const fetchImpl = vi.fn(async (request: { url: string }) => {
      if (request.url.startsWith('http://')) {
        return okFetch(request.url, { status: 404, finalUrl: 'https://example.com/shared' });
      }
      return okFetch(request.url, { status: 200, finalUrl: 'https://example.com/shared' });
    });

    const result = await runVariantTests({
      requestId: 'mixed-status',
      baseUrl: 'https://example.com/page',
      kindOptions: {
        scheme: true,
        www: false,
        trailingSlash: false,
        case: false,
        indexFilenames: false,
      },
      fetchImpl,
    });

    expect(result.observations.some((item) => item.kind === 'mixed-status')).toBe(true);
  });
});
