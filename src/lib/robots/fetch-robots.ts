import { safeFetch } from '../network/safe-fetch';
import type { RedirectHop, SafeFetchResult } from '../network/types';
import {
  parseRobotsText,
  ROBOTS_PARSE_LIMITS,
  type RobotsParseResult,
  type RobotsParseSuccess,
} from './parse-robots';

export const ROBOTS_FETCH_SOURCE = 'extension-fetch' as const;

export type RobotsCaptureErrorCode =
  | 'robots-fetch-failed'
  | 'robots-fetch-non-200'
  | 'robots-fetch-oversized'
  | 'robots-fetch-html'
  | 'robots-fetch-empty'
  | 'robots-parse-failed'
  | 'robots-invalid-origin';

export type RobotsCaptureError = {
  code: RobotsCaptureErrorCode;
  source: typeof ROBOTS_FETCH_SOURCE;
  message: string;
  url: string;
  capturedAt: string;
  status?: number;
  requestedUrl?: string;
  finalUrl?: string;
  redirectHops?: RedirectHop[];
};

export type RobotsFetchSuccess = {
  ok: true;
  source: typeof ROBOTS_FETCH_SOURCE;
  origin: string;
  requestedUrl: string;
  finalUrl: string;
  status: number;
  fetchedAt: string;
  redirectHops: RedirectHop[];
  truncated: boolean;
  bodyText: string;
  parsed: RobotsParseSuccess;
};

export type RobotsFetchFailure = {
  ok: false;
  source: typeof ROBOTS_FETCH_SOURCE;
  origin: string;
  error: RobotsCaptureError;
  parseResult?: RobotsParseResult;
};

export type RobotsFetchResult = RobotsFetchSuccess | RobotsFetchFailure;

export type RobotsSessionCacheEntry = RobotsFetchResult & {
  fetchedAt: string;
};

type RobotsSessionCache = Map<string, RobotsSessionCacheEntry>;

let sessionCache: RobotsSessionCache = new Map();

function nowIso(): string {
  return new Date().toISOString();
}

function robotsTxtUrlForOrigin(origin: string): string {
  return `${origin}/robots.txt`;
}

function isHtmlRobotsResponse(contentType: string | undefined, body: string): boolean {
  const media = contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (media === 'text/html' || media.startsWith('text/html+')) return true;
  const head = body.trimStart().slice(0, 256).toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html');
}

function mapSafeFetchFailure(
  requestedUrl: string,
  result: Extract<SafeFetchResult, { ok: false }>,
  capturedAt: string,
): RobotsCaptureError {
  return {
    code: 'robots-fetch-failed',
    source: ROBOTS_FETCH_SOURCE,
    message: result.message,
    url: requestedUrl,
    capturedAt,
    status: result.status,
    requestedUrl: result.requestedUrl,
    finalUrl: result.finalUrl,
    redirectHops: result.redirectHops,
  };
}

function captureError(
  partial: Omit<RobotsCaptureError, 'source' | 'capturedAt'> & { capturedAt?: string },
): RobotsCaptureError {
  return {
    source: ROBOTS_FETCH_SOURCE,
    capturedAt: partial.capturedAt ?? nowIso(),
    ...partial,
  };
}

/** Reset per-session robots cache (tests and new audit sessions). */
export function clearRobotsSessionCache(): void {
  sessionCache = new Map();
}

/** Read a cached robots fetch for an origin without triggering a fetch. */
export function getCachedRobotsForOrigin(origin: string): RobotsSessionCacheEntry | undefined {
  return sessionCache.get(origin);
}

export function parseRobotsOrigin(
  origin: string,
): { ok: true; origin: string } | { ok: false; message: string } {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        message: `Only http(s) origins are supported (received ${parsed.protocol}).`,
      };
    }
    return { ok: true, origin: parsed.origin };
  } catch {
    return { ok: false, message: `Origin is not absolute/parseable: ${origin}` };
  }
}

/**
 * Fetch and parse `{origin}/robots.txt` via safeFetch.
 * Results are cached per origin for the current session.
 */
export async function fetchRobotsForOrigin(
  origin: string,
  options?: { bypassCache?: boolean; signal?: AbortSignal },
): Promise<RobotsFetchResult> {
  const parsedOrigin = parseRobotsOrigin(origin);
  if (!parsedOrigin.ok) {
    const requestedUrl = robotsTxtUrlForOrigin(origin);
    return {
      ok: false,
      source: ROBOTS_FETCH_SOURCE,
      origin,
      error: captureError({
        code: 'robots-invalid-origin',
        message: parsedOrigin.message,
        url: requestedUrl,
      }),
    };
  }

  const normalizedOrigin = parsedOrigin.origin;
  if (!options?.bypassCache) {
    const cached = sessionCache.get(normalizedOrigin);
    if (cached) return cached;
  }

  const requestedUrl = robotsTxtUrlForOrigin(normalizedOrigin);
  const fetchedAt = nowIso();

  const fetchResult = await safeFetch({
    url: requestedUrl,
    includeBody: true,
    signal: options?.signal,
    limits: { maxBodyBytes: ROBOTS_PARSE_LIMITS.maxBodyBytes },
  });

  const result = processRobotsFetch(normalizedOrigin, requestedUrl, fetchedAt, fetchResult);
  const entry: RobotsSessionCacheEntry = { ...result, fetchedAt };
  sessionCache.set(normalizedOrigin, entry);
  return entry;
}

/** Pure post-fetch processor — shared by fetchRobotsForOrigin and tests. */
export function processRobotsFetch(
  origin: string,
  requestedUrl: string,
  fetchedAt: string,
  fetchResult: SafeFetchResult,
): RobotsFetchResult {
  if (!fetchResult.ok) {
    return {
      ok: false,
      source: ROBOTS_FETCH_SOURCE,
      origin,
      error: mapSafeFetchFailure(requestedUrl, fetchResult, fetchedAt),
    };
  }

  const { status, finalUrl, redirectHops, truncated, bodyText = '', headers } = fetchResult;

  if (status !== 200) {
    return {
      ok: false,
      source: ROBOTS_FETCH_SOURCE,
      origin,
      error: captureError({
        code: 'robots-fetch-non-200',
        message: `robots.txt returned HTTP ${status}.`,
        url: requestedUrl,
        capturedAt: fetchedAt,
        status,
        requestedUrl,
        finalUrl,
        redirectHops,
      }),
    };
  }

  if (truncated) {
    return {
      ok: false,
      source: ROBOTS_FETCH_SOURCE,
      origin,
      error: captureError({
        code: 'robots-fetch-oversized',
        message: `robots.txt exceeded ${ROBOTS_PARSE_LIMITS.maxBodyBytes} bytes.`,
        url: requestedUrl,
        capturedAt: fetchedAt,
        status,
        requestedUrl,
        finalUrl,
        redirectHops,
      }),
    };
  }

  if (isHtmlRobotsResponse(headers['content-type'], bodyText)) {
    return {
      ok: false,
      source: ROBOTS_FETCH_SOURCE,
      origin,
      error: captureError({
        code: 'robots-fetch-html',
        message: 'robots.txt response looked like HTML rather than plain text.',
        url: requestedUrl,
        capturedAt: fetchedAt,
        status,
        requestedUrl,
        finalUrl,
        redirectHops,
      }),
    };
  }

  const parseResult = parseRobotsText(bodyText);
  if (!parseResult.ok) {
    return {
      ok: false,
      source: ROBOTS_FETCH_SOURCE,
      origin,
      error: captureError({
        code: 'robots-parse-failed',
        message: parseResult.error,
        url: requestedUrl,
        capturedAt: fetchedAt,
        status,
        requestedUrl,
        finalUrl,
        redirectHops,
      }),
      parseResult,
    };
  }

  return {
    ok: true,
    source: ROBOTS_FETCH_SOURCE,
    origin,
    requestedUrl,
    finalUrl,
    status,
    fetchedAt,
    redirectHops,
    truncated: false,
    bodyText,
    parsed: parseResult,
  };
}
