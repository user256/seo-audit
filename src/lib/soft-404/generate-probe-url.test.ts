import { describe, expect, it } from 'vitest';
import {
  buildDefaultProbeUrl,
  generateOpaqueProbePath,
  validateProbeUrl,
} from './generate-probe-url';

describe('generateOpaqueProbePath', () => {
  it('returns a URL-safe path under /seo-audit-probe-', () => {
    const path = generateOpaqueProbePath();
    expect(path).toMatch(/^\/seo-audit-probe-[a-z0-9]+$/);
  });
});

describe('buildDefaultProbeUrl', () => {
  it('builds a probe URL on the audited origin', () => {
    const built = buildDefaultProbeUrl('https://shop.example/products/widget');
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.origin).toBe('https://shop.example');
    expect(built.probeUrl).toMatch(/^https:\/\/shop\.example\/seo-audit-probe-[a-z0-9]+$/);
  });

  it('rejects non-http(s) audited URLs', () => {
    const built = buildDefaultProbeUrl('chrome://extensions');
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.code).toBe('unsupported-scheme');
  });
});

describe('validateProbeUrl', () => {
  it('accepts same-origin probe URLs', () => {
    const result = validateProbeUrl(
      'https://shop.example/products/widget',
      'https://shop.example/seo-audit-probe-abc123',
    );
    expect(result.ok).toBe(true);
  });

  it('rejects cross-origin probe URLs', () => {
    const result = validateProbeUrl(
      'https://shop.example/products/widget',
      'https://other.example/seo-audit-probe-abc123',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('cross-origin');
  });

  it('rejects non-http(s) probe URLs', () => {
    const result = validateProbeUrl(
      'https://shop.example/products/widget',
      'file:///seo-audit-probe-abc123',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('unsupported-scheme');
  });
});
