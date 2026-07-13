import {
  canonicalRules,
  descriptionMissingOrDuplicate,
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
  fieldFromEvidence,
  type CheckAvailability,
  type CheckAvailabilityContext,
  type CheckDescriptor,
  type Rule,
} from './types';

type CheckMetadata = Omit<CheckDescriptor, 'id' | 'run' | 'optIn' | 'availability'> & {
  optIn?: boolean;
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

function describeCheck(rule: Rule, metadata: CheckMetadata): CheckDescriptor {
  const requiredSources = [...metadata.requiredSources];
  return {
    ...rule,
    ...metadata,
    requiredSources,
    optIn: metadata.optIn ?? false,
    availability: (ctx) => availabilityForSources(requiredSources, ctx),
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
    description: 'Reports noindex and nofollow directives found in DOM metadata.',
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
