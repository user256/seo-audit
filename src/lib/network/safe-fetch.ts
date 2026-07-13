import { createConcurrencyGate } from './concurrency';
import {
  clipUrl,
  isRedirectStatus,
  mimeMatches,
  pickAllowedHeaders,
  resolveRedirectUrl,
} from './headers';
import { SAFE_FETCH_LIMITS, type SafeFetchLimits } from './limits';
import type {
  RedirectHop,
  SafeFetchErr,
  SafeFetchMethod,
  SafeFetchOk,
  SafeFetchRequest,
  SafeFetchResult,
  SafeFetchTiming,
} from './types';

const gate = createConcurrencyGate(SAFE_FETCH_LIMITS.maxConcurrency);

let requestSeq = 0;
function nextRequestId(): string {
  requestSeq += 1;
  return `sf-${Date.now().toString(36)}-${requestSeq}`;
}

function mergeLimits(overrides?: Partial<SafeFetchLimits>): SafeFetchLimits {
  return { ...SAFE_FETCH_LIMITS, ...overrides };
}

function nowIso(): string {
  return new Date().toISOString();
}

function timingSince(startedAt: string, startedMs: number): SafeFetchTiming {
  const endedAt = nowIso();
  return {
    startedAt,
    endedAt,
    durationMs: Math.max(0, Date.now() - startedMs),
  };
}

const BASE_LIMITATIONS = [
  'Result is from an extension-initiated fetch, not the original browser navigation.',
  'Credentials, cookies, and ambient tab auth are omitted (credentials: omit).',
  'Referrer is omitted (referrerPolicy: no-referrer); cache mode is no-store.',
  'Response bodies are not retained unless includeBody is explicitly requested.',
];

function fail(
  partial: Omit<SafeFetchErr, 'ok' | 'source' | 'truncated' | 'limitations'> & {
    truncated?: boolean;
    limitations?: string[];
  },
): SafeFetchErr {
  return {
    ok: false,
    source: 'extension-fetch',
    truncated: partial.truncated ?? false,
    limitations: partial.limitations ?? BASE_LIMITATIONS,
    ...partial,
  };
}

async function readBodyCapped(
  response: Response,
  maxBytes: number,
  includeBody: boolean,
): Promise<{ text?: string; byteLength: number; truncated: boolean; overBudget: boolean }> {
  if (!includeBody) {
    // Still consume up to the cap so callers cannot accidentally leave a huge stream open,
    // then abandon the remainder without buffering it into the result.
    const reader = response.body?.getReader();
    if (!reader) {
      return { byteLength: 0, truncated: false, overBudget: false };
    }
    let byteLength = 0;
    let overBudget = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        overBudget = true;
        await reader.cancel();
        break;
      }
    }
    return { byteLength: Math.min(byteLength, maxBytes), truncated: overBudget, overBudget };
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text);
    if (bytes.byteLength > maxBytes) {
      const clipped = bytes.slice(0, maxBytes);
      return {
        text: new TextDecoder().decode(clipped),
        byteLength: maxBytes,
        truncated: true,
        overBudget: true,
      };
    }
    return { text, byteLength: bytes.byteLength, truncated: false, overBudget: false };
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const next = value;
    if (byteLength + next.byteLength > maxBytes) {
      const remain = maxBytes - byteLength;
      if (remain > 0) chunks.push(next.slice(0, remain));
      byteLength = maxBytes;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(next);
    byteLength += next.byteLength;
  }

  const merged = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    text: new TextDecoder().decode(merged),
    byteLength,
    truncated,
    overBudget: truncated,
  };
}

/**
 * Bounded HTTP(S) fetch for Sprint 2+ network features.
 * Always labelled `extension-fetch` — never browser-navigation evidence.
 */
export async function safeFetch(request: SafeFetchRequest): Promise<SafeFetchResult> {
  const method: SafeFetchMethod = request.method ?? 'GET';
  const requestId = request.requestId ?? nextRequestId();
  const limits = mergeLimits(request.limits);
  const startedMs = Date.now();
  const startedAt = nowIso();
  const requestedUrl = request.url;
  const hops: RedirectHop[] = [];

  let parsed: URL;
  try {
    parsed = new URL(requestedUrl);
  } catch {
    return fail({
      requestId,
      method,
      requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
      redirectHops: hops,
      timing: timingSince(startedAt, startedMs),
      code: 'invalid-url',
      message: `URL is not absolute/parseable: ${requestedUrl}`,
    });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return fail({
      requestId,
      method,
      requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
      redirectHops: hops,
      timing: timingSince(startedAt, startedMs),
      code: 'unsupported-scheme',
      message: `Only http(s) URLs may be fetched (received ${parsed.protocol}).`,
    });
  }

  const release = await gate.acquire();
  try {
    let currentUrl = parsed.href;

    for (let hop = 0; hop <= limits.maxRedirects; hop += 1) {
      if (request.signal?.aborted) {
        return fail({
          requestId,
          method,
          requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
          finalUrl: clipUrl(currentUrl, limits.maxUrlChars),
          redirectHops: hops,
          timing: timingSince(startedAt, startedMs),
          code: 'aborted',
          message: 'Fetch was cancelled.',
        });
      }

      const hopController = new AbortController();
      const timeoutId = setTimeout(() => hopController.abort(), limits.timeoutMs);
      const onCallerAbort = (): void => hopController.abort();
      if (request.signal) {
        if (request.signal.aborted) hopController.abort();
        else request.signal.addEventListener('abort', onCallerAbort, { once: true });
      }

      let response: Response;
      try {
        response = await fetch(currentUrl, {
          method,
          redirect: 'manual',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          cache: 'no-store',
          signal: hopController.signal,
        });
      } catch (err) {
        const aborted =
          hopController.signal.aborted ||
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.name === 'AbortError');
        const callerAborted = request.signal?.aborted === true;
        return fail({
          requestId,
          method,
          requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
          finalUrl: clipUrl(currentUrl, limits.maxUrlChars),
          redirectHops: hops,
          timing: timingSince(startedAt, startedMs),
          code: aborted ? (callerAborted ? 'aborted' : 'timeout') : 'network-error',
          message: aborted
            ? callerAborted
              ? 'Fetch was cancelled.'
              : `Fetch timed out after ${limits.timeoutMs}ms.`
            : err instanceof Error
              ? err.message
              : String(err),
        });
      } finally {
        clearTimeout(timeoutId);
        request.signal?.removeEventListener('abort', onCallerAbort);
      }

      // Some environments expose opaque redirects only via `type`.
      if ((response as Response).type === 'opaqueredirect') {
        return fail({
          requestId,
          method,
          requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
          finalUrl: clipUrl(currentUrl, limits.maxUrlChars),
          redirectHops: hops,
          timing: timingSince(startedAt, startedMs),
          code: 'redirect-opaque',
          message:
            'Redirect target was opaque to the extension fetch; hop details are unavailable.',
        });
      }

      if (isRedirectStatus(response.status)) {
        if (hop === limits.maxRedirects) {
          return fail({
            requestId,
            method,
            requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
            finalUrl: clipUrl(currentUrl, limits.maxUrlChars),
            status: response.status,
            redirectHops: hops,
            timing: timingSince(startedAt, startedMs),
            code: 'redirect-limit',
            message: `Redirect limit of ${limits.maxRedirects} hops exceeded.`,
          });
        }
        const location = response.headers.get('location');
        if (!location) {
          return fail({
            requestId,
            method,
            requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
            finalUrl: clipUrl(currentUrl, limits.maxUrlChars),
            status: response.status,
            redirectHops: hops,
            timing: timingSince(startedAt, startedMs),
            code: 'network-error',
            message: `Redirect response ${response.status} lacked a Location header.`,
          });
        }
        let nextUrl: string;
        try {
          nextUrl = resolveRedirectUrl(currentUrl, location);
        } catch {
          return fail({
            requestId,
            method,
            requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
            finalUrl: clipUrl(currentUrl, limits.maxUrlChars),
            status: response.status,
            redirectHops: hops,
            timing: timingSince(startedAt, startedMs),
            code: 'invalid-url',
            message: `Redirect Location was not resolvable: ${location}`,
          });
        }
        hops.push({
          fromUrl: clipUrl(currentUrl, limits.maxUrlChars),
          toUrl: clipUrl(nextUrl, limits.maxUrlChars),
          status: response.status,
        });
        currentUrl = nextUrl;
        continue;
      }

      const headers = pickAllowedHeaders(response.headers, limits.maxHeaderChars);
      const body = await readBodyCapped(
        response,
        limits.maxBodyBytes,
        Boolean(request.includeBody),
      );

      if (body.overBudget && !request.includeBody) {
        // Discarded oversized body without retaining it — still a successful metadata capture,
        // but flag truncation so callers know the stream was abandoned early.
      }

      const contentType = headers['content-type'];
      const mimeMatched =
        request.expectMime === undefined ? null : mimeMatches(contentType, request.expectMime);

      if (request.expectMime && mimeMatched === false) {
        return fail({
          requestId,
          method,
          requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
          finalUrl: clipUrl(currentUrl, limits.maxUrlChars),
          status: response.status,
          redirectHops: hops,
          timing: timingSince(startedAt, startedMs),
          code: 'mime-mismatch',
          message: `Expected MIME ${request.expectMime}; received ${contentType ?? '(missing Content-Type)'}.`,
          truncated: body.truncated,
        });
      }

      const ok: SafeFetchOk = {
        ok: true,
        source: 'extension-fetch',
        requestId,
        method,
        requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
        finalUrl: clipUrl(
          response.url && response.url !== '' ? response.url : currentUrl,
          limits.maxUrlChars,
        ),
        status: response.status,
        redirectHops: hops,
        headers,
        timing: timingSince(startedAt, startedMs),
        truncated: body.truncated,
        bodyByteLength: body.byteLength,
        mimeMatched,
        limitations: [
          ...BASE_LIMITATIONS,
          ...(body.truncated ? [`Response body truncated at ${limits.maxBodyBytes} bytes.`] : []),
        ],
      };
      if (request.includeBody && body.text !== undefined) {
        ok.bodyText = body.text;
      }
      return ok;
    }

    return fail({
      requestId,
      method,
      requestedUrl: clipUrl(requestedUrl, limits.maxUrlChars),
      finalUrl: clipUrl(currentUrl, limits.maxUrlChars),
      redirectHops: hops,
      timing: timingSince(startedAt, startedMs),
      code: 'redirect-limit',
      message: `Redirect limit of ${limits.maxRedirects} hops exceeded.`,
    });
  } finally {
    release();
  }
}

/** Test helper: expose the shared gate’s active count. */
export function safeFetchActiveCount(): number {
  return gate.activeCount();
}
