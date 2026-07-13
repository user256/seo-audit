import type { Finding } from '../schemas/audit';
import {
  ALTERNATES_SOURCE,
  evaluateHreflangDirectives,
  htmlAlternatesFromField,
  parseSitemapHreflangEvidence,
  SITEMAP_HREFLANG_SOURCE,
} from '../hreflang';
import { inventoryJsonLdEntries, type JsonLdCapturedEntry } from '../structured-data/inventory';
import { fieldFromEvidence, makeFinding, type Rule } from './types';

const TITLE_SOURCE = 'title';
const DESC_SOURCE = 'meta[name=description]';
const ROBOTS_SOURCE = 'meta[name=robots|googlebot]';
const CANONICAL_SOURCE = 'link[rel=canonical]';
const LANG_SOURCE = 'html[lang]';
const IMAGES_SOURCE = 'img';
const JSONLD_SOURCE = 'script[type=application/ld+json]';

import { parseRobotsDirectiveTokens } from './robots-tokens';

export function isHttpOrHttpsUrl(absolute: string): boolean {
  try {
    const protocol = new URL(absolute).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const REF = {
  title: 'https://developers.google.com/search/docs/appearance/title-link',
  description: 'https://developers.google.com/search/docs/appearance/snippet',
  canonical:
    'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
  robots: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
  hreflang: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
  jsonld: 'https://www.w3.org/TR/json-ld11/',
  lang: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang',
  alt: 'https://developers.google.com/search/docs/appearance/google-images',
} as const;

const TITLE_MIN = 10;
const TITLE_MAX = 60;

export const titleMissingOrDuplicate: Rule = {
  id: 'title-missing-or-duplicate',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(TITLE_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || !evidence) return [];
    const findings: Finding[] = [];
    if (field.state === 'absent' || field.state === 'empty') {
      findings.push(
        makeFinding({
          ruleId: 'title-missing',
          severity: 'error',
          category: 'metadata',
          affectedUrl: ctx.pageUrl,
          description:
            field.state === 'absent'
              ? 'The document has no <title> element.'
              : 'The <title> element is empty.',
          evidenceIds: [evidence.id],
          recommendation: 'Add a unique, descriptive title that summarises the page.',
          sourceRef: REF.title,
          capturedAt: ctx.capturedAt,
        }),
      );
    }
    if (field.state === 'duplicate') {
      findings.push(
        makeFinding({
          ruleId: 'title-duplicate',
          severity: 'error',
          category: 'metadata',
          affectedUrl: ctx.pageUrl,
          description: `Found ${field.count} title values; pages should expose a single title.`,
          evidenceIds: [evidence.id],
          recommendation: 'Keep exactly one <title> in <head>.',
          sourceRef: REF.title,
          capturedAt: ctx.capturedAt,
        }),
      );
    }
    return findings;
  },
};

export const titleLengthAdvisory: Rule = {
  id: 'title-length-advisory',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(TITLE_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || field.state !== 'present' || !evidence) return [];
    const text = typeof field.value === 'string' ? field.value : String(field.raw ?? '');
    const length = text.length;
    if (length >= TITLE_MIN && length <= TITLE_MAX) return [];
    return [
      makeFinding({
        ruleId: 'title-length',
        severity: 'info',
        category: 'metadata',
        affectedUrl: ctx.pageUrl,
        description: `Title length is ${length} characters (advisory band ${TITLE_MIN}–${TITLE_MAX}).`,
        evidenceIds: [evidence.id],
        recommendation:
          'Prefer concise, unique titles; Google may rewrite long or vague titles in results.',
        sourceRef: REF.title,
        capturedAt: ctx.capturedAt,
      }),
    ];
  },
};

export const descriptionMissingOrDuplicate: Rule = {
  id: 'description-missing-or-duplicate',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(DESC_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || !evidence) return [];
    if (field.state === 'absent' || field.state === 'empty') {
      return [
        makeFinding({
          ruleId: 'description-missing',
          severity: 'warning',
          category: 'metadata',
          affectedUrl: ctx.pageUrl,
          description:
            field.state === 'absent'
              ? 'No meta description was found.'
              : 'The meta description content is empty.',
          evidenceIds: [evidence.id],
          recommendation: 'Add a unique meta description that summarises the page.',
          sourceRef: REF.description,
          capturedAt: ctx.capturedAt,
        }),
      ];
    }
    if (field.state === 'duplicate') {
      return [
        makeFinding({
          ruleId: 'description-duplicate',
          severity: 'warning',
          category: 'metadata',
          affectedUrl: ctx.pageUrl,
          description: `Found ${field.count} meta description tags.`,
          evidenceIds: [evidence.id],
          recommendation: 'Keep a single meta name="description" in <head>.',
          sourceRef: REF.description,
          capturedAt: ctx.capturedAt,
        }),
      ];
    }
    return [];
  },
};

export const canonicalRules: Rule = {
  id: 'canonical-rules',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(CANONICAL_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || !evidence) return [];
    const findings: Finding[] = [];

    if (field.state === 'absent' || field.state === 'empty') {
      findings.push(
        makeFinding({
          ruleId: 'canonical-missing',
          severity: 'warning',
          category: 'indexability',
          affectedUrl: ctx.pageUrl,
          description:
            field.state === 'absent'
              ? 'No canonical link was found.'
              : 'The canonical link href is empty.',
          evidenceIds: [evidence.id],
          recommendation:
            'Add a single absolute or resolvable rel=canonical when duplicates exist.',
          sourceRef: REF.canonical,
          capturedAt: ctx.capturedAt,
        }),
      );
    }

    if (field.state === 'duplicate') {
      findings.push(
        makeFinding({
          ruleId: 'canonical-multiple',
          severity: 'error',
          category: 'indexability',
          affectedUrl: ctx.pageUrl,
          description: `Found ${field.count} canonical link elements.`,
          evidenceIds: [evidence.id],
          recommendation: 'Emit exactly one rel=canonical.',
          sourceRef: REF.canonical,
          capturedAt: ctx.capturedAt,
        }),
      );
    }

    if (field.state === 'malformed') {
      findings.push(
        makeFinding({
          ruleId: 'canonical-malformed',
          severity: 'error',
          category: 'indexability',
          affectedUrl: ctx.pageUrl,
          description: `Canonical href could not be resolved: ${field.detail}`,
          evidenceIds: [evidence.id],
          recommendation: 'Use a resolvable absolute or relative URL for rel=canonical.',
          sourceRef: REF.canonical,
          capturedAt: ctx.capturedAt,
        }),
      );
    }

    if (field.state === 'present') {
      const value = field.value as { absolute?: string } | undefined;
      const absolute = value?.absolute;
      if (absolute) {
        if (!isHttpOrHttpsUrl(absolute)) {
          findings.push(
            makeFinding({
              ruleId: 'canonical-non-http',
              severity: 'error',
              category: 'indexability',
              affectedUrl: ctx.pageUrl,
              description: `Canonical resolves to a non-HTTP(S) URL (${absolute}).`,
              evidenceIds: [evidence.id],
              recommendation: 'Use an http:// or https:// canonical target for SEO checks.',
              sourceRef: REF.canonical,
              capturedAt: ctx.capturedAt,
            }),
          );
        } else if (ctx.pageOrigin) {
          try {
            const canonOrigin = new URL(absolute).origin;
            if (canonOrigin !== ctx.pageOrigin) {
              findings.push(
                makeFinding({
                  ruleId: 'canonical-off-page',
                  severity: 'warning',
                  category: 'indexability',
                  affectedUrl: ctx.pageUrl,
                  description: `Canonical resolves off-origin to ${absolute}.`,
                  evidenceIds: [evidence.id],
                  recommendation:
                    'Confirm cross-domain canonicals are intentional; otherwise point to the preferred same-site URL.',
                  sourceRef: REF.canonical,
                  capturedAt: ctx.capturedAt,
                }),
              );
            }
          } catch {
            // ignore — malformed handled above
          }
        }
      }
    }

    return findings;
  },
};

export const robotsMetaDirectives: Rule = {
  id: 'robots-meta-directives',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(ROBOTS_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || !evidence) return [];
    const findings: Finding[] = [];

    const contents: string[] = [];
    if (field.state === 'present') {
      const value = field.value as { content?: string } | string;
      if (typeof value === 'string') contents.push(value);
      else if (value?.content) contents.push(value.content);
      else if (field.raw) contents.push(field.raw);
    }
    if (field.state === 'duplicate') {
      for (const item of field.values) {
        if (typeof item === 'string') contents.push(item);
        else if (item && typeof item === 'object' && 'content' in item) {
          contents.push(String((item as { content: unknown }).content ?? ''));
        }
      }
    }

    const tokens = contents.flatMap(parseRobotsDirectiveTokens);
    const hasNone = tokens.includes('none');
    const hasNofollow = hasNone || tokens.includes('nofollow');

    if (hasNofollow) {
      findings.push(
        makeFinding({
          ruleId: 'robots-nofollow',
          severity: 'info',
          category: 'indexability',
          affectedUrl: ctx.pageUrl,
          description: hasNone
            ? 'Meta robots includes none (equivalent to noindex, nofollow; DOM signal only).'
            : 'Meta robots includes nofollow (DOM signal only).',
          evidenceIds: [evidence.id],
          recommendation:
            'Use nofollow/none only when you intentionally want to avoid passing signals via links.',
          sourceRef: REF.robots,
          capturedAt: ctx.capturedAt,
        }),
      );
    }
    return findings;
  },
};

export const hreflangDirectiveValidation: Rule = {
  id: 'hreflang-directive-validation',
  run(ctx) {
    const htmlEvidence = ctx.evidenceBySource.get(ALTERNATES_SOURCE);
    const sitemapEvidence = ctx.evidenceBySource.get(SITEMAP_HREFLANG_SOURCE);
    if (!htmlEvidence && !sitemapEvidence) return [];

    const htmlAlternates = htmlEvidence ? htmlAlternatesFromField(htmlEvidence.value) : undefined;
    const sitemapParsed = sitemapEvidence
      ? parseSitemapHreflangEvidence(sitemapEvidence.value)
      : null;

    const hasHtmlAlternates = (htmlAlternates?.length ?? 0) > 0;
    const hasSitemapAlternates = (sitemapParsed?.alternates.length ?? 0) > 0;
    if (!hasHtmlAlternates && !hasSitemapAlternates) return [];

    return evaluateHreflangDirectives({
      pageUrl: ctx.pageUrl,
      capturedAt: ctx.capturedAt,
      htmlEvidenceId: hasHtmlAlternates ? htmlEvidence!.id : undefined,
      htmlAlternates,
      sitemapEvidenceId: hasSitemapAlternates ? sitemapEvidence!.id : undefined,
      sitemapAlternates: sitemapParsed?.alternates,
    });
  },
};

export const hreflangInvalidUrl: Rule = {
  id: 'hreflang-invalid-url',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(ALTERNATES_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || field.state !== 'present' || !evidence) return [];
    const values = field.value as
      | { href: string; absolute: string | null; hreflang: string; detail?: string }[]
      | undefined;
    if (!Array.isArray(values)) return [];
    const findings: Finding[] = [];
    for (const item of values) {
      if (item.absolute === null) {
        findings.push(
          makeFinding({
            id: `hreflang-invalid-${item.hreflang || 'unknown'}-${evidence.id}`,
            ruleId: 'hreflang-invalid-url',
            severity: 'error',
            category: 'international',
            affectedUrl: ctx.pageUrl,
            description: `hreflang “${item.hreflang}” has an unresolvable href “${item.href}”.`,
            evidenceIds: [evidence.id],
            recommendation:
              'Provide resolvable absolute or relative HTTP(S) URLs for alternate hreflang links.',
            sourceRef: REF.hreflang,
            capturedAt: ctx.capturedAt,
          }),
        );
      } else if (!isHttpOrHttpsUrl(item.absolute)) {
        findings.push(
          makeFinding({
            id: `hreflang-non-http-${item.hreflang || 'unknown'}-${evidence.id}`,
            ruleId: 'hreflang-non-http',
            severity: 'error',
            category: 'international',
            affectedUrl: ctx.pageUrl,
            description: `hreflang “${item.hreflang}” resolves to a non-HTTP(S) URL (${item.absolute}).`,
            evidenceIds: [evidence.id],
            recommendation: 'Use http:// or https:// targets for hreflang alternate links.',
            sourceRef: REF.hreflang,
            capturedAt: ctx.capturedAt,
          }),
        );
      }
    }
    return findings;
  },
};

export const jsonLdMalformed: Rule = {
  id: 'jsonld-malformed',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(JSONLD_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || field.state !== 'present' || !evidence) return [];
    const entries = field.value as { parseStatus: string; index: number }[] | undefined;
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((e) => e.parseStatus === 'invalid-json')
      .map((e) =>
        makeFinding({
          id: `jsonld-malformed-${e.index}-${evidence.id}`,
          ruleId: 'jsonld-malformed',
          severity: 'warning',
          category: 'structured-data',
          affectedUrl: ctx.pageUrl,
          description: `JSON-LD script #${e.index + 1} is not valid JSON (parsed as text only; page scripts were not executed).`,
          evidenceIds: [evidence.id],
          recommendation: 'Fix JSON syntax in application/ld+json scripts.',
          sourceRef: REF.jsonld,
          capturedAt: ctx.capturedAt,
        }),
      );
  },
};

/**
 * Inventory JSON-LD syntax already captured by the DOM collector. These are
 * generic JSON-LD observations, not Rich Results Test or Schema.org validation.
 */
export const jsonLdStructuralValidation: Rule = {
  id: 'jsonld-structural-validation',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(JSONLD_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || field.state !== 'present' || !evidence) return [];
    const entries = field.value as JsonLdCapturedEntry[] | undefined;
    if (!Array.isArray(entries)) return [];

    const findings: Finding[] = [];
    for (const inventory of inventoryJsonLdEntries(entries)) {
      const entryLabel = `JSON-LD script #${inventory.entryIndex + 1}`;
      if (inventory.parseStatus === 'truncated') {
        findings.push(
          makeFinding({
            id: `jsonld-unevaluated-${inventory.entryIndex}-${evidence.id}`,
            ruleId: 'jsonld-unevaluated',
            severity: 'info',
            category: 'structured-data',
            affectedUrl: ctx.pageUrl,
            description: `${entryLabel} was not structurally evaluated because its captured text is incomplete.`,
            evidenceIds: [evidence.id],
            recommendation:
              'Increase the capture budget and rerun the audit before drawing conclusions.',
            sourceRef: REF.jsonld,
            capturedAt: ctx.capturedAt,
          }),
        );
        continue;
      }
      if (inventory.status === 'unevaluated') continue;
      if (inventory.topLevel === 'scalar' || inventory.nonObjectTopLevelCount > 0) {
        findings.push(
          makeFinding({
            id: `jsonld-top-level-non-object-${inventory.entryIndex}-${evidence.id}`,
            ruleId: 'jsonld-top-level-non-object',
            severity: 'warning',
            category: 'structured-data',
            affectedUrl: ctx.pageUrl,
            description: `${entryLabel} has a non-object top-level value; JSON-LD node data must be an object or array of objects under this audit policy.`,
            evidenceIds: [evidence.id],
            recommendation: 'Use an object, an array of objects, or an object containing @graph.',
            sourceRef: REF.jsonld,
            capturedAt: ctx.capturedAt,
          }),
        );
      }
      if (inventory.status === 'limited') {
        findings.push(
          makeFinding({
            id: `jsonld-inventory-limited-${inventory.entryIndex}-${evidence.id}`,
            ruleId: 'jsonld-inventory-limited',
            severity: 'info',
            category: 'structured-data',
            affectedUrl: ctx.pageUrl,
            description: `${entryLabel} reached an inventory safety limit; structural observations may be incomplete.`,
            evidenceIds: [evidence.id],
            recommendation:
              'Simplify the payload or inspect it manually before drawing conclusions.',
            sourceRef: REF.jsonld,
            capturedAt: ctx.capturedAt,
          }),
        );
      }

      for (const graph of inventory.graphs) {
        const graphLabel = `${entryLabel}, graph #${graph.index + 1}`;
        if (graph.context === 'missing' || graph.context === 'malformed') {
          findings.push(
            makeFinding({
              id: `jsonld-context-${graph.context}-${inventory.entryIndex}-${graph.index}-${evidence.id}`,
              ruleId: `jsonld-context-${graph.context}`,
              severity: 'warning',
              category: 'structured-data',
              affectedUrl: ctx.pageUrl,
              description:
                graph.context === 'missing'
                  ? `${graphLabel} has no @context. This audit policy requires a declared context on each captured graph root.`
                  : `${graphLabel} has an @context that is not a non-empty string, object, or array of those values.`,
              evidenceIds: [evidence.id],
              recommendation:
                'Declare a local JSON-LD @context value; this audit does not retrieve or validate remote contexts.',
              sourceRef: REF.jsonld,
              capturedAt: ctx.capturedAt,
            }),
          );
        }
        graph.nodes.forEach((node, nodeIndex) => {
          if (!node.graphNode || node.types.length > 0) return;
          findings.push(
            makeFinding({
              id: `jsonld-node-missing-type-${inventory.entryIndex}-${graph.index}-${nodeIndex}-${evidence.id}`,
              ruleId: 'jsonld-node-missing-type',
              severity: 'warning',
              category: 'structured-data',
              affectedUrl: ctx.pageUrl,
              description: `${graphLabel} node ${nodeIndex + 1} has no @type.`,
              evidenceIds: [evidence.id],
              recommendation: 'Add an appropriate @type to each root or @graph node.',
              sourceRef: REF.jsonld,
              capturedAt: ctx.capturedAt,
            }),
          );
        });
        graph.duplicateIds.forEach((id, duplicateIndex) => {
          findings.push(
            makeFinding({
              id: `jsonld-duplicate-id-${inventory.entryIndex}-${graph.index}-${duplicateIndex}-${evidence.id}`,
              ruleId: 'jsonld-duplicate-id',
              severity: 'warning',
              category: 'structured-data',
              affectedUrl: ctx.pageUrl,
              description: `${graphLabel} repeats @id “${id}”.`,
              evidenceIds: [evidence.id],
              recommendation: 'Keep each @id unique within a captured graph.',
              sourceRef: REF.jsonld,
              capturedAt: ctx.capturedAt,
            }),
          );
        });
      }
    }
    return findings;
  },
};

export const languageMissing: Rule = {
  id: 'language-missing',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(LANG_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || !evidence) return [];
    if (field.state === 'absent' || field.state === 'empty') {
      return [
        makeFinding({
          ruleId: 'language-missing',
          severity: 'warning',
          category: 'metadata',
          affectedUrl: ctx.pageUrl,
          description: 'The document language (html[lang]) is missing or empty.',
          evidenceIds: [evidence.id],
          recommendation: 'Set html lang to a valid BCP 47 language tag.',
          sourceRef: REF.lang,
          capturedAt: ctx.capturedAt,
        }),
      ];
    }
    return [];
  },
};

export const imagesMissingAlt: Rule = {
  id: 'images-missing-alt',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(IMAGES_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || field.state !== 'present' || !evidence) return [];
    const value = field.value as {
      missingAlt?: number;
      emptyAlt?: number;
      total?: number;
    };
    const missing = value.missingAlt ?? 0;
    if (missing === 0) return [];
    return [
      makeFinding({
        ruleId: 'images-missing-alt',
        severity: 'warning',
        category: 'accessibility-seo',
        affectedUrl: ctx.pageUrl,
        description: `${missing} of ${value.total ?? 0} images omit the alt attribute.`,
        evidenceIds: [evidence.id],
        recommendation:
          'Add an alt attribute on every <img>. Use descriptive text for informative images; use empty alt only when decorative.',
        sourceRef: REF.alt,
        capturedAt: ctx.capturedAt,
      }),
    ];
  },
};

export const imagesEmptyAltAdvisory: Rule = {
  id: 'images-empty-alt-advisory',
  run(ctx) {
    const evidence = ctx.evidenceBySource.get(IMAGES_SOURCE);
    const field = fieldFromEvidence(evidence);
    if (!field || field.state !== 'present' || !evidence) return [];
    const value = field.value as {
      missingAlt?: number;
      emptyAlt?: number;
      total?: number;
    };
    const empty = value.emptyAlt ?? 0;
    if (empty === 0) return [];
    return [
      makeFinding({
        ruleId: 'images-empty-alt-advisory',
        severity: 'info',
        category: 'accessibility-seo',
        affectedUrl: ctx.pageUrl,
        description: `${empty} of ${value.total ?? 0} images use an empty alt attribute (often intentional for decorative images).`,
        evidenceIds: [evidence.id],
        recommendation:
          'Confirm empty alt is reserved for decorative images; informative images need descriptive alt text.',
        sourceRef: REF.alt,
        capturedAt: ctx.capturedAt,
      }),
    ];
  },
};
