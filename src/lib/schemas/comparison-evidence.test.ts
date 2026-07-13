import { describe, expect, it } from 'vitest';
import {
  parseSoft404ProbeResult,
  parseVariantTestRunResult,
  sampleSoft404ProbeResult,
  sampleVariantTestRunResult,
} from './comparison-evidence';

describe('comparison-evidence schemas', () => {
  it('accepts bounded variant and soft-404 probe results', () => {
    expect(parseVariantTestRunResult(sampleVariantTestRunResult()).success).toBe(true);
    expect(parseSoft404ProbeResult(sampleSoft404ProbeResult()).success).toBe(true);
  });

  it('accepts cancelled runs with partial fetch errors', () => {
    const variant = sampleVariantTestRunResult({
      cancelled: true,
      results: [
        {
          kind: 'base',
          label: 'Base URL',
          requestUrl: 'https://example.com/page',
          finalUrl: null,
          status: null,
          redirectHops: [],
          elapsedMs: 10,
          contentType: null,
          canonicalUrl: null,
          error: { code: 'network-error', message: 'Failed to fetch.' },
          skipped: false,
        },
      ],
      finalGroups: [],
      truncation: {
        totalGenerated: 1,
        fetchTargets: 1,
        completedCount: 0,
        variantCapHit: false,
        wallTimeExceeded: false,
      },
    });
    expect(parseVariantTestRunResult(variant).success).toBe(true);

    const probe = sampleSoft404ProbeResult({
      cancelled: true,
      probe: {
        ...sampleSoft404ProbeResult().probe,
        fetchError: { code: 'aborted', message: 'Fetch was cancelled.' },
      },
    });
    expect(parseSoft404ProbeResult(probe).success).toBe(true);
  });

  it('accepts pre-Ticket-305 runs that lack uaProfile', () => {
    const { uaProfile: _omittedVariant, ...variantWithoutUaProfile } = sampleVariantTestRunResult();
    expect(parseVariantTestRunResult(variantWithoutUaProfile).success).toBe(true);

    const { uaProfile: _omittedProbe, ...probeWithoutUaProfile } = sampleSoft404ProbeResult();
    expect(parseSoft404ProbeResult(probeWithoutUaProfile).success).toBe(true);
  });

  it('records the resolved user-agent profile on variant and soft-404 runs', () => {
    const variant = sampleVariantTestRunResult({
      uaProfile: {
        profileId: 'googlebot-style',
        label: 'Googlebot-style (static)',
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        method: 'extension-fetch-header',
        limitations: ['Best-effort only.'],
      },
    });
    const parsedVariant = parseVariantTestRunResult(variant);
    expect(parsedVariant.success).toBe(true);
    if (parsedVariant.success) {
      expect(parsedVariant.data.uaProfile?.profileId).toBe('googlebot-style');
    }
  });

  it('rejects raw response body fields anywhere in the payload', () => {
    const withBodyText = {
      ...sampleVariantTestRunResult(),
      results: [
        {
          ...sampleVariantTestRunResult().results[0]!,
          bodyText: '<html>secret</html>',
        },
      ],
    };
    const variant = parseVariantTestRunResult(withBodyText);
    expect(variant.success).toBe(false);
    if (!variant.success) {
      expect(variant.error.issues.some((issue) => issue.message.includes('bodyText'))).toBe(true);
    }

    const withHtml = {
      ...sampleSoft404ProbeResult(),
      probe: {
        ...sampleSoft404ProbeResult().probe,
        html: '<html>secret</html>',
      },
    };
    const probe = parseSoft404ProbeResult(withHtml);
    expect(probe.success).toBe(false);
    if (!probe.success) {
      expect(probe.error.issues.some((issue) => issue.message.includes('html'))).toBe(true);
    }
  });
});
