/**
 * Normalise a final URL for grouping variant outcomes (path trailing slash stripped).
 */
export function normalizeFinalUrl(url: string): string {
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
