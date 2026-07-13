import { describe, expect, it } from 'vitest';
import { boundDomFactUrls, boundUrlString, DOM_LIMITS } from './dom-limits';

describe('URL bounding (Ticket 115)', () => {
  it('preserves exact URLs within maxUrlChars', () => {
    const url = `https://example.com/${'x'.repeat(3_000)}`;
    expect(url.length).toBeGreaterThan(DOM_LIMITS.maxStringChars);
    expect(url.length).toBeLessThanOrEqual(DOM_LIMITS.maxUrlChars);
    expect(boundUrlString(url)).toEqual({ value: url });
  });

  it('clips oversized URLs with truthful length evidence', () => {
    const url = `https://example.com/${'y'.repeat(10_000)}`;
    const bounded = boundUrlString(url);
    expect(bounded.value).toHaveLength(DOM_LIMITS.maxUrlChars);
    expect(bounded.bound).toEqual({
      truncated: true,
      reason: `URL clipped to ${DOM_LIMITS.maxUrlChars} characters`,
      originalLength: url.length,
    });
  });

  it('bounds documentUrl and baseUri independently', () => {
    const documentUrl = `https://example.com/${'d'.repeat(9_000)}`;
    const baseUri = 'https://example.com/';
    const result = boundDomFactUrls({ documentUrl, baseUri });
    expect(result.documentUrl).toHaveLength(DOM_LIMITS.maxUrlChars);
    expect(result.baseUri).toBe(baseUri);
    expect(result.urlBounds?.documentUrl?.originalLength).toBe(documentUrl.length);
    expect(result.urlBounds?.baseUri).toBeUndefined();
  });
});
