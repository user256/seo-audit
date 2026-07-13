import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SafeFetchResult } from '../network/types';
import {
  cancelClusterValidation,
  resetClusterValidationState,
  validateHreflangCluster,
} from './cluster-validate';

const SEED = 'https://example.com/en/page';
const FIXED_START = '2026-07-13T12:00:00.000Z';

function htmlWithAlternates(alternates: Array<{ hreflang: string; href: string }>): string {
  const links = alternates
    .map((alt) => `<link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}" />`)
    .join('');
  return `<!doctype html><html><head>${links}</head><body></body></html>`;
}

function okFetch(
  url: string,
  body: string,
  overrides: Partial<Extract<SafeFetchResult, { ok: true }>> = {},
): Extract<SafeFetchResult, { ok: true }> {
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
      startedAt: FIXED_START,
      endedAt: FIXED_START,
      durationMs: 1,
    },
    truncated: false,
    bodyByteLength: body.length,
    mimeMatched: true,
    limitations: [],
    bodyText: body,
    ...overrides,
  };
}

function failFetch(
  url: string,
  code: Extract<SafeFetchResult, { ok: false }>['code'] = 'network-error',
): Extract<SafeFetchResult, { ok: false }> {
  return {
    ok: false,
    source: 'extension-fetch',
    requestId: `mock-${url}`,
    method: 'GET',
    requestedUrl: url,
    redirectHops: [],
    timing: {
      startedAt: FIXED_START,
      endedAt: FIXED_START,
      durationMs: 1,
    },
    code,
    message: `mock ${code}`,
    truncated: false,
    limitations: [],
  };
}

describe('validateHreflangCluster', () => {
  beforeEach(() => {
    resetClusterValidationState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_START));
  });

  afterEach(() => {
    resetClusterValidationState();
    vi.useRealTimers();
  });

  it('passes reciprocity when fetched members return each other', async () => {
    const en = 'https://example.com/en/page';
    const de = 'https://example.com/de/seite';

    const fetchImpl = vi.fn(async ({ url }: { url: string }) => {
      if (url === de) {
        return okFetch(
          de,
          htmlWithAlternates([
            { hreflang: 'de', href: de },
            { hreflang: 'en', href: en },
          ]),
        );
      }
      if (url === en) {
        return okFetch(
          en,
          htmlWithAlternates([
            { hreflang: 'en', href: en },
            { hreflang: 'de', href: de },
          ]),
        );
      }
      return failFetch(url);
    });

    const result = await validateHreflangCluster({
      requestId: 'req-pass',
      seedUrl: SEED,
      alternates: [
        { hreflang: 'en', href: en },
        { hreflang: 'de', href: de },
      ],
      fetchImpl,
    });

    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.members.filter((member) => member.fetched)).toHaveLength(2);
  });

  it('flags missing return tags among fetched members', async () => {
    const en = 'https://example.com/en/page';
    const de = 'https://example.com/de/seite';

    const fetchImpl = vi.fn(async ({ url }: { url: string }) => {
      if (url === de) {
        return okFetch(de, htmlWithAlternates([{ hreflang: 'de', href: de }]));
      }
      if (url === en) {
        return okFetch(
          en,
          htmlWithAlternates([
            { hreflang: 'en', href: en },
            { hreflang: 'de', href: de },
          ]),
        );
      }
      return failFetch(url);
    });

    const result = await validateHreflangCluster({
      requestId: 'req-missing-return',
      seedUrl: SEED,
      alternates: [
        { hreflang: 'en', href: en },
        { hreflang: 'de', href: de },
      ],
      fetchImpl,
    });

    expect(result.findings.map((finding) => finding.ruleId)).toContain(
      'hreflang-cluster-missing-return',
    );
    expect(result.findings.some((finding) => finding.description.includes(de))).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('records fetch failures as capture errors without inventing reciprocity findings', async () => {
    const en = 'https://example.com/en/page';
    const de = 'https://example.com/de/seite';

    const fetchImpl = vi.fn(async ({ url }: { url: string }) => {
      if (url === de) return failFetch(de, 'timeout');
      if (url === en) {
        return okFetch(
          en,
          htmlWithAlternates([
            { hreflang: 'en', href: en },
            { hreflang: 'de', href: de },
          ]),
        );
      }
      return failFetch(url);
    });

    const result = await validateHreflangCluster({
      requestId: 'req-fetch-fail',
      seedUrl: SEED,
      alternates: [
        { hreflang: 'en', href: en },
        { hreflang: 'de', href: de },
      ],
      fetchImpl,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe('hreflang-cluster-timeout');
    expect(
      result.findings.some((finding) => finding.ruleId === 'hreflang-cluster-missing-return'),
    ).toBe(false);
    expect(result.members.find((member) => member.requestedUrl === de)?.fetched).toBe(false);
  });

  it('records redirect hops on fetched members', async () => {
    const requested = 'https://example.com/de';
    const finalUrl = 'https://example.com/de/seite';

    const fetchImpl = vi.fn(async () =>
      okFetch(requested, htmlWithAlternates([{ hreflang: 'de', href: finalUrl }]), {
        finalUrl,
        redirectHops: [{ fromUrl: requested, toUrl: finalUrl, status: 301 }],
      }),
    );

    const result = await validateHreflangCluster({
      requestId: 'req-redirect',
      seedUrl: SEED,
      alternates: [{ hreflang: 'de', href: requested }],
      fetchImpl,
    });

    const member = result.members[0];
    expect(member?.redirectHops).toHaveLength(1);
    expect(member?.finalUrl).toBe(finalUrl);
  });

  it('supports cancellation via requestId', async () => {
    vi.useRealTimers();
    const en = 'https://example.com/en/page';
    const de = 'https://example.com/de/seite';
    const fr = 'https://example.com/fr/page';
    const es = 'https://example.com/es/page';

    const fetchImpl = vi.fn(async (request: { url: string; signal?: AbortSignal }) => {
      if (request.url === en) {
        cancelClusterValidation('req-cancel');
        return okFetch(en, htmlWithAlternates([{ hreflang: 'en', href: en }]));
      }
      await new Promise<void>((resolve) => {
        if (request.signal?.aborted) {
          resolve();
          return;
        }
        request.signal?.addEventListener('abort', () => resolve(), { once: true });
      });
      if (request.signal?.aborted) {
        return failFetch(request.url, 'aborted');
      }
      return okFetch(request.url, htmlWithAlternates([{ hreflang: 'xx', href: request.url }]));
    });

    const result = await validateHreflangCluster({
      requestId: 'req-cancel',
      seedUrl: SEED,
      alternates: [
        { hreflang: 'en', href: en },
        { hreflang: 'de', href: de },
        { hreflang: 'fr', href: fr },
        { hreflang: 'es', href: es },
      ],
      fetchImpl,
    });

    expect(result.cancelled).toBe(true);
    expect(result.limitations.join(' ')).toMatch(/cancelled/i);
    expect(result.members.length).toBe(4);
    expect(result.members.filter((member) => member.fetched).length).toBeLessThan(4);
  });

  it('truncates alternates beyond the configured cap with honest evidence', async () => {
    const fetchImpl = vi.fn(async ({ url }: { url: string }) =>
      okFetch(url, htmlWithAlternates([{ hreflang: 'en', href: url }])),
    );

    const alternates = Array.from({ length: 5 }, (_, index) => ({
      hreflang: `l${index}`,
      href: `https://example.com/${index}`,
    }));

    const result = await validateHreflangCluster({
      requestId: 'req-truncate',
      seedUrl: SEED,
      alternates,
      limits: { maxAlternates: 2, maxWallTimeMs: 120_000 },
      fetchImpl,
    });

    expect(result.truncation.alternateCapHit).toBe(true);
    expect(result.members).toHaveLength(2);
    expect(result.limitations.join(' ')).toMatch(/truncated to 2/i);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('flags missing self-reference and invalid codes on fetched pages', async () => {
    const de = 'https://example.com/de/seite';
    const fetchImpl = vi.fn(async () =>
      okFetch(
        de,
        htmlWithAlternates([
          { hreflang: 'xx', href: 'https://example.com/xx' },
          { hreflang: 'xx', href: 'https://example.com/xx-other' },
        ]),
      ),
    );

    const result = await validateHreflangCluster({
      requestId: 'req-self-invalid',
      seedUrl: SEED,
      alternates: [{ hreflang: 'de', href: de }],
      fetchImpl,
    });

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        'hreflang-cluster-missing-self-ref',
        'hreflang-cluster-invalid-language',
        'hreflang-cluster-duplicate-alternate',
      ]),
    );
  });
});
