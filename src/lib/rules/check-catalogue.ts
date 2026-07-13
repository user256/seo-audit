import { INDEXABILITY_SOURCES } from './indexability-evidence';
import {
  indexabilityCanonicalMismatch,
  indexabilityNoindexSignal,
  indexabilityNonHtmlContent,
  indexabilityRedirectAnomaly,
  indexabilityRobotsBlocked,
  indexabilityRobotsConflict,
  indexabilitySitemapRobotsBlocked,
} from './indexability-rules';
import {
  canonicalRules,
  descriptionMissingOrDuplicate,
  hreflangDirectiveValidation,
  hreflangInvalidUrl,
  imagesEmptyAltAdvisory,
  imagesMissingAlt,
  jsonLdMalformed,
  jsonLdStructuralValidation,
  languageMissing,
  robotsMetaDirectives,
  titleLengthAdvisory,
  titleMissingOrDuplicate,
} from './page-rules';
import {
  ALTERNATES_SOURCE,
  HREFLANG_SOURCE_REF,
  parseSitemapHreflangEvidence,
  SITEMAP_HREFLANG_SOURCE,
} from '../hreflang';
import {
  fieldFromEvidence,
  type CheckAvailability,
  type CheckAvailabilityContext,
  type CheckDescriptor,
  type Rule,
} from './types';

type CheckMetadata = Omit<CheckDescriptor, 'id' | 'run' | 'optIn' | 'availability'> & {
  optIn?: boolean;
  availability?: (ctx: CheckAvailabilityContext) => CheckAvailability;
};

/**
 * Resolve whether a check can consume all of its declared inputs. Evidence
 * whose field state is `absent` is still usable: it is exactly what lets a
 * rule report a missing page element. A missing evidence row is different —
 * it means the source was never captured and must not be treated as a pass.
 */
export function availabilityForSources(
  requiredSources: readonly string[],
  ctx: CheckAvailabilityContext,
): CheckAvailability {
  const missingSources = requiredSources.filter((source) => !ctx.evidenceBySource.has(source));
  if (missingSources.length > 0) {
    if (!ctx.accessGranted) {
      return {
        status: 'needs-access',
        reason: `Site access is required to capture ${missingSources.join(', ')}.`,
      };
    }
    return {
      status: 'unavailable',
      reason: `Required evidence has not been captured: ${missingSources.join(', ')}.`,
    };
  }

  const inaccessibleSources = requiredSources.filter((source) => {
    const field = fieldFromEvidence(ctx.evidenceBySource.get(source));
    return field?.state === 'inaccessible';
  });
  if (inaccessibleSources.length > 0) {
    return {
      status: 'unavailable',
      reason: `Required evidence is inaccessible: ${inaccessibleSources.join(', ')}.`,
    };
  }

  return { status: 'available', reason: 'Required evidence is available.' };
}

function availabilityForHreflangDirectives(ctx: CheckAvailabilityContext): CheckAvailability {
  const html = ctx.evidenceBySource.get(ALTERNATES_SOURCE);
  const sitemap = ctx.evidenceBySource.get(SITEMAP_HREFLANG_SOURCE);
  if (!html && !sitemap) {
    if (!ctx.accessGranted) {
      return {
        status: 'needs-access',
        reason: `Site access is required to capture ${ALTERNATES_SOURCE} or ${SITEMAP_HREFLANG_SOURCE}.`,
      };
    }
    return {
      status: 'unavailable',
      reason: `Required evidence has not been captured: ${ALTERNATES_SOURCE} or ${SITEMAP_HREFLANG_SOURCE}.`,
    };
  }

  const htmlField = fieldFromEvidence(html);
  const htmlPresent =
    htmlField?.state === 'present' &&
    Array.isArray((htmlField as { value?: unknown }).value) &&
    ((htmlField as { value: unknown[] }).value.length ?? 0) > 0;
  const sitemapParsed = sitemap ? parseSitemapHreflangEvidence(sitemap.value) : null;
  const sitemapPresent = (sitemapParsed?.alternates.length ?? 0) > 0;

  if (!htmlPresent && !sitemapPresent) {
    return {
      status: 'unavailable',
      reason: 'No hreflang alternates were captured in HTML or sitemap evidence.',
    };
  }

  return { status: 'available', reason: 'Hreflang directive evidence is available.' };
}

function availabilityAtLeastOne(
  sources: readonly string[],
  ctx: CheckAvailabilityContext,
): CheckAvailability {
  const present = sources.filter((source) => ctx.evidenceBySource.has(source));
  if (present.length > 0) {
    return {
      status: 'available',
      reason: `At least one required evidence source is available (${present.join(', ')}).`,
    };
  }
  if (!ctx.accessGranted) {
    return {
      status: 'needs-access',
      reason: `Site access is required to capture one of: ${sources.join(', ')}.`,
    };
  }
  return {
    status: 'unavailable',
    reason: `Required evidence has not been captured (need at least one of: ${sources.join(', ')}).`,
  };
}

function availabilityAllPresent(
  sources: readonly string[],
  ctx: CheckAvailabilityContext,
): CheckAvailability {
  return availabilityForSources(sources, ctx);
}

function describeCheck(rule: Rule, metadata: CheckMetadata): CheckDescriptor {
  const requiredSources = [...metadata.requiredSources];
  return {
    ...rule,
    ...metadata,
    requiredSources,
    optIn: metadata.optIn ?? false,
    availability: metadata.availability ?? ((ctx) => availabilityForSources(requiredSources, ctx)),
  };
}

/**
 * The single check registry shared by the audit runner and future selection UI.
 * Add new checks here rather than creating another runnable rule list.
 */
export const CHECK_CATALOGUE: readonly CheckDescriptor[] = [
  describeCheck(titleMissingOrDuplicate, {
    label: 'Missing or duplicate title',
    description: 'Checks that the document exposes exactly one non-empty title.',
    category: 'metadata',
    requiredSources: ['title'],
    cost: 'dom',
    sourceRef: 'https://developers.google.com/search/docs/appearance/title-link',
  }),
  describeCheck(titleLengthAdvisory, {
    label: 'Title length advisory',
    description: 'Flags titles outside the 10–60 character advisory band.',
    category: 'metadata',
    requiredSources: ['title'],
    cost: 'dom',
    sourceRef: 'https://developers.google.com/search/docs/appearance/title-link',
  }),
  describeCheck(descriptionMissingOrDuplicate, {
    label: 'Missing or duplicate meta description',
    description: 'Checks that a single non-empty meta description is present.',
    category: 'metadata',
    requiredSources: ['meta[name=description]'],
    cost: 'dom',
    sourceRef: 'https://developers.google.com/search/docs/appearance/snippet',
  }),
  describeCheck(canonicalRules, {
    label: 'Canonical link validation',
    description: 'Checks canonical presence, multiplicity, and target validity.',
    category: 'indexability',
    requiredSources: ['link[rel=canonical]'],
    cost: 'dom',
    sourceRef:
      'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
  }),
  describeCheck(robotsMetaDirectives, {
    label: 'Meta robots directives',
    description:
      'Reports nofollow directives found in DOM metadata (noindex is reconciled separately).',
    category: 'indexability',
    requiredSources: ['meta[name=robots|googlebot]'],
    cost: 'dom',
    sourceRef: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
  }),
  describeCheck(hreflangInvalidUrl, {
    label: 'Hreflang URL validation',
    description: 'Checks alternate hreflang links for resolvable HTTP(S) targets.',
    category: 'international',
    requiredSources: ['link[rel=alternate][hreflang]'],
    cost: 'dom',
    sourceRef:
      'https://developers.google.com/search/docs/specialty/international/localized-versions',
  }),
  describeCheck(hreflangDirectiveValidation, {
    label: 'Hreflang directive validation',
    description:
      'Validates captured hreflang language codes, duplicate alternates, empty targets, and HTML/sitemap consistency.',
    category: 'international',
    requiredSources: [ALTERNATES_SOURCE, SITEMAP_HREFLANG_SOURCE],
    cost: 'dom',
    sourceRef: HREFLANG_SOURCE_REF,
    availability: availabilityForHreflangDirectives,
  }),
  describeCheck(jsonLdMalformed, {
    label: 'Malformed JSON-LD',
    description: 'Reports JSON-LD scripts that could not be parsed as JSON.',
    category: 'structured-data',
    requiredSources: ['script[type=application/ld+json]'],
    cost: 'dom',
    sourceRef:
      'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
  }),
  describeCheck(jsonLdStructuralValidation, {
    label: 'JSON-LD structural validation',
    description:
      'Reports bounded generic JSON-LD structure observations; it does not assess rich-result eligibility.',
    category: 'structured-data',
    requiredSources: ['script[type=application/ld+json]'],
    cost: 'dom',
    sourceRef: 'https://www.w3.org/TR/json-ld11/',
  }),
  describeCheck(languageMissing, {
    label: 'Document language',
    description: 'Checks that the html element has a non-empty language attribute.',
    category: 'metadata',
    requiredSources: ['html[lang]'],
    cost: 'dom',
    sourceRef: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang',
  }),
  describeCheck(imagesMissingAlt, {
    label: 'Images missing alt text',
    description: 'Reports images that omit the alt attribute.',
    category: 'accessibility-seo',
    requiredSources: ['img'],
    cost: 'dom',
    sourceRef: 'https://developers.google.com/search/docs/appearance/google-images',
  }),
  describeCheck(imagesEmptyAltAdvisory, {
    label: 'Empty alt text advisory',
    description: 'Highlights empty alt attributes for analyst review.',
    category: 'accessibility-seo',
    requiredSources: ['img'],
    cost: 'dom',
    sourceRef: 'https://developers.google.com/search/docs/appearance/google-images',
  }),
  describeCheck(indexabilityNoindexSignal, {
    label: 'Noindex signal reconciliation',
    description:
      'Reports observed noindex signals from HTML meta robots and/or X-Robots-Tag when captured.',
    category: 'indexability',
    requiredSources: [INDEXABILITY_SOURCES.META_ROBOTS, INDEXABILITY_SOURCES.BROWSER_NAVIGATION],
    cost: 'network',
    sourceRef: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
    availability: (ctx) =>
      availabilityAtLeastOne(
        [INDEXABILITY_SOURCES.META_ROBOTS, INDEXABILITY_SOURCES.BROWSER_NAVIGATION],
        ctx,
      ),
  }),
  describeCheck(indexabilityRobotsConflict, {
    label: 'Conflicting robots directives',
    description:
      'Compares captured HTML meta robots against X-Robots-Tag for disagreements on index/follow tokens.',
    category: 'indexability',
    requiredSources: [INDEXABILITY_SOURCES.META_ROBOTS, INDEXABILITY_SOURCES.BROWSER_NAVIGATION],
    cost: 'network',
    sourceRef: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
    availability: (ctx) =>
      availabilityAllPresent(
        [INDEXABILITY_SOURCES.META_ROBOTS, INDEXABILITY_SOURCES.BROWSER_NAVIGATION],
        ctx,
      ),
  }),
  describeCheck(indexabilityRobotsBlocked, {
    label: 'robots.txt crawl block observed',
    description:
      'Reports when captured robots.txt evaluation observed crawl blocking for the audited URL path.',
    category: 'indexability',
    requiredSources: [INDEXABILITY_SOURCES.ROBOTS_EVALUATION],
    cost: 'network',
    sourceRef: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
  }),
  describeCheck(indexabilityCanonicalMismatch, {
    label: 'Canonical vs final URL mismatch',
    description:
      'Compares a resolved canonical target against the observed browser-navigation final URL.',
    category: 'indexability',
    requiredSources: [INDEXABILITY_SOURCES.CANONICAL, INDEXABILITY_SOURCES.BROWSER_NAVIGATION],
    cost: 'network',
    sourceRef:
      'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
    availability: (ctx) =>
      availabilityAllPresent(
        [INDEXABILITY_SOURCES.CANONICAL, INDEXABILITY_SOURCES.BROWSER_NAVIGATION],
        ctx,
      ),
  }),
  describeCheck(indexabilityRedirectAnomaly, {
    label: 'Redirect chain anomalies',
    description: 'Flags redirect loops or excessive hops recorded in browser-navigation evidence.',
    category: 'indexability',
    requiredSources: [INDEXABILITY_SOURCES.BROWSER_NAVIGATION],
    cost: 'network',
    sourceRef: 'https://developers.google.com/search/docs/crawling-indexing/301-redirects',
  }),
  describeCheck(indexabilityNonHtmlContent, {
    label: 'Non-HTML content type observed',
    description:
      'Reports when browser-navigation Content-Type is present and not an HTML media type.',
    category: 'indexability',
    requiredSources: [INDEXABILITY_SOURCES.BROWSER_NAVIGATION],
    cost: 'network',
    sourceRef: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type',
  }),
  describeCheck(indexabilitySitemapRobotsBlocked, {
    label: 'Sitemap URL blocked by robots.txt',
    description:
      'Reports when sitemap membership and robots.txt evaluation both exist and disagree on crawl access.',
    category: 'indexability',
    requiredSources: [
      INDEXABILITY_SOURCES.SITEMAP_MEMBERSHIP,
      INDEXABILITY_SOURCES.ROBOTS_EVALUATION,
    ],
    cost: 'network',
    sourceRef: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview',
    availability: (ctx) =>
      availabilityAllPresent(
        [INDEXABILITY_SOURCES.SITEMAP_MEMBERSHIP, INDEXABILITY_SOURCES.ROBOTS_EVALUATION],
        ctx,
      ),
  }),
];

export type ResolvedCheckAvailability = CheckAvailability & { checkId: string };

/** Resolve the current availability of every registered check. */
export function resolveCheckAvailability(
  ctx: CheckAvailabilityContext,
  catalogue: readonly CheckDescriptor[] = CHECK_CATALOGUE,
): ResolvedCheckAvailability[] {
  return catalogue.map((check) => ({ checkId: check.id, ...check.availability(ctx) }));
}

/** Compatibility export for code that consumed the former rule registry. */
export const PAGE_RULES: readonly Rule[] = CHECK_CATALOGUE;
