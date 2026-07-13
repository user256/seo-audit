import { normalizeHreflangUrl } from './normalize-url';

export type HreflangAlternateRef = {
  hreflang: string;
  href: string;
};

export type HreflangSourceMismatch = {
  hreflang: string;
  htmlHref: string;
  sitemapHref: string;
  htmlNormalized: string;
  sitemapNormalized: string;
};

/**
 * Compare captured HTML alternates with sitemap xhtml:link entries for the same
 * hreflang code. Mismatches are partial evidence only — not proof of live
 * reciprocity or that either annotation is wrong on the web.
 */
export function compareHreflangSources(
  htmlAlternates: readonly HreflangAlternateRef[],
  sitemapAlternates: readonly HreflangAlternateRef[],
): HreflangSourceMismatch[] {
  const sitemapByLang = new Map<string, HreflangAlternateRef>();
  for (const alt of sitemapAlternates) {
    const key = alt.hreflang.toLowerCase();
    if (!sitemapByLang.has(key)) sitemapByLang.set(key, alt);
  }

  const mismatches: HreflangSourceMismatch[] = [];
  for (const html of htmlAlternates) {
    const key = html.hreflang.toLowerCase();
    const sitemap = sitemapByLang.get(key);
    if (!sitemap) continue;
    const htmlNormalized = normalizeHreflangUrl(html.href);
    const sitemapNormalized = normalizeHreflangUrl(sitemap.href);
    if (htmlNormalized !== sitemapNormalized) {
      mismatches.push({
        hreflang: key,
        htmlHref: html.href,
        sitemapHref: sitemap.href,
        htmlNormalized,
        sitemapNormalized,
      });
    }
  }
  return mismatches;
}
