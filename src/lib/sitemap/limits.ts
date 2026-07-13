/**
 * Hard caps for sitemap discovery and parsing (Ticket 203).
 * Broad host_permissions (Ticket 212) do not relax these.
 */
export type SitemapLimits = {
  /** Max distinct sitemap XML files fetched in one recursive walk. */
  maxFiles: number;
  /** Max URL entries retained across all fetched urlset files. */
  maxEntries: number;
  /** Max bytes per sitemap response body (aligned with safeFetch default). */
  maxBytes: number;
  /** Max sitemapindex recursion depth (child fetches per branch). */
  maxDepth: number;
};

export const SITEMAP_LIMITS: SitemapLimits = {
  maxFiles: 25,
  maxEntries: 50_000,
  maxBytes: 512_000,
  maxDepth: 10,
};
