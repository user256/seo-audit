import { SAFE_FETCH_HEADER_ALLOWLIST, SAFE_FETCH_LIMITS, type SafeFetchHeaderName } from './limits';

export function clipUrl(url: string, maxChars: number = SAFE_FETCH_LIMITS.maxUrlChars): string {
  if (url.length <= maxChars) return url;
  return url.slice(0, maxChars);
}

export function clipHeaderValue(
  value: string,
  maxChars: number = SAFE_FETCH_LIMITS.maxHeaderChars,
): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
}

/** Case-insensitive allowlist extract; duplicate names keep the first value. */
export function pickAllowedHeaders(
  headers: Headers,
  maxChars: number = SAFE_FETCH_LIMITS.maxHeaderChars,
): Partial<Record<SafeFetchHeaderName, string>> {
  const out: Partial<Record<SafeFetchHeaderName, string>> = {};
  for (const name of SAFE_FETCH_HEADER_ALLOWLIST) {
    const raw = headers.get(name);
    if (raw === null) continue;
    out[name] = clipHeaderValue(raw, maxChars);
  }
  return out;
}

export function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export function resolveRedirectUrl(fromUrl: string, location: string): string {
  return new URL(location, fromUrl).href;
}

export function mimeMatches(contentType: string | undefined, expectMime: string): boolean {
  if (!contentType) return false;
  const media = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  const expect = expectMime.trim().toLowerCase();
  return media === expect || media.startsWith(`${expect};`) || media.startsWith(`${expect}+`);
}
