import type { RobotsProfileEvaluation } from '../robots/evaluate-robots';
import type { RedirectHop } from '../network/types';
import type { Evidence } from '../schemas/audit';
import type { FieldState } from '../../content/dom-collector';
import { fieldFromEvidence } from './types';
import { parseRobotsDirectiveTokens } from './robots-tokens';

/** Evidence source keys used by indexability reconciliation (Ticket 204). */
export const INDEXABILITY_SOURCES = {
  META_ROBOTS: 'meta[name=robots|googlebot]',
  CANONICAL: 'link[rel=canonical]',
  BROWSER_NAVIGATION: 'browser-navigation',
  ROBOTS_TXT: 'robots.txt',
  ROBOTS_EVALUATION: 'robots-evaluation',
  SITEMAP_MEMBERSHIP: 'sitemap-membership',
} as const;

export type BrowserNavigationEvidence = {
  statusCode: number;
  requestedUrl: string;
  finalUrl: string;
  redirectHops: RedirectHop[];
  headers: Record<string, string | undefined>;
  observedAt: string;
};

export type RobotsEvaluationEvidence = {
  url: string;
  path: string;
  profiles: Record<string, RobotsProfileEvaluation>;
  evaluatedAt: string;
  robotsTxtUrl?: string;
};

export type SitemapMembershipEvidence = {
  sitemapUrl: string;
  auditedUrl: string;
  present: boolean;
  matchedLoc?: string;
  fetchedAt: string;
};

export type RobotsDirectiveSignal = {
  source: string;
  label: string;
  tokens: string[];
  noindex: boolean;
  nofollow: boolean;
  none: boolean;
};

const REDIRECT_LOOP_SEVERITY_THRESHOLD = 5;

export function normalizeComparableUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    return parsed.href;
  } catch {
    return null;
  }
}

export function browserNavigationFromEvidence(
  evidence: Evidence | undefined,
): BrowserNavigationEvidence | null {
  if (!evidence || evidence.kind !== 'network') return null;
  const value = evidence.value;
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.finalUrl !== 'string' || typeof record.statusCode !== 'number') return null;
  return {
    statusCode: record.statusCode,
    requestedUrl: typeof record.requestedUrl === 'string' ? record.requestedUrl : record.finalUrl,
    finalUrl: record.finalUrl,
    redirectHops: Array.isArray(record.redirectHops) ? (record.redirectHops as RedirectHop[]) : [],
    headers:
      record.headers && typeof record.headers === 'object'
        ? (record.headers as Record<string, string | undefined>)
        : {},
    observedAt: typeof record.observedAt === 'string' ? record.observedAt : evidence.capturedAt,
  };
}

export function robotsEvaluationFromEvidence(
  evidence: Evidence | undefined,
): RobotsEvaluationEvidence | null {
  if (!evidence || evidence.kind !== 'robots') return null;
  const value = evidence.value;
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.url !== 'string' || typeof record.path !== 'string') return null;
  if (!record.profiles || typeof record.profiles !== 'object') return null;
  return {
    url: record.url,
    path: record.path,
    profiles: record.profiles as Record<string, RobotsProfileEvaluation>,
    evaluatedAt: typeof record.evaluatedAt === 'string' ? record.evaluatedAt : evidence.capturedAt,
    robotsTxtUrl: typeof record.robotsTxtUrl === 'string' ? record.robotsTxtUrl : undefined,
  };
}

export function sitemapMembershipFromEvidence(
  evidence: Evidence | undefined,
): SitemapMembershipEvidence | null {
  if (!evidence || evidence.kind !== 'sitemap') return null;
  const value = evidence.value;
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.auditedUrl !== 'string' || typeof record.present !== 'boolean') return null;
  return {
    sitemapUrl: typeof record.sitemapUrl === 'string' ? record.sitemapUrl : '(unknown)',
    auditedUrl: record.auditedUrl,
    present: record.present,
    matchedLoc: typeof record.matchedLoc === 'string' ? record.matchedLoc : undefined,
    fetchedAt: typeof record.fetchedAt === 'string' ? record.fetchedAt : evidence.capturedAt,
  };
}

function tokensFromMetaField(field: FieldState): string[] {
  const contents: string[] = [];
  if (field.state === 'present') {
    const value = field.value as { content?: string } | string;
    if (typeof value === 'string') contents.push(value);
    else if (value?.content) contents.push(value.content);
    else if (field.raw) contents.push(field.raw);
  }
  if (field.state === 'duplicate') {
    for (const item of field.values) {
      if (typeof item === 'string') contents.push(item);
      else if (item && typeof item === 'object' && 'content' in item) {
        contents.push(String((item as { content: unknown }).content ?? ''));
      }
    }
  }
  return contents.flatMap(parseRobotsDirectiveTokens);
}

function signalFromTokens(source: string, label: string, tokens: string[]): RobotsDirectiveSignal {
  const hasNone = tokens.includes('none');
  return {
    source,
    label,
    tokens,
    none: hasNone,
    noindex: hasNone || tokens.includes('noindex'),
    nofollow: hasNone || tokens.includes('nofollow'),
  };
}

export function metaRobotsSignalFromEvidence(
  evidence: Evidence | undefined,
): RobotsDirectiveSignal | null {
  const field = fieldFromEvidence(evidence);
  if (!field || (field.state !== 'present' && field.state !== 'duplicate')) return null;
  const tokens = tokensFromMetaField(field);
  if (tokens.length === 0) return null;
  return signalFromTokens(INDEXABILITY_SOURCES.META_ROBOTS, 'HTML meta robots', tokens);
}

export function headerRobotsSignalFromNavigation(
  navigation: BrowserNavigationEvidence | null,
): RobotsDirectiveSignal | null {
  if (!navigation) return null;
  const raw = navigation.headers['x-robots-tag'];
  if (!raw || raw.trim().length === 0) return null;
  const tokens = parseRobotsDirectiveTokens(raw);
  if (tokens.length === 0) return null;
  return signalFromTokens(
    INDEXABILITY_SOURCES.BROWSER_NAVIGATION,
    'X-Robots-Tag response header',
    tokens,
  );
}

export function canonicalAbsoluteFromEvidence(evidence: Evidence | undefined): string | null {
  const field = fieldFromEvidence(evidence);
  if (!field || field.state !== 'present') return null;
  const value = field.value as { absolute?: string } | undefined;
  return value?.absolute ?? null;
}

export type RedirectAnomaly =
  | { kind: 'loop'; url: string }
  | { kind: 'excessive'; hopCount: number };

export function detectRedirectAnomalies(navigation: BrowserNavigationEvidence): RedirectAnomaly[] {
  const anomalies: RedirectAnomaly[] = [];
  const visited = new Set<string>();
  for (const hop of navigation.redirectHops) {
    const from = normalizeComparableUrl(hop.fromUrl);
    const to = normalizeComparableUrl(hop.toUrl);
    if (from && visited.has(from)) {
      anomalies.push({ kind: 'loop', url: hop.fromUrl });
    }
    if (to && visited.has(to)) {
      anomalies.push({ kind: 'loop', url: hop.toUrl });
    }
    if (from) visited.add(from);
    if (to) visited.add(to);
  }
  const final = normalizeComparableUrl(navigation.finalUrl);
  if (final && visited.has(final)) {
    anomalies.push({ kind: 'loop', url: navigation.finalUrl });
  }
  if (navigation.redirectHops.length > REDIRECT_LOOP_SEVERITY_THRESHOLD) {
    anomalies.push({ kind: 'excessive', hopCount: navigation.redirectHops.length });
  }
  return anomalies;
}

export function isHtmlContentType(contentType: string | undefined): boolean | null {
  if (!contentType) return null;
  const media = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!media) return null;
  return media === 'text/html' || media.startsWith('text/html+');
}

export function robotsProfilesBlocked(
  evaluation: RobotsEvaluationEvidence,
): { profile: string; evaluation: RobotsProfileEvaluation }[] {
  return Object.entries(evaluation.profiles)
    .filter(([, value]) => value.crawlable === false)
    .map(([profile, value]) => ({ profile, evaluation: value }));
}
