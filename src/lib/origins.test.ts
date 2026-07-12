import { describe, expect, it } from 'vitest';
import { evaluateUrl, isAuditableHttpUrl } from './origins';

describe('evaluateUrl', () => {
  it('accepts https origins and builds an exact host pattern', () => {
    expect(evaluateUrl('https://example.com/path?q=1')).toEqual({
      ok: true,
      url: 'https://example.com/path?q=1',
      origin: 'https://example.com',
      pattern: 'https://example.com/*',
    });
  });

  it('accepts http origins including non-default ports', () => {
    expect(evaluateUrl('http://localhost:8080/')).toEqual({
      ok: true,
      url: 'http://localhost:8080/',
      origin: 'http://localhost:8080',
      pattern: 'http://localhost:8080/*',
    });
  });

  it('rejects chrome:// and extension pages without requesting access', () => {
    const result = evaluateUrl('chrome://extensions');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/cannot be audited/i);
    }
  });

  it('rejects file:// URLs', () => {
    const result = evaluateUrl('file:///tmp/page.html');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/file:/i);
    }
  });

  it('rejects missing URLs', () => {
    expect(evaluateUrl(undefined).ok).toBe(false);
  });
});

describe('isAuditableHttpUrl', () => {
  it('is a boolean wrapper around evaluateUrl', () => {
    expect(isAuditableHttpUrl('https://a.test/')).toBe(true);
    expect(isAuditableHttpUrl('chrome://settings')).toBe(false);
  });
});
