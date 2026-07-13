export { TYPO_MAP, VALID_LANGS, VALID_REGIONS } from './codes';
export {
  compareHreflangSources,
  type HreflangAlternateRef,
  type HreflangSourceMismatch,
} from './compare-sources';
export { isRelativeHref, normalizeHreflangUrl } from './normalize-url';
export {
  ALTERNATES_SOURCE,
  evaluateHreflangDirectives,
  HREFLANG_SOURCE_REF,
  htmlAlternatesFromField,
  parseSitemapHreflangEvidence,
  SITEMAP_HREFLANG_SOURCE,
  type HreflangDirectiveInput,
  type HtmlAlternateCaptured,
  type SitemapHreflangEvidence,
} from './rules';
export { validateHreflangTag, type HreflangTagValidation } from './validate-tag';
