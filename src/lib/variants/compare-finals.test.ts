import { describe, expect, it } from 'vitest';
import {
  buildVariantObservations,
  canonicalFromLinkHeader,
  groupVariantFinals,
} from './compare-finals';
import type { VariantTestRow } from './types';

function row(
  partial: Partial<VariantTestRow> & Pick<VariantTestRow, 'requestUrl' | 'finalUrl'>,
): VariantTestRow {
  return {
    kind: 'base',
    label: 'Base URL',
    status: 200,
    redirectHops: [],
    elapsedMs: 10,
    contentType: 'text/html',
    canonicalUrl: null,
    error: null,
    skipped: false,
    ...partial,
  };
}

describe('compare-finals', () => {
  it('parses canonical URLs from Link headers', () => {
    expect(canonicalFromLinkHeader('<https://example.com/canonical>; rel="canonical"')).toBe(
      'https://example.com/canonical',
    );
  });

  it('groups rows by normalised final URL', () => {
    const groups = groupVariantFinals([
      row({ requestUrl: 'https://a.example/x', finalUrl: 'https://example.com/final/' }),
      row({ requestUrl: 'https://b.example/y', finalUrl: 'https://example.com/final' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.members).toHaveLength(2);
  });

  it('flags inconsistent final destinations as observations', () => {
    const rows = [
      row({ requestUrl: 'http://example.com/', finalUrl: 'https://example.com/a' }),
      row({ requestUrl: 'https://www.example.com/', finalUrl: 'https://example.com/b' }),
    ];
    const groups = groupVariantFinals(rows);
    const observations = buildVariantObservations(rows, groups);
    expect(observations.some((item) => item.kind === 'inconsistent-finals')).toBe(true);
    expect(observations[0]?.detail).toMatch(/no preferred host/i);
  });

  it('flags mixed status codes for the same final URL', () => {
    const rows = [
      row({
        requestUrl: 'https://example.com/a',
        finalUrl: 'https://example.com/final',
        status: 200,
      }),
      row({
        requestUrl: 'https://example.com/b',
        finalUrl: 'https://example.com/final',
        status: 404,
      }),
    ];
    const groups = groupVariantFinals(rows);
    const observations = buildVariantObservations(rows, groups);
    expect(observations.some((item) => item.kind === 'mixed-status')).toBe(true);
  });

  it('flags canonical header mismatches', () => {
    const rows = [
      row({
        requestUrl: 'https://example.com/a',
        finalUrl: 'https://example.com/final',
        canonicalUrl: 'https://example.com/canonical-a',
      }),
      row({
        requestUrl: 'https://example.com/b',
        finalUrl: 'https://example.com/final',
        canonicalUrl: 'https://example.com/canonical-b',
      }),
    ];
    const groups = groupVariantFinals(rows);
    const observations = buildVariantObservations(rows, groups);
    expect(observations.some((item) => item.kind === 'canonical-mismatch')).toBe(true);
  });
});
