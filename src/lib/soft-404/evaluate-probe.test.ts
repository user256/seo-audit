import { describe, expect, it } from 'vitest';
import { evaluateSoft404Heuristics } from './evaluate-probe';
import { mapFetchToPageCapture } from './map-capture';
import type { SafeFetchResult } from '../network/types';
import {
  AUDITED_PRODUCT,
  PROBE_DISTINCT_VALID,
  PROBE_ERROR_TEMPLATE,
  PROBE_IDENTICAL_TEMPLATE,
  PROBE_SPA_SHELL,
} from './fixtures/html';

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

function capture(role: 'probe' | 'audited', url: string, body: string | null, status = 200) {
  return mapFetchToPageCapture({
    role,
    requestedUrl: url,
    result: okFetch(url, body, { status }),
  });
}

describe('evaluateSoft404Heuristics', () => {
  it('does not flag true 404 responses', () => {
    const probe = capture('probe', PROBE_URL, null, 404);
    const audited = capture('audited', AUDITED_URL, AUDITED_PRODUCT);
    expect(evaluateSoft404Heuristics({ origin: ORIGIN, probe, audited })).toEqual([]);
  });

  it('does not flag true 410 responses', () => {
    const probe = capture('probe', PROBE_URL, null, 410);
    const audited = capture('audited', AUDITED_URL, AUDITED_PRODUCT);
    expect(evaluateSoft404Heuristics({ origin: ORIGIN, probe, audited })).toEqual([]);
  });

  it('flags a 200 error template title as a possible soft 404', () => {
    const probe = capture('probe', PROBE_URL, PROBE_ERROR_TEMPLATE);
    const audited = capture('audited', AUDITED_URL, AUDITED_PRODUCT);
    const observations = evaluateSoft404Heuristics({ origin: ORIGIN, probe, audited });
    expect(observations.some((item) => item.kind === 'error-template-title')).toBe(true);
    expect(observations.every((item) => item.ruleId === 'soft-404-possible')).toBe(true);
  });

  it('flags redirect-to-home for deep probe requests', () => {
    const probe = mapFetchToPageCapture({
      role: 'probe',
      requestedUrl: PROBE_URL,
      result: okFetch(PROBE_URL, AUDITED_PRODUCT, {
        finalUrl: `${ORIGIN}/`,
        redirectHops: [{ fromUrl: PROBE_URL, toUrl: `${ORIGIN}/`, status: 302 }],
      }),
    });
    const audited = capture('audited', AUDITED_URL, AUDITED_PRODUCT);
    const observations = evaluateSoft404Heuristics({ origin: ORIGIN, probe, audited });
    expect(observations.some((item) => item.kind === 'redirect-to-home')).toBe(true);
  });

  it('flags SPA fallback shells with near-equal body size', () => {
    const probe = capture('probe', PROBE_URL, PROBE_SPA_SHELL);
    const audited = capture('audited', AUDITED_URL, AUDITED_PRODUCT);
    const observations = evaluateSoft404Heuristics({ origin: ORIGIN, probe, audited });
    expect(
      observations.some(
        (item) =>
          item.kind === 'spa-fallback' ||
          item.kind === 'similar-content' ||
          item.kind === 'identical-body-hash',
      ),
    ).toBe(true);
  });

  it('does not flag distinct valid content on success', () => {
    const probe = capture('probe', PROBE_URL, PROBE_DISTINCT_VALID);
    const audited = capture('audited', AUDITED_URL, AUDITED_PRODUCT);
    const observations = evaluateSoft404Heuristics({ origin: ORIGIN, probe, audited });
    expect(observations).toEqual([]);
  });

  it('flags identical success bodies as a possible soft 404', () => {
    const probe = capture('probe', PROBE_URL, PROBE_IDENTICAL_TEMPLATE);
    const audited = capture('audited', AUDITED_URL, AUDITED_PRODUCT);
    const observations = evaluateSoft404Heuristics({ origin: ORIGIN, probe, audited });
    expect(observations.length).toBeGreaterThan(0);
    expect(observations.some((item) => item.kind === 'identical-body-hash')).toBe(true);
  });
});
