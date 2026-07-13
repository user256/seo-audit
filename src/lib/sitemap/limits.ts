/**
 * Hard caps for sitemap discovery and parsing (Ticket 203).
 * Broad host_permissions (Ticket 212) do not relax these.
 */
export const SITEMAP_LIMITS = {
  /** Max distinct sitemap XML files fetched in one recursive walk. */
  maxFiles: 25,
  /** Max URL entries retained across all fetched urlset files. */
  maxEntries: 50_000,
  /** Max bytes per sitemap response body (aligned with safeFetch default). */
  maxBytes: 512_000,
  /** Max sitemapindex recursion depth (child fetches per branch). */
  maxDepth: 10,
} as const;

export type SitemapLimits = typeof SITEMAP_LIMITS;
