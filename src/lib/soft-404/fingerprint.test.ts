import { describe, expect, it } from 'vitest';
import {
  buildTextFingerprint,
  extractTitleFromHtml,
  hashText,
  jaccardSimilarity,
  looksLikeErrorPageTitle,
  stripHtmlToText,
} from './fingerprint';

describe('fingerprint helpers', () => {
  it('extracts document titles from HTML', () => {
    expect(extractTitleFromHtml('<html><head><title> Widget </title></head></html>')).toBe(
      'Widget',
    );
  });

  it('strips tags to bounded plain text', () => {
    const html = '<html><body><h1>Hello</h1><p>World</p></body></html>';
    const stripped = stripHtmlToText(html, 50);
    expect(stripped.text).toBe('Hello World');
    expect(stripped.truncated).toBe(false);
  });

  it('computes stable hashes for normalized text', () => {
    expect(hashText('alpha')).toBe(hashText('alpha'));
    expect(hashText('alpha')).not.toBe(hashText('beta'));
  });

  it('detects error-style titles', () => {
    expect(looksLikeErrorPageTitle('404 Not Found')).toBe(true);
    expect(looksLikeErrorPageTitle('Widget details')).toBe(false);
  });

  it('scores token overlap with Jaccard similarity', () => {
    const left = buildTextFingerprint('alpha beta gamma delta');
    const right = buildTextFingerprint('alpha beta gamma epsilon');
    expect(jaccardSimilarity(left.tokens, right.tokens)).toBeCloseTo(0.6, 1);
  });
});
