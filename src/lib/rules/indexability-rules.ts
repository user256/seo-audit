import type { Finding } from '../schemas/audit';
import {
  INDEXABILITY_SOURCES,
  browserNavigationFromEvidence,
  canonicalAbsoluteFromEvidence,
  detectRedirectAnomalies,
  headerRobotsSignalFromNavigation,
  isHtmlContentType,
  metaRobotsSignalFromEvidence,
  normalizeComparableUrl,
  robotsEvaluationFromEvidence,
  robotsProfilesBlocked,
  sitemapMembershipFromEvidence,
  type RobotsDirectiveSignal,
} from './indexability-evidence';
import { makeFinding, type Rule } from './types';

const REF = {
  robots: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
  canonical:
    'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
  redirects: 'https://developers.google.com/search/docs/crawling-indexing/301-redirects',
  contentType: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type',
  robotsTxt: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
  sitemap: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview',
} as const;

function formatSignalSources(signals: RobotsDirectiveSignal[]): string {
  return signals.map((signal) => `${signal.label} (${signal.source})`).join('; ');
}

function noindexSources(signals: RobotsDirectiveSignal[]): RobotsDirectiveSignal[] {
  return signals.filter((signal) => signal.noindex);
}

/** Observed noindex in HTML meta and/or X-Robots-Tag (captured sources only). */
export const indexabilityNoindexSignal: Rule = {
  id: 'indexability-noindex-signal',
  run(ctx) {
    const metaEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.META_ROBOTS);
    const navEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.BROWSER_NAVIGATION);
    const metaSignal = metaRobotsSignalFromEvidence(metaEvidence);
    const nav = browserNavigationFromEvidence(navEvidence);
    const headerSignal = headerRobotsSignalFromNavigation(nav);
    const signals = [metaSignal, headerSignal].filter(
      (signal): signal is RobotsDirectiveSignal => signal !== null,
    );
    if (signals.length === 0) return [];

    const blocking = noindexSources(signals);
    if (blocking.length === 0) return [];

    const evidenceIds = [metaEvidence, navEvidence]
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
      .map((item) => item.id);

    const observed = blocking.map((signal) => `${signal.label}: noindex observed`).join('; ');

    return [
      makeFinding({
        ruleId: 'indexability-noindex-signal',
        severity: 'warning',
        category: 'indexability',
        affectedUrl: ctx.pageUrl,
        description: `Observed noindex signal from ${formatSignalSources(blocking)}. ${observed}. This audit reports captured signals only, not a search engine indexing decision.`,
        evidenceIds,
        recommendation:
          'Remove noindex/none from captured sources if the URL should be eligible for indexing.',
        sourceRef: REF.robots,
        capturedAt: ctx.capturedAt,
      }),
    ];
  },
};

/** Conflicting robots directives between captured HTML meta and X-Robots-Tag. */
export const indexabilityRobotsConflict: Rule = {
  id: 'indexability-robots-conflict',
  run(ctx) {
    const metaEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.META_ROBOTS);
    const navEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.BROWSER_NAVIGATION);
    const metaSignal = metaRobotsSignalFromEvidence(metaEvidence);
    const nav = browserNavigationFromEvidence(navEvidence);
    const headerSignal = headerRobotsSignalFromNavigation(nav);
    if (!metaSignal || !headerSignal) return [];

    const conflicts: string[] = [];
    if (metaSignal.noindex !== headerSignal.noindex) {
      conflicts.push(
        `noindex disagrees (meta: ${metaSignal.noindex ? 'present' : 'absent'}; header: ${headerSignal.noindex ? 'present' : 'absent'})`,
      );
    }
    if (metaSignal.nofollow !== headerSignal.nofollow) {
      conflicts.push(
        `nofollow disagrees (meta: ${metaSignal.nofollow ? 'present' : 'absent'}; header: ${headerSignal.nofollow ? 'present' : 'absent'})`,
      );
    }
    if (conflicts.length === 0) return [];

    return [
      makeFinding({
        ruleId: 'indexability-robots-conflict',
        severity: 'error',
        category: 'indexability',
        affectedUrl: ctx.pageUrl,
        description: `Conflicting robots directives observed across HTML meta robots (${INDEXABILITY_SOURCES.META_ROBOTS}) and X-Robots-Tag (${INDEXABILITY_SOURCES.BROWSER_NAVIGATION}): ${conflicts.join('; ')}.`,
        evidenceIds: [metaEvidence!.id, navEvidence!.id],
        recommendation:
          'Align meta robots and X-Robots-Tag so crawlers receive consistent index/follow signals.',
        sourceRef: REF.robots,
        capturedAt: ctx.capturedAt,
      }),
    ];
  },
};

/** Audited URL path blocked by captured robots.txt evaluation evidence. */
export const indexabilityRobotsBlocked: Rule = {
  id: 'indexability-robots-blocked',
  run(ctx) {
    const evaluationEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.ROBOTS_EVALUATION);
    const evaluation = robotsEvaluationFromEvidence(evaluationEvidence);
    if (!evaluation) return [];

    const blocked = robotsProfilesBlocked(evaluation);
    if (blocked.length === 0) return [];

    const profileSummary = blocked
      .map(({ profile, evaluation: profileEval }) =>
        `${profile}: disallowed (${profileEval.matchedRule?.kind ?? 'rule'} ${profileEval.matchedRule?.pattern ?? ''})`.trim(),
      )
      .join('; ');

    return [
      makeFinding({
        ruleId: 'indexability-robots-blocked',
        severity: 'warning',
        category: 'indexability',
        affectedUrl: ctx.pageUrl,
        description: `robots.txt evaluation (${INDEXABILITY_SOURCES.ROBOTS_EVALUATION}) observed crawl blocking for ${evaluation.path}: ${profileSummary}. This is an observed robots.txt signal, not a confirmed search-engine indexing outcome.`,
        evidenceIds: [evaluationEvidence!.id],
        recommendation:
          'Adjust robots.txt or URL path if crawlers should be allowed to fetch this URL.',
        sourceRef: REF.robotsTxt,
        capturedAt: ctx.capturedAt,
      }),
    ];
  },
};

/** Canonical target differs from observed browser-navigation final URL. */
export const indexabilityCanonicalMismatch: Rule = {
  id: 'indexability-canonical-mismatch',
  run(ctx) {
    const canonicalEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.CANONICAL);
    const navEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.BROWSER_NAVIGATION);
    const canonicalAbsolute = canonicalAbsoluteFromEvidence(canonicalEvidence);
    const nav = browserNavigationFromEvidence(navEvidence);
    if (!canonicalAbsolute || !nav) return [];

    const canonicalNorm = normalizeComparableUrl(canonicalAbsolute);
    const finalNorm = normalizeComparableUrl(nav.finalUrl);
    if (!canonicalNorm || !finalNorm || canonicalNorm === finalNorm) return [];

    return [
      makeFinding({
        ruleId: 'indexability-canonical-mismatch',
        severity: 'warning',
        category: 'indexability',
        affectedUrl: ctx.pageUrl,
        description: `Canonical target (${canonicalAbsolute} from ${INDEXABILITY_SOURCES.CANONICAL}) does not match the observed browser-navigation final URL (${nav.finalUrl} from ${INDEXABILITY_SOURCES.BROWSER_NAVIGATION}).`,
        evidenceIds: [canonicalEvidence!.id, navEvidence!.id],
        recommendation:
          'Point rel=canonical at the preferred URL or redirect the audited URL to match the declared canonical.',
        sourceRef: REF.canonical,
        capturedAt: ctx.capturedAt,
      }),
    ];
  },
};

/** Redirect loops or excessive hops in observed browser navigation. */
export const indexabilityRedirectAnomaly: Rule = {
  id: 'indexability-redirect-anomaly',
  run(ctx) {
    const navEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.BROWSER_NAVIGATION);
    const nav = browserNavigationFromEvidence(navEvidence);
    if (!nav) return [];

    const anomalies = detectRedirectAnomalies(nav);
    if (anomalies.length === 0) return [];

    const findings: Finding[] = [];
    for (const anomaly of anomalies) {
      if (anomaly.kind === 'loop') {
        findings.push(
          makeFinding({
            ruleId: 'indexability-redirect-loop',
            severity: 'error',
            category: 'indexability',
            affectedUrl: ctx.pageUrl,
            description: `Observed redirect loop in browser-navigation evidence (${INDEXABILITY_SOURCES.BROWSER_NAVIGATION}): URL ${anomaly.url} repeats in the redirect chain.`,
            evidenceIds: [navEvidence!.id],
            recommendation: 'Fix redirect chains so each hop advances to a distinct URL.',
            sourceRef: REF.redirects,
            capturedAt: ctx.capturedAt,
          }),
        );
      }
      if (anomaly.kind === 'excessive') {
        findings.push(
          makeFinding({
            ruleId: 'indexability-redirect-excessive',
            severity: 'warning',
            category: 'indexability',
            affectedUrl: ctx.pageUrl,
            description: `Observed ${anomaly.hopCount} redirect hop(s) in browser-navigation evidence (${INDEXABILITY_SOURCES.BROWSER_NAVIGATION}); long chains can dilute crawl signals.`,
            evidenceIds: [navEvidence!.id],
            recommendation:
              'Reduce redirect hops where possible (prefer direct 301/308 to the final URL).',
            sourceRef: REF.redirects,
            capturedAt: ctx.capturedAt,
          }),
        );
      }
    }
    return findings;
  },
};

/** Non-HTML Content-Type on observed browser navigation. */
export const indexabilityNonHtmlContent: Rule = {
  id: 'indexability-non-html-content',
  run(ctx) {
    const navEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.BROWSER_NAVIGATION);
    const nav = browserNavigationFromEvidence(navEvidence);
    if (!nav) return [];

    const contentType = nav.headers['content-type'];
    const html = isHtmlContentType(contentType);
    if (html === null || html === true) return [];

    return [
      makeFinding({
        ruleId: 'indexability-non-html-content',
        severity: 'warning',
        category: 'indexability',
        affectedUrl: ctx.pageUrl,
        description: `Observed Content-Type “${contentType}” on browser-navigation (${INDEXABILITY_SOURCES.BROWSER_NAVIGATION}) is not HTML; indexing signals may differ from HTML documents.`,
        evidenceIds: [navEvidence!.id],
        recommendation:
          'Serve HTML for indexable pages or confirm the audited URL is the intended non-HTML resource.',
        sourceRef: REF.contentType,
        capturedAt: ctx.capturedAt,
      }),
    ];
  },
};

/** Sitemap lists the audited URL while robots.txt evaluation blocks crawling. */
export const indexabilitySitemapRobotsBlocked: Rule = {
  id: 'indexability-sitemap-robots-blocked',
  run(ctx) {
    const membershipEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.SITEMAP_MEMBERSHIP);
    const evaluationEvidence = ctx.evidenceBySource.get(INDEXABILITY_SOURCES.ROBOTS_EVALUATION);
    const membership = sitemapMembershipFromEvidence(membershipEvidence);
    const evaluation = robotsEvaluationFromEvidence(evaluationEvidence);
    if (!membership?.present || !evaluation) return [];

    const blocked = robotsProfilesBlocked(evaluation);
    if (blocked.length === 0) return [];

    return [
      makeFinding({
        ruleId: 'indexability-sitemap-robots-blocked',
        severity: 'warning',
        category: 'indexability',
        affectedUrl: ctx.pageUrl,
        description: `Sitemap membership (${INDEXABILITY_SOURCES.SITEMAP_MEMBERSHIP}) lists ${membership.matchedLoc ?? membership.auditedUrl} while robots.txt evaluation (${INDEXABILITY_SOURCES.ROBOTS_EVALUATION}) observed crawl blocking for ${evaluation.path}.`,
        evidenceIds: [membershipEvidence!.id, evaluationEvidence!.id],
        recommendation:
          'Remove blocked URLs from the sitemap or allow crawling in robots.txt so declared URL sets match crawl policy.',
        sourceRef: REF.sitemap,
        capturedAt: ctx.capturedAt,
      }),
    ];
  },
};

/** All Ticket 204 reconciliation rules in deterministic order. */
export const INDEXABILITY_RULES: readonly Rule[] = [
  indexabilityNoindexSignal,
  indexabilityRobotsConflict,
  indexabilityRobotsBlocked,
  indexabilityCanonicalMismatch,
  indexabilityRedirectAnomaly,
  indexabilityNonHtmlContent,
  indexabilitySitemapRobotsBlocked,
];
