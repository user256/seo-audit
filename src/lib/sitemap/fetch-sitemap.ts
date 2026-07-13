import { safeFetch } from '../network/safe-fetch';
import type { RedirectHop, SafeFetchResult } from '../network/types';
import { SITEMAP_LIMITS } from './limits';
import {
  parseSitemapXml,
  type SitemapChildRef,
  type SitemapParseResult,
  type SitemapUrlEntry,
} from './parse-xml';

export const SITEMAP_FETCH_SOURCE = 'extension-fetch' as const;

export type SitemapCaptureErrorCode =
  | 'sitemap-fetch-failed'
  | 'sitemap-fetch-non-200'
  | 'sitemap-fetch-oversized'
  | 'sitemap-fetch-empty'
  | 'sitemap-parse-failed'
  | 'sitemap-invalid-url'
  | 'sitemap-depth-limit'
  | 'sitemap-file-limit';

export type SitemapCaptureError = {
  code: SitemapCaptureErrorCode;
  source: typeof SITEMAP_FETCH_SOURCE;
  message: string;
  url: string;
  capturedAt: string;
  status?: number;
  requestedUrl?: string;
  finalUrl?: string;
  redirectHops?: RedirectHop[];
};

export type SitemapFetchedFile = {
  url: string;
  requestedUrl: string;
  finalUrl: string;
  status: number;
  kind: 'urlset' | 'sitemapindex' | 'unknown';
  fetchedAt: string;
  redirectHops: RedirectHop[];
  childSitemaps: SitemapChildRef[];
  entryCount: number;
  parseDiagnostics: string[];
  error?: SitemapCaptureError;
};

export type SitemapFetchSuccess = {
  ok: true;
  source: typeof SITEMAP_FETCH_SOURCE;
  rootUrls: string[];
  fetchedFiles: SitemapFetchedFile[];
  entries: Map<string, SitemapUrlEntry>;
  truncated: boolean;
  visitedUrls: string[];
  errors: SitemapCaptureError[];
};

export type SitemapFetchFailure = {
  ok: false;
  source: typeof SITEMAP_FETCH_SOURCE;
  rootUrls: string[];
  error: SitemapCaptureError;
  fetchedFiles: SitemapFetchedFile[];
  errors: SitemapCaptureError[];
};

export type SitemapFetchResult = SitemapFetchSuccess | SitemapFetchFailure;

export type SitemapUrlMembership = {
  present: boolean;
  matchedLoc?: string;
  entry?: SitemapUrlEntry;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function captureError(
  partial: Omit<SitemapCaptureError, 'source' | 'capturedAt'> & { capturedAt?: string },
): SitemapCaptureError {
  return {
    source: SITEMAP_FETCH_SOURCE,
    capturedAt: partial.capturedAt ?? nowIso(),
    ...partial,
  };
}

function mapSafeFetchFailure(
  requestedUrl: string,
  result: Extract<SafeFetchResult, { ok: false }>,
  capturedAt: string,
): SitemapCaptureError {
  return captureError({
    code: 'sitemap-fetch-failed',
    message: result.message,
    url: requestedUrl,
    capturedAt,
    status: result.status,
    requestedUrl: result.requestedUrl,
    finalUrl: result.finalUrl,
    redirectHops: result.redirectHops,
  });
}

/**
 * Normalise an http(s) URL for membership comparison without discarding evidence.
 * Returns null when the input is not a parseable http(s) URL.
 */
export function normalizeSitemapUrl(url: string): string | null {
  const parsed = parseHttpUrl(url.trim());
  return parsed ? parsed.href : null;
}

/** URL variants used when checking audited-page membership in sitemap entries. */
export function sitemapUrlVariants(url: string): string[] {
  const normalized = normalizeSitemapUrl(url);
  if (!normalized) return [];
  const parsed = new URL(normalized);
  const variants = new Set<string>([parsed.href]);
  if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
    const noSlash = new URL(parsed.href);
    noSlash.pathname = parsed.pathname.replace(/\/+$/, '');
    variants.add(noSlash.href);
  } else if (!parsed.pathname.endsWith('/')) {
    const withSlash = new URL(parsed.href);
    withSlash.pathname = `${parsed.pathname}/`;
    variants.add(withSlash.href);
  }
  return [...variants];
}

/**
 * Whether the audited final URL appears in parsed sitemap entries.
 */
export function sitemapContainsAuditedUrl(
  entries: Map<string, SitemapUrlEntry>,
  auditedUrl: string,
): SitemapUrlMembership {
  const variants = sitemapUrlVariants(auditedUrl);
  for (const variant of variants) {
    const entry = entries.get(variant);
    if (entry) {
      return { present: true, matchedLoc: variant, entry };
    }
  }
  for (const [loc, entry] of entries) {
    const locVariants = sitemapUrlVariants(loc);
    for (const variant of variants) {
      if (locVariants.includes(variant)) {
        return { present: true, matchedLoc: loc, entry };
      }
    }
  }
  return { present: false };
}

type WalkState = {
  visited: Set<string>;
  fetchedFiles: SitemapFetchedFile[];
  entries: Map<string, SitemapUrlEntry>;
  errors: SitemapCaptureError[];
  filesFetched: number;
  truncated: boolean;
};

function mergeEntries(
  target: Map<string, SitemapUrlEntry>,
  source: Map<string, SitemapUrlEntry>,
  diagnostics: string[],
): boolean {
  let truncated = false;
  for (const [loc, entry] of source) {
    if (target.size >= SITEMAP_LIMITS.maxEntries) {
      truncated = true;
      diagnostics.push(
        `Combined entry count exceeded ${SITEMAP_LIMITS.maxEntries}; further entries skipped.`,
      );
      break;
    }
    if (!target.has(loc)) target.set(loc, entry);
  }
  return truncated;
}

/** Pure post-fetch processor — shared by fetchSitemapRecursive and tests. */
export function processSitemapFetch(
  requestedUrl: string,
  fetchedAt: string,
  fetchResult: SafeFetchResult,
): { file: SitemapFetchedFile; parsed?: SitemapParseResult } {
  if (!fetchResult.ok) {
    const error = mapSafeFetchFailure(requestedUrl, fetchResult, fetchedAt);
    return {
      file: {
        url: requestedUrl,
        requestedUrl,
        finalUrl: fetchResult.finalUrl ?? requestedUrl,
        status: fetchResult.status ?? 0,
        kind: 'unknown',
        fetchedAt,
        redirectHops: fetchResult.redirectHops,
        childSitemaps: [],
        entryCount: 0,
        parseDiagnostics: [],
        error,
      },
    };
  }

  const { status, finalUrl, redirectHops, truncated, bodyText = '' } = fetchResult;

  if (status !== 200) {
    const error = captureError({
      code: 'sitemap-fetch-non-200',
      message: `Sitemap returned HTTP ${status}.`,
      url: requestedUrl,
      capturedAt: fetchedAt,
      status,
      requestedUrl,
      finalUrl,
      redirectHops,
    });
    return {
      file: {
        url: requestedUrl,
        requestedUrl,
        finalUrl,
        status,
        kind: 'unknown',
        fetchedAt,
        redirectHops,
        childSitemaps: [],
        entryCount: 0,
        parseDiagnostics: [],
        error,
      },
    };
  }

  if (truncated) {
    const error = captureError({
      code: 'sitemap-fetch-oversized',
      message: `Sitemap exceeded ${SITEMAP_LIMITS.maxBytes} bytes.`,
      url: requestedUrl,
      capturedAt: fetchedAt,
      status,
      requestedUrl,
      finalUrl,
      redirectHops,
    });
    return {
      file: {
        url: requestedUrl,
        requestedUrl,
        finalUrl,
        status,
        kind: 'unknown',
        fetchedAt,
        redirectHops,
        childSitemaps: [],
        entryCount: 0,
        parseDiagnostics: [],
        error,
      },
    };
  }

  if (!bodyText.trim()) {
    const error = captureError({
      code: 'sitemap-fetch-empty',
      message: 'Sitemap response body was empty.',
      url: requestedUrl,
      capturedAt: fetchedAt,
      status,
      requestedUrl,
      finalUrl,
      redirectHops,
    });
    return {
      file: {
        url: requestedUrl,
        requestedUrl,
        finalUrl,
        status,
        kind: 'unknown',
        fetchedAt,
        redirectHops,
        childSitemaps: [],
        entryCount: 0,
        parseDiagnostics: [],
        error,
      },
    };
  }

  const parsed = parseSitemapXml(bodyText);
  if (!parsed.ok) {
    const error = captureError({
      code: 'sitemap-parse-failed',
      message: parsed.error,
      url: requestedUrl,
      capturedAt: fetchedAt,
      status,
      requestedUrl,
      finalUrl,
      redirectHops,
    });
    return {
      file: {
        url: requestedUrl,
        requestedUrl,
        finalUrl,
        status,
        kind: 'unknown',
        fetchedAt,
        redirectHops,
        childSitemaps: [],
        entryCount: 0,
        parseDiagnostics: parsed.diagnostics,
        error,
      },
      parsed,
    };
  }

  return {
    file: {
      url: requestedUrl,
      requestedUrl,
      finalUrl,
      status,
      kind: parsed.kind,
      fetchedAt,
      redirectHops,
      childSitemaps: parsed.childSitemaps,
      entryCount: parsed.entries.size,
      parseDiagnostics: parsed.diagnostics,
    },
    parsed,
  };
}

async function fetchOneSitemap(
  url: string,
  signal?: AbortSignal,
): Promise<{ fetchResult: SafeFetchResult; fetchedAt: string }> {
  const fetchedAt = nowIso();
  const fetchResult = await safeFetch({
    url,
    includeBody: true,
    signal,
    limits: { maxBodyBytes: SITEMAP_LIMITS.maxBytes },
  });
  return { fetchResult, fetchedAt };
}

async function walkSitemap(
  url: string,
  depth: number,
  state: WalkState,
  signal?: AbortSignal,
): Promise<void> {
  const normalized = normalizeSitemapUrl(url);
  if (!normalized) {
    state.errors.push(
      captureError({
        code: 'sitemap-invalid-url',
        message: `Sitemap URL is not absolute/parseable: ${url}`,
        url,
      }),
    );
    return;
  }

  if (state.visited.has(normalized)) return;
  if (state.filesFetched >= SITEMAP_LIMITS.maxFiles) {
    state.truncated = true;
    state.errors.push(
      captureError({
        code: 'sitemap-file-limit',
        message: `Sitemap file limit of ${SITEMAP_LIMITS.maxFiles} reached.`,
        url: normalized,
      }),
    );
    return;
  }
  if (depth > SITEMAP_LIMITS.maxDepth) {
    state.truncated = true;
    state.errors.push(
      captureError({
        code: 'sitemap-depth-limit',
        message: `Sitemap index recursion depth exceeded ${SITEMAP_LIMITS.maxDepth}.`,
        url: normalized,
      }),
    );
    return;
  }

  state.visited.add(normalized);
  state.filesFetched += 1;

  const { fetchResult, fetchedAt } = await fetchOneSitemap(normalized, signal);
  const { file, parsed } = processSitemapFetch(normalized, fetchedAt, fetchResult);
  state.fetchedFiles.push(file);
  if (file.error) {
    state.errors.push(file.error);
    return;
  }
  if (!parsed?.ok) return;

  if (parsed.truncated) state.truncated = true;
  if (mergeEntries(state.entries, parsed.entries, parsed.diagnostics)) {
    state.truncated = true;
  }

  if (parsed.isIndex) {
    for (const child of parsed.childSitemaps) {
      if (state.truncated && state.filesFetched >= SITEMAP_LIMITS.maxFiles) break;
      await walkSitemap(child.loc, depth + 1, state, signal);
    }
  }
}

/**
 * Fetch one or more selected sitemap URLs with bounded index recursion.
 */
export async function fetchSitemap(
  rootUrls: string[],
  options?: { signal?: AbortSignal },
): Promise<SitemapFetchResult> {
  const validRoots = rootUrls
    .map((u) => normalizeSitemapUrl(u))
    .filter((u): u is string => u !== null);

  if (validRoots.length === 0) {
    const first = rootUrls[0] ?? '(none)';
    return {
      ok: false,
      source: SITEMAP_FETCH_SOURCE,
      rootUrls,
      error: captureError({
        code: 'sitemap-invalid-url',
        message: `No valid http(s) sitemap URLs to fetch (first input: ${first}).`,
        url: first,
      }),
      fetchedFiles: [],
      errors: [],
    };
  }

  const state: WalkState = {
    visited: new Set(),
    fetchedFiles: [],
    entries: new Map(),
    errors: [],
    filesFetched: 0,
    truncated: false,
  };

  for (const root of validRoots) {
    await walkSitemap(root, 0, state, options?.signal);
  }

  const hasEntries = state.entries.size > 0;
  const hasSuccessfulFile = state.fetchedFiles.some((f) => !f.error);

  if (!hasEntries && !hasSuccessfulFile && state.errors.length > 0) {
    return {
      ok: false,
      source: SITEMAP_FETCH_SOURCE,
      rootUrls: validRoots,
      error: state.errors[0],
      fetchedFiles: state.fetchedFiles,
      errors: state.errors,
    };
  }

  return {
    ok: true,
    source: SITEMAP_FETCH_SOURCE,
    rootUrls: validRoots,
    fetchedFiles: state.fetchedFiles,
    entries: state.entries,
    truncated: state.truncated,
    visitedUrls: [...state.visited],
    errors: state.errors,
  };
}
