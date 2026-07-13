import type { Finding } from '../schemas/audit';
import { compareHreflangSources, type HreflangAlternateRef } from './compare-sources';
import { isRelativeHref } from './normalize-url';
import { validateHreflangTag } from './validate-tag';

export const ALTERNATES_SOURCE = 'link[rel=alternate][hreflang]' as const;
export const SITEMAP_HREFLANG_SOURCE = 'sitemap.hreflang' as const;

export const HREFLANG_SOURCE_REF =
  'https://developers.google.com/search/docs/specialty/international/localized-versions';

export type HtmlAlternateCaptured = {
  href: string;
  hreflang: string;
  absolute: string | null;
  selector: string;
  detail?: string;
};

export type SitemapHreflangEvidence = {
  loc: string;
  alternates: HreflangAlternateRef[];
};

export type HreflangDirectiveInput = {
  pageUrl: string;
  capturedAt: string;
  htmlEvidenceId?: string;
  htmlAlternates?: HtmlAlternateCaptured[];
  sitemapEvidenceId?: string;
  sitemapAlternates?: HreflangAlternateRef[];
};

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'unknown';
}

function duplicateHreflangValues(alternates: readonly HreflangAlternateRef[]): string[] {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  for (const alt of alternates) {
    const key = alt.hreflang.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 2) duplicates.push(key);
  }
  return duplicates;
}

function evaluateAlternateSet(
  alternates: readonly HreflangAlternateRef[],
  options: {
    pageUrl: string;
    capturedAt: string;
    evidenceId: string;
    sourceLabel: 'HTML' | 'sitemap';
  },
): Finding[] {
  const findings: Finding[] = [];
  const { pageUrl, capturedAt, evidenceId, sourceLabel } = options;

  for (const duplicate of duplicateHreflangValues(alternates)) {
    findings.push({
      id: `hreflang-duplicate-${sourceLabel}-${slug(duplicate)}-${evidenceId}`,
      ruleId: 'hreflang-duplicate-alternate',
      severity: 'error',
      category: 'international',
      affectedUrl: pageUrl,
      description: `${sourceLabel} declares hreflang="${duplicate}" more than once among captured alternates.`,
      evidenceIds: [evidenceId],
      recommendation: 'Keep exactly one alternate target per hreflang value.',
      sourceRef: HREFLANG_SOURCE_REF,
      capturedAt,
    });
  }

  for (const alt of alternates) {
    const hreflangKey = alt.hreflang.toLowerCase();
    const hrefTrimmed = alt.href.trim();

    const validation = validateHreflangTag(hreflangKey);
    if (!validation.valid) {
      if (validation.typo) {
        findings.push({
          id: `hreflang-likely-typo-${sourceLabel}-${slug(hreflangKey)}-${evidenceId}`,
          ruleId: 'hreflang-likely-typo',
          severity: 'warning',
          category: 'international',
          affectedUrl: pageUrl,
          description: `${sourceLabel} hreflang="${hreflangKey}" looks like a common typo among captured evidence.`,
          evidenceIds: [evidenceId],
          recommendation: `Consider changing hreflang="${hreflangKey}" to hreflang="${validation.typo}".`,
          sourceRef: HREFLANG_SOURCE_REF,
          capturedAt,
        });
      } else {
        findings.push({
          id: `hreflang-invalid-language-${sourceLabel}-${slug(hreflangKey)}-${evidenceId}`,
          ruleId: 'hreflang-invalid-language',
          severity: 'error',
          category: 'international',
          affectedUrl: pageUrl,
          description: `${sourceLabel} hreflang="${hreflangKey}" is not valid: ${validation.reason}.`,
          evidenceIds: [evidenceId],
          recommendation:
            'Use x-default, a valid ISO 639-1 language code, or language-region (e.g. en, en-gb, pt-br).',
          sourceRef: HREFLANG_SOURCE_REF,
          capturedAt,
        });
      }
    }

    if (hrefTrimmed === '') {
      findings.push({
        id: `hreflang-empty-href-${sourceLabel}-${slug(hreflangKey)}-${evidenceId}`,
        ruleId: 'hreflang-empty-href',
        severity: 'error',
        category: 'international',
        affectedUrl: pageUrl,
        description: `${sourceLabel} alternate hreflang="${hreflangKey}" has an empty href (self-resolving to the current page) among captured evidence.`,
        evidenceIds: [evidenceId],
        recommendation: 'Provide an explicit absolute HTTP(S) URL for each hreflang alternate.',
        sourceRef: HREFLANG_SOURCE_REF,
        capturedAt,
      });
    } else if (sourceLabel === 'HTML' && isRelativeHref(alt.href)) {
      findings.push({
        id: `hreflang-relative-url-${slug(hreflangKey)}-${evidenceId}`,
        ruleId: 'hreflang-relative-url',
        severity: 'warning',
        category: 'international',
        affectedUrl: pageUrl,
        description: `HTML hreflang="${hreflangKey}" uses a relative href "${alt.href}" among captured evidence.`,
        evidenceIds: [evidenceId],
        recommendation:
          'Prefer absolute https:// URLs in hreflang annotations; relative hrefs may resolve differently than intended.',
        sourceRef: HREFLANG_SOURCE_REF,
        capturedAt,
      });
    }
  }

  return findings;
}

/**
 * Evaluate captured HTML and/or sitemap hreflang declarations. Does not fetch
 * alternate pages or assert live reciprocity (Ticket 213).
 */
export function evaluateHreflangDirectives(input: HreflangDirectiveInput): Finding[] {
  const findings: Finding[] = [];

  if (input.htmlEvidenceId && input.htmlAlternates && input.htmlAlternates.length > 0) {
    findings.push(
      ...evaluateAlternateSet(input.htmlAlternates, {
        pageUrl: input.pageUrl,
        capturedAt: input.capturedAt,
        evidenceId: input.htmlEvidenceId,
        sourceLabel: 'HTML',
      }),
    );
  }

  if (input.sitemapEvidenceId && input.sitemapAlternates && input.sitemapAlternates.length > 0) {
    findings.push(
      ...evaluateAlternateSet(input.sitemapAlternates, {
        pageUrl: input.pageUrl,
        capturedAt: input.capturedAt,
        evidenceId: input.sitemapEvidenceId,
        sourceLabel: 'sitemap',
      }),
    );
  }

  if (
    input.htmlEvidenceId &&
    input.htmlAlternates &&
    input.sitemapEvidenceId &&
    input.sitemapAlternates &&
    input.htmlAlternates.length > 0 &&
    input.sitemapAlternates.length > 0
  ) {
    const htmlRefs: HreflangAlternateRef[] = input.htmlAlternates.map((alt) => ({
      hreflang: alt.hreflang,
      href: alt.absolute ?? alt.href,
    }));
    const mismatches = compareHreflangSources(htmlRefs, input.sitemapAlternates);
    for (const mismatch of mismatches) {
      findings.push({
        id: `hreflang-html-sitemap-mismatch-${slug(mismatch.hreflang)}-${input.htmlEvidenceId}`,
        ruleId: 'hreflang-html-sitemap-mismatch',
        severity: 'warning',
        category: 'international',
        affectedUrl: input.pageUrl,
        description: `Among captured evidence, hreflang="${mismatch.hreflang}" points to ${mismatch.htmlHref} in HTML but ${mismatch.sitemapHref} in the sitemap. This compares captured annotations only — not live reciprocity on the web.`,
        evidenceIds: [input.htmlEvidenceId, input.sitemapEvidenceId],
        recommendation:
          'Align HTML link alternates and sitemap xhtml:link targets for the same hreflang value.',
        sourceRef: HREFLANG_SOURCE_REF,
        capturedAt: input.capturedAt,
      });
    }
  }

  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

export function parseSitemapHreflangEvidence(value: unknown): SitemapHreflangEvidence | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.loc !== 'string') return null;
  if (!Array.isArray(record.alternates)) return null;
  const alternates: HreflangAlternateRef[] = [];
  for (const item of record.alternates) {
    if (!item || typeof item !== 'object') continue;
    const alt = item as Record<string, unknown>;
    if (typeof alt.hreflang !== 'string' || typeof alt.href !== 'string') continue;
    alternates.push({ hreflang: alt.hreflang.toLowerCase(), href: alt.href });
  }
  return { loc: record.loc, alternates };
}

export function htmlAlternatesFromField(value: unknown): HtmlAlternateCaptured[] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const field = value as { state?: string; value?: unknown };
  if (field.state !== 'present' || !Array.isArray(field.value)) return undefined;
  const out: HtmlAlternateCaptured[] = [];
  for (const item of field.value) {
    if (!item || typeof item !== 'object') continue;
    const alt = item as Record<string, unknown>;
    if (typeof alt.hreflang !== 'string' || typeof alt.href !== 'string') continue;
    out.push({
      href: alt.href,
      hreflang: alt.hreflang.toLowerCase(),
      absolute: typeof alt.absolute === 'string' ? alt.absolute : null,
      selector: typeof alt.selector === 'string' ? alt.selector : 'link[rel=alternate][hreflang]',
      detail: typeof alt.detail === 'string' ? alt.detail : undefined,
    });
  }
  return out;
}
