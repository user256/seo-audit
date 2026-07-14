/**
 * Build session evidence from robots / sitemap captures so indexability and
 * hreflang rules receive the shapes they already expect (Ticket 204 / 207).
 * Pure helpers — no network.
 */
import { SITEMAP_HREFLANG_SOURCE, type SitemapHreflangEvidence } from '../hreflang/rules';
import type { Evidence } from '../schemas/audit';
import { evaluateRobotsForUrl, type RobotsPathEvaluation } from '../robots/evaluate-robots';
import type { RobotsFetchSuccess } from '../robots/fetch-robots';
import {
  INDEXABILITY_SOURCES,
  type RobotsEvaluationEvidence,
  type SitemapMembershipEvidence,
} from '../rules/indexability-evidence';
import { sitemapContainsAuditedUrl, type SitemapFetchSuccess } from '../sitemap/fetch-sitemap';

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Compact robots.txt summary (directives / Sitemap: lines). */
export function robotsSummaryEvidence(
  robots: RobotsFetchSuccess,
  capturedAt = robots.fetchedAt,
): Evidence {
  return {
    id: newId('ev'),
    kind: 'robots',
    source: INDEXABILITY_SOURCES.ROBOTS_TXT,
    value: {
      origin: robots.origin,
      finalUrl: robots.finalUrl,
      status: robots.status,
      fetchedAt: robots.fetchedAt,
      sitemaps: robots.parsed.sitemaps,
      groupCount: robots.parsed.groups.length,
    },
    capturedAt,
  };
}

/** Path evaluation for Googlebot / `*` — required by indexability-robots-blocked. */
export function robotsEvaluationEvidenceFromFetch(
  robots: RobotsFetchSuccess,
  auditedUrl: string,
  capturedAt = robots.fetchedAt,
): Evidence | null {
  const evaluation = evaluateRobotsForUrl(robots.parsed, auditedUrl);
  if (!evaluation.ok) return null;
  return robotsEvaluationEvidenceFromPath(evaluation, auditedUrl, robots.finalUrl, capturedAt);
}

export function robotsEvaluationEvidenceFromPath(
  evaluation: RobotsPathEvaluation,
  auditedUrl: string,
  robotsTxtUrl: string,
  capturedAt: string,
): Evidence {
  const value: RobotsEvaluationEvidence = {
    url: auditedUrl,
    path: evaluation.path,
    profiles: evaluation.profiles,
    evaluatedAt: capturedAt,
    robotsTxtUrl,
  };
  return {
    id: newId('ev'),
    kind: 'robots',
    source: INDEXABILITY_SOURCES.ROBOTS_EVALUATION,
    value,
    capturedAt,
  };
}

/**
 * Prefer the first sitemap that lists the audited URL; otherwise the first
 * successfully parsed root that returned any entries.
 */
export function sitemapMembershipEvidenceFromFetch(
  sitemap: SitemapFetchSuccess,
  auditedUrl: string,
  capturedAt = new Date().toISOString(),
): Evidence {
  const membership = sitemapContainsAuditedUrl(sitemap.entries, auditedUrl);
  let sitemapUrl = sitemap.rootUrls[0] ?? '(unknown)';
  if (membership.present && membership.matchedLoc) {
    const entry = membership.entry;
    const owningFile = sitemap.fetchedFiles.find(
      (file) => file.kind === 'urlset' && !file.error && file.entryCount > 0,
    );
    if (owningFile) sitemapUrl = owningFile.finalUrl || owningFile.url;
    void entry;
  } else if (sitemap.fetchedFiles.length > 0) {
    const firstOk = sitemap.fetchedFiles.find((file) => !file.error);
    if (firstOk) sitemapUrl = firstOk.finalUrl || firstOk.url;
  }

  const value: SitemapMembershipEvidence = {
    sitemapUrl,
    auditedUrl,
    present: membership.present,
    matchedLoc: membership.matchedLoc,
    fetchedAt: capturedAt,
  };
  return {
    id: newId('ev'),
    kind: 'sitemap',
    source: INDEXABILITY_SOURCES.SITEMAP_MEMBERSHIP,
    value,
    capturedAt,
  };
}

/**
 * xhtml:link alternates for the audited URL (when listed), else empty → null.
 */
export function sitemapHreflangEvidenceFromFetch(
  sitemap: SitemapFetchSuccess,
  auditedUrl: string,
  capturedAt = new Date().toISOString(),
): Evidence | null {
  const membership = sitemapContainsAuditedUrl(sitemap.entries, auditedUrl);
  if (!membership.present || !membership.entry) return null;
  const alternates = membership.entry.alternates
    .filter((alt) => alt.hreflang && alt.href)
    .map((alt) => ({ hreflang: alt.hreflang.toLowerCase(), href: alt.href }));
  if (alternates.length === 0) return null;
  const value: SitemapHreflangEvidence = {
    loc: membership.matchedLoc ?? membership.entry.loc,
    alternates,
  };
  return {
    id: newId('ev'),
    kind: 'sitemap',
    source: SITEMAP_HREFLANG_SOURCE,
    value,
    capturedAt,
  };
}

/** All crawl evidence attachable from a successful robots + optional sitemap capture. */
export function buildCrawlNetworkEvidence(input: {
  auditedUrl: string;
  robots?: RobotsFetchSuccess | null;
  sitemap?: SitemapFetchSuccess | null;
  capturedAt?: string;
}): Evidence[] {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const out: Evidence[] = [];
  if (input.robots) {
    out.push(robotsSummaryEvidence(input.robots, capturedAt));
    const evaluation = robotsEvaluationEvidenceFromFetch(
      input.robots,
      input.auditedUrl,
      capturedAt,
    );
    if (evaluation) out.push(evaluation);
  }
  if (input.sitemap) {
    out.push(sitemapMembershipEvidenceFromFetch(input.sitemap, input.auditedUrl, capturedAt));
    const hreflang = sitemapHreflangEvidenceFromFetch(input.sitemap, input.auditedUrl, capturedAt);
    if (hreflang) out.push(hreflang);
  }
  return out;
}
