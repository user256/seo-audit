/**
 * Hard caps for extension-initiated HTTP(S) fetches (Ticket 206).
 * Broad host_permissions (Ticket 212) do not relax these.
 */
export type SafeFetchLimits = {
  /** Max redirect hops followed (301/302/303/307/308). */
  maxRedirects: number;
  /** Wall-clock timeout per hop (ms). */
  timeoutMs: number;
  /** Max response body bytes retained when includeBody is true. */
  maxBodyBytes: number;
  /** Max concurrent safeFetch calls process-wide. */
  maxConcurrency: number;
  /** Max characters kept for each selected header value. */
  maxHeaderChars: number;
  /** Max characters kept for the request URL / final URL in results. */
  maxUrlChars: number;
};

export const SAFE_FETCH_LIMITS: SafeFetchLimits = {
  maxRedirects: 10,
  timeoutMs: 15_000,
  maxBodyBytes: 512_000,
  maxConcurrency: 4,
  maxHeaderChars: 2_000,
  maxUrlChars: 8_192,
};

/** SEO-relevant response headers retained (names lowercased). */
export const SAFE_FETCH_HEADER_ALLOWLIST = [
  'cache-control',
  'content-type',
  'link',
  'location',
  'refresh',
  'vary',
  'x-robots-tag',
] as const;

export type SafeFetchHeaderName = (typeof SAFE_FETCH_HEADER_ALLOWLIST)[number];
