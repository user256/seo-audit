/**
 * Normalise an absolute URL for hreflang membership comparison: strip trailing
 * slash from the path; keep origin + path + search (no hash).
 */
export function normalizeHreflangUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return parsed.origin + path + parsed.search;
  } catch {
    return url;
  }
}

/** Whether href is relative (not absolute http(s) and not protocol-relative). */
export function isRelativeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed === '') return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  return !trimmed.startsWith('//');
}
