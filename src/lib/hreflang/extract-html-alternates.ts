import type { HreflangAlternateRef } from './compare-sources';

/**
 * Extract hreflang alternates from fetched HTML (link rel=alternate).
 * Resolves relative hrefs against the page final URL.
 */
export function extractHreflangAlternatesFromHtml(
  html: string,
  baseUrl: string,
): HreflangAlternateRef[] {
  if (typeof DOMParser !== 'undefined') {
    return extractWithDomParser(html, baseUrl);
  }
  return extractWithRegex(html, baseUrl);
}

function resolveHref(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function pushAlternate(
  out: HreflangAlternateRef[],
  hreflang: string,
  href: string,
  baseUrl: string,
): void {
  const lang = hreflang.trim().toLowerCase();
  const rawHref = href.trim();
  if (!lang || !rawHref) return;
  out.push({ hreflang: lang, href: resolveHref(rawHref, baseUrl) });
}

function extractWithDomParser(html: string, baseUrl: string): HreflangAlternateRef[] {
  const out: HreflangAlternateRef[] = [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = doc.querySelectorAll('link[rel="alternate" i][hreflang]');
  for (const node of nodes) {
    pushAlternate(
      out,
      node.getAttribute('hreflang') ?? '',
      node.getAttribute('href') ?? '',
      baseUrl,
    );
  }
  return out;
}

/** Regex fallback when DOMParser is unavailable (e.g. some test runners). */
function extractWithRegex(html: string, baseUrl: string): HreflangAlternateRef[] {
  const out: HreflangAlternateRef[] = [];
  const tagPattern = /<link\b[^>]*\brel\s*=\s*["']?alternate["']?[^>]*>/gi;
  for (const match of html.matchAll(tagPattern)) {
    const tag = match[0] ?? '';
    if (!/\bhreflang\b/i.test(tag)) continue;
    const hreflang = readAttr(tag, 'hreflang');
    const href = readAttr(tag, 'href');
    if (hreflang && href) pushAlternate(out, hreflang, href, baseUrl);
  }
  return out;
}

function readAttr(tag: string, name: string): string | null {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(pattern);
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? '').trim() || null;
}
