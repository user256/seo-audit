/** Common same-origin sitemap locations probed when robots.txt has no Sitemap lines. */
export const COMMON_SITEMAP_PATHS = ['/sitemap.xml', '/sitemap_index.xml'] as const;

export type SitemapCandidateSource = 'robots' | 'common-path' | 'manual';

export type SitemapCandidate = {
  url: string;
  source: SitemapCandidateSource;
};

function parseHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeCandidateUrl(raw: string): string | null {
  const parsed = parseHttpUrl(raw.trim());
  return parsed ? parsed.href : null;
}

/**
 * Build deduplicated sitemap candidate URLs from robots directives, common
 * same-origin paths, and optional user-pasted URLs.
 */
export function discoverSitemapCandidates(options: {
  origin: string;
  robotsSitemaps?: string[];
  pastedUrls?: string[];
}): SitemapCandidate[] {
  const seen = new Set<string>();
  const candidates: SitemapCandidate[] = [];

  const add = (raw: string, source: SitemapCandidateSource): void => {
    const url = normalizeCandidateUrl(raw);
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push({ url, source });
  };

  const originParsed = parseHttpUrl(options.origin);
  const normalizedOrigin = originParsed?.origin ?? options.origin.replace(/\/$/, '');

  for (const sitemap of options.robotsSitemaps ?? []) {
    add(sitemap, 'robots');
  }

  if (originParsed) {
    for (const path of COMMON_SITEMAP_PATHS) {
      add(`${normalizedOrigin}${path}`, 'common-path');
    }
  }

  for (const pasted of options.pastedUrls ?? []) {
    add(pasted, 'manual');
  }

  return candidates;
}
