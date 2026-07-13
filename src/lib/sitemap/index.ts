export {
  COMMON_SITEMAP_PATHS,
  discoverSitemapCandidates,
  type SitemapCandidate,
  type SitemapCandidateSource,
} from './discover';
export {
  SITEMAP_FETCH_SOURCE,
  fetchSitemap,
  normalizeSitemapUrl,
  processSitemapFetch,
  sitemapContainsAuditedUrl,
  sitemapUrlVariants,
  type SitemapCaptureError,
  type SitemapCaptureErrorCode,
  type SitemapFetchFailure,
  type SitemapFetchResult,
  type SitemapFetchSuccess,
  type SitemapFetchedFile,
  type SitemapUrlMembership,
} from './fetch-sitemap';
export { SITEMAP_LIMITS, type SitemapLimits } from './limits';
export {
  parseSitemapXml,
  sanitizeSitemapXml,
  type SitemapAlternate,
  type SitemapChildRef,
  type SitemapParseFailure,
  type SitemapParseResult,
  type SitemapParseSuccess,
  type SitemapUrlEntry,
} from './parse-xml';
