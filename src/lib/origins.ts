/**
 * URL eligibility and origin-pattern helpers for the permission boundary.
 * All origin access must go through these helpers — do not invent ad-hoc patterns.
 */

const UNSUPPORTED_SCHEMES = new Set([
  'chrome:',
  'chrome-extension:',
  'chrome-search:',
  'chrome-untrusted:',
  'devtools:',
  'edge:',
  'about:',
  'data:',
  'blob:',
  'file:',
  'view-source:',
  'javascript:',
]);

export type UrlEligibility =
  | { ok: true; url: string; origin: string; pattern: string }
  | { ok: false; url: string | undefined; reason: string };

export function evaluateUrl(rawUrl: string | undefined): UrlEligibility {
  if (!rawUrl) {
    return {
      ok: false,
      url: undefined,
      reason: 'No URL is available for the active tab.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      url: rawUrl,
      reason: 'The active tab URL could not be parsed.',
    };
  }

  if (UNSUPPORTED_SCHEMES.has(parsed.protocol)) {
    return {
      ok: false,
      url: rawUrl,
      reason: `${parsed.protocol}// URLs cannot be audited. Open an http(s) page instead.`,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      url: rawUrl,
      reason: `Unsupported URL scheme “${parsed.protocol}”. Only http and https pages can be audited.`,
    };
  }

  if (!parsed.hostname) {
    return {
      ok: false,
      url: rawUrl,
      reason: 'The active tab URL has no hostname.',
    };
  }

  const origin = parsed.origin;
  const pattern = `${origin}/*`;
  return { ok: true, url: rawUrl, origin, pattern };
}

export function isAuditableHttpUrl(rawUrl: string | undefined): boolean {
  return evaluateUrl(rawUrl).ok;
}
