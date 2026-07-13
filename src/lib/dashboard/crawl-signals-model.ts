import type { NavigationObservationStatus } from '../network/types';
import type { HreflangClusterValidationResult } from '../hreflang/cluster-validate';
import {
  CSS_JS_COMPARISON_LIMITS,
  type CssJsComparisonLimits,
  type CssJsComparisonResult,
} from '../css-js-compare';
import {
  DEFAULT_VARIANT_KIND_OPTIONS,
  VARIANT_TEST_LIMITS,
  type VariantKindOptions,
  type VariantTestLimits,
  type VariantTestRunResult,
} from '../variants';
import {
  SOFT_404_PROBE_LIMITS,
  type Soft404ProbeLimits,
  type Soft404ProbeResult,
} from '../soft-404';
import {
  HREFLANG_CLUSTER_DISPLAY_LIMITS,
  HREFLANG_CLUSTER_LIMITS,
  type HreflangClusterLimits,
} from '../hreflang/cluster-limits';
import { evaluateRobotsForUrl, type RobotsProfileEvaluation } from '../robots/evaluate-robots';
import type { RobotsCaptureError, RobotsFetchResult } from '../robots/fetch-robots';
import { discoverSitemapCandidates, type SitemapCandidate } from '../sitemap/discover';
import { SITEMAP_LIMITS } from '../sitemap/limits';
import {
  sitemapContainsAuditedUrl,
  type SitemapCaptureError,
  type SitemapFetchResult,
} from '../sitemap/fetch-sitemap';
import type { SignalAvailability } from './model';

export const CRAWL_SIGNALS_DISPLAY_LIMITS = {
  maxRedirectHops: 12,
  maxSitemapCandidates: 15,
  maxFetchedFiles: 10,
  maxErrors: 5,
  maxHeaderEntries: 8,
  maxSitemapDirectives: 10,
} as const;

export type CrawlSignalError = {
  code: string;
  message: string;
  capturedAt?: string;
  url?: string;
};

export type HeaderValueState = 'present' | 'absent' | 'unavailable';

export type NavigationSignalsPanel = {
  availability: SignalAvailability;
  sourceUrl: string | null;
  capturedAt: string | null;
  statusCode: number | null;
  redirectHops: { url: string; status: number | null }[];
  redirectTotal: number;
  redirectTruncated: boolean;
  headerEntries: { name: string; value: string }[];
  headerTotal: number;
  headersTruncated: boolean;
  xRobotsTag: { state: HeaderValueState; value: string };
  detail: string;
};

export type ProfileDecisionRow = {
  profile: string;
  crawlable: boolean;
  reason: string;
  matchedRule: string | null;
};

export type RobotsAvailability = SignalAvailability | 'error';

export type RobotsSignalsPanel = {
  availability: RobotsAvailability;
  fetchState: 'idle' | 'busy';
  requestedUrl: string | null;
  finalUrl: string | null;
  fetchedAt: string | null;
  status: number | null;
  redirectHops: { fromUrl: string; toUrl: string; status: number }[];
  redirectTotal: number;
  redirectTruncated: boolean;
  googlebot: ProfileDecisionRow | null;
  wildcard: ProfileDecisionRow | null;
  sitemapDirectives: string[];
  sitemapDirectivesTotal: number;
  sitemapDirectivesTruncated: boolean;
  error: CrawlSignalError | null;
  detail: string;
};

export type SitemapMembershipState = 'unavailable' | 'present' | 'absent';

export type SitemapAvailability = SignalAvailability | 'error' | 'absent';

export type SitemapSignalsPanel = {
  availability: SitemapAvailability;
  fetchState: 'idle' | 'busy';
  candidates: SitemapCandidate[];
  candidatesTotal: number;
  candidatesTruncated: boolean;
  membership: {
    state: SitemapMembershipState;
    matchedLoc: string | null;
    lastmod: string | null;
    detail: string;
  };
  fetchedFiles: {
    url: string;
    finalUrl: string;
    kind: string;
    entryCount: number;
    error: CrawlSignalError | null;
  }[];
  fetchedFilesTotal: number;
  fetchedFilesTruncated: boolean;
  entryCount: number;
  parseTruncated: boolean;
  limits: { maxFiles: number; maxEntries: number; maxBytes: number };
  errors: CrawlSignalError[];
  error: CrawlSignalError | null;
  detail: string;
};

export type CrawlSignalsModel = {
  auditedUrl: string;
  origin: string;
  accessGranted: boolean;
  navigation: NavigationSignalsPanel;
  robots: RobotsSignalsPanel;
  sitemap: SitemapSignalsPanel;
  hreflangCluster: HreflangClusterSignalsPanel;
  variantTests: VariantTestsSignalsPanel;
  soft404Probe: Soft404ProbeSignalsPanel;
  cssJsComparison: CssJsComparisonSignalsPanel;
};

export type HreflangClusterValidateState = 'idle' | 'busy' | 'done' | 'cancelled';

export type HreflangClusterSignalsPanel = {
  availability: SignalAvailability;
  validateState: HreflangClusterValidateState;
  seedUrl: string | null;
  declaredAlternates: { hreflang: string; href: string }[];
  declaredTotal: number;
  declaredTruncated: boolean;
  limits: HreflangClusterLimits;
  progress: { completed: number; total: number; currentUrl?: string } | null;
  result: HreflangClusterValidationResult | null;
  detail: string;
};

export type VariantTestsRunState = 'idle' | 'busy' | 'done' | 'cancelled';

export type VariantTestsSignalsPanel = {
  availability: SignalAvailability;
  runState: VariantTestsRunState;
  baseUrl: string;
  kindOptions: VariantKindOptions;
  limits: VariantTestLimits;
  progress: { completed: number; total: number; currentUrl?: string } | null;
  result: VariantTestRunResult | null;
  detail: string;
};

export type Soft404ProbeRunState = 'idle' | 'busy' | 'done' | 'cancelled';

export type Soft404ProbeSignalsPanel = {
  availability: SignalAvailability;
  runState: Soft404ProbeRunState;
  auditedUrl: string;
  probeUrl: string;
  limits: Soft404ProbeLimits;
  progress: { phase: string; currentUrl?: string } | null;
  result: Soft404ProbeResult | null;
  detail: string;
};

export type CssJsComparisonRunState = 'idle' | 'busy' | 'done' | 'cancelled';

export type CssJsComparisonSignalsPanel = {
  availability: SignalAvailability;
  runState: CssJsComparisonRunState;
  auditedUrl: string;
  origin: string;
  cssOffOnly: true;
  limits: CssJsComparisonLimits;
  progress: { phase: string; detail?: string } | null;
  result: CssJsComparisonResult | null;
  detail: string;
};

function mapCaptureError(error: RobotsCaptureError | SitemapCaptureError): CrawlSignalError {
  return {
    code: error.code,
    message: error.message,
    capturedAt: error.capturedAt,
    url: error.url,
  };
}

function truncateList<T>(
  items: T[],
  max: number,
): { shown: T[]; total: number; truncated: boolean } {
  return {
    shown: items.slice(0, max),
    total: items.length,
    truncated: items.length > max,
  };
}

function formatProfileRow(evaluation: RobotsProfileEvaluation): ProfileDecisionRow {
  const matchedRule = evaluation.matchedRule
    ? `${evaluation.matchedRule.kind}: ${evaluation.matchedRule.pattern} (line ${evaluation.matchedRule.lineNumber})`
    : null;
  return {
    profile: evaluation.profile,
    crawlable: evaluation.crawlable,
    reason: evaluation.reason,
    matchedRule,
  };
}

function buildNavigationPanel(
  accessGranted: boolean,
  auditedUrl: string,
  navigation?: NavigationObservationStatus,
): NavigationSignalsPanel {
  if (!accessGranted) {
    return {
      availability: 'needs-access',
      sourceUrl: null,
      capturedAt: null,
      statusCode: null,
      redirectHops: [],
      redirectTotal: 0,
      redirectTruncated: false,
      headerEntries: [],
      headerTotal: 0,
      headersTruncated: false,
      xRobotsTag: { state: 'unavailable', value: 'Needs site access' },
      detail: 'Browser navigation and response headers require site access for the active tab.',
    };
  }

  if (!navigation || navigation.status === 'unavailable') {
    const recovery =
      navigation?.recovery === 'reload-and-reobserve'
        ? ' Use “Capture navigation (reload)” while this panel is open.'
        : '';
    return {
      availability: 'unavailable',
      sourceUrl: navigation?.requestedUrl ?? auditedUrl,
      capturedAt: null,
      statusCode: null,
      redirectHops: [{ url: auditedUrl, status: null }],
      redirectTotal: 1,
      redirectTruncated: false,
      headerEntries: [],
      headerTotal: 0,
      headersTruncated: false,
      xRobotsTag: { state: 'unavailable', value: 'Not captured yet' },
      detail: `${navigation?.message ?? 'Browser-navigation status and headers were not observed for this load.'}${recovery}`,
    };
  }

  const hops: { url: string; status: number | null }[] = [];
  for (const hop of navigation.redirectHops) {
    hops.push({ url: hop.fromUrl, status: hop.status });
  }
  hops.push({ url: navigation.finalUrl, status: navigation.statusCode });

  const hopSlice = truncateList(hops, CRAWL_SIGNALS_DISPLAY_LIMITS.maxRedirectHops);
  const headerPairs = Object.entries(navigation.headers).map(([name, value]) => ({
    name,
    value: value ?? '',
  }));
  const headerSlice = truncateList(headerPairs, CRAWL_SIGNALS_DISPLAY_LIMITS.maxHeaderEntries);
  const xRobots = navigation.headers['x-robots-tag'];

  return {
    availability: 'present',
    sourceUrl: navigation.requestedUrl,
    capturedAt: navigation.observedAt,
    statusCode: navigation.statusCode,
    redirectHops: hopSlice.shown,
    redirectTotal: hopSlice.total,
    redirectTruncated: hopSlice.truncated,
    headerEntries: headerSlice.shown,
    headerTotal: headerSlice.total,
    headersTruncated: headerSlice.truncated,
    xRobotsTag: xRobots
      ? { state: 'present', value: xRobots }
      : { state: 'absent', value: '(absent)' },
    detail:
      navigation.redirectHops.length === 0
        ? 'Observed browser navigation (not an extension fetch). No redirects on the main-frame load.'
        : `Observed browser navigation with ${navigation.redirectHops.length} redirect hop(s).`,
  };
}

function buildRobotsPanel(
  accessGranted: boolean,
  origin: string,
  auditedUrl: string,
  robots: RobotsFetchResult | null | undefined,
  fetchBusy: boolean,
): RobotsSignalsPanel {
  const idle: RobotsSignalsPanel = {
    availability: accessGranted ? 'unavailable' : 'needs-access',
    fetchState: fetchBusy ? 'busy' : 'idle',
    requestedUrl: accessGranted ? `${origin}/robots.txt` : null,
    finalUrl: null,
    fetchedAt: null,
    status: null,
    redirectHops: [],
    redirectTotal: 0,
    redirectTruncated: false,
    googlebot: null,
    wildcard: null,
    sitemapDirectives: [],
    sitemapDirectivesTotal: 0,
    sitemapDirectivesTruncated: false,
    error: null,
    detail: accessGranted
      ? 'robots.txt has not been fetched for this origin yet. Use Fetch robots.'
      : 'robots.txt fetch requires site access for the active tab origin.',
  };

  if (!accessGranted || !robots) return idle;

  const hopSlice = truncateList(
    robots.ok ? robots.redirectHops : (robots.error.redirectHops ?? []),
    CRAWL_SIGNALS_DISPLAY_LIMITS.maxRedirectHops,
  );

  if (!robots.ok) {
    return {
      ...idle,
      availability: 'error',
      fetchState: fetchBusy ? 'busy' : 'idle',
      requestedUrl: robots.error.requestedUrl ?? robots.error.url,
      finalUrl: robots.error.finalUrl ?? null,
      fetchedAt: robots.error.capturedAt,
      status: robots.error.status ?? null,
      redirectHops: hopSlice.shown,
      redirectTotal: hopSlice.total,
      redirectTruncated: hopSlice.truncated,
      error: mapCaptureError(robots.error),
      detail:
        'robots.txt fetch or parse failed — this is capture evidence, not a pass/fail finding.',
    };
  }

  const evaluation = evaluateRobotsForUrl(robots.parsed, auditedUrl);
  const googlebot =
    evaluation.ok && evaluation.profiles.Googlebot
      ? formatProfileRow(evaluation.profiles.Googlebot)
      : null;
  const wildcard =
    evaluation.ok && evaluation.profiles['*'] ? formatProfileRow(evaluation.profiles['*']) : null;

  const sitemapSlice = truncateList(
    robots.parsed.sitemaps,
    CRAWL_SIGNALS_DISPLAY_LIMITS.maxSitemapDirectives,
  );

  return {
    availability: 'present',
    fetchState: fetchBusy ? 'busy' : 'idle',
    requestedUrl: robots.requestedUrl,
    finalUrl: robots.finalUrl,
    fetchedAt: robots.fetchedAt,
    status: robots.status,
    redirectHops: hopSlice.shown,
    redirectTotal: hopSlice.total,
    redirectTruncated: hopSlice.truncated,
    googlebot,
    wildcard,
    sitemapDirectives: sitemapSlice.shown,
    sitemapDirectivesTotal: sitemapSlice.total,
    sitemapDirectivesTruncated: sitemapSlice.truncated,
    error: null,
    detail: evaluation.ok
      ? `Parsed robots.txt for path ${evaluation.path}. Decisions are parser output for declared crawler profiles.`
      : 'robots.txt was fetched but path evaluation was unavailable.',
  };
}

function buildSitemapPanel(
  accessGranted: boolean,
  auditedUrl: string,
  candidates: SitemapCandidate[],
  sitemap: SitemapFetchResult | null | undefined,
  fetchBusy: boolean,
): SitemapSignalsPanel {
  const candidateSlice = truncateList(
    candidates,
    CRAWL_SIGNALS_DISPLAY_LIMITS.maxSitemapCandidates,
  );
  const base: SitemapSignalsPanel = {
    availability: accessGranted ? 'unavailable' : 'needs-access',
    fetchState: fetchBusy ? 'busy' : 'idle',
    candidates: candidateSlice.shown,
    candidatesTotal: candidateSlice.total,
    candidatesTruncated: candidateSlice.truncated,
    membership: {
      state: 'unavailable',
      matchedLoc: null,
      lastmod: null,
      detail: accessGranted
        ? 'Sitemap membership is unknown until a sitemap is fetched.'
        : 'Sitemap discovery requires site access.',
    },
    fetchedFiles: [],
    fetchedFilesTotal: 0,
    fetchedFilesTruncated: false,
    entryCount: 0,
    parseTruncated: false,
    limits: {
      maxFiles: SITEMAP_LIMITS.maxFiles,
      maxEntries: SITEMAP_LIMITS.maxEntries,
      maxBytes: SITEMAP_LIMITS.maxBytes,
    },
    errors: [],
    error: null,
    detail: accessGranted
      ? 'No sitemap fetch yet. Discover candidates from robots.txt (when available) or common paths.'
      : 'Sitemap fetch requires site access for the active tab origin.',
  };

  if (!accessGranted || !sitemap) return base;

  const fileRows = sitemap.fetchedFiles.map((file) => ({
    url: file.requestedUrl,
    finalUrl: file.finalUrl,
    kind: file.kind,
    entryCount: file.entryCount,
    error: file.error ? mapCaptureError(file.error) : null,
  }));
  const fileSlice = truncateList(fileRows, CRAWL_SIGNALS_DISPLAY_LIMITS.maxFetchedFiles);
  const errors = truncateList(
    sitemap.errors.map(mapCaptureError),
    CRAWL_SIGNALS_DISPLAY_LIMITS.maxErrors,
  );

  if (!sitemap.ok) {
    return {
      ...base,
      availability: 'error',
      fetchState: fetchBusy ? 'busy' : 'idle',
      fetchedFiles: fileSlice.shown,
      fetchedFilesTotal: fileSlice.total,
      fetchedFilesTruncated: fileSlice.truncated,
      errors: errors.shown,
      error: mapCaptureError(sitemap.error),
      detail: 'Sitemap fetch or parse failed — this is capture evidence, not a pass/fail finding.',
    };
  }

  const membership = sitemapContainsAuditedUrl(sitemap.entries, auditedUrl);
  const membershipState: SitemapMembershipState = membership.present ? 'present' : 'absent';

  return {
    ...base,
    availability: membership.present ? 'present' : 'absent',
    fetchState: fetchBusy ? 'busy' : 'idle',
    candidates: candidateSlice.shown,
    candidatesTotal: candidateSlice.total,
    candidatesTruncated: candidateSlice.truncated,
    membership: {
      state: membershipState,
      matchedLoc: membership.matchedLoc ?? null,
      lastmod: membership.entry?.lastmod ?? null,
      detail: membership.present
        ? `Audited URL matched sitemap entry ${membership.matchedLoc ?? auditedUrl}.`
        : `Audited URL was not found among ${sitemap.entries.size} parsed sitemap entries (within fetch limits).`,
    },
    fetchedFiles: fileSlice.shown,
    fetchedFilesTotal: fileSlice.total,
    fetchedFilesTruncated: fileSlice.truncated,
    entryCount: sitemap.entries.size,
    parseTruncated: sitemap.truncated,
    errors: errors.shown,
    error: errors.shown[0] ?? null,
    detail: sitemap.truncated
      ? `Sitemap walk hit parser or file limits (max ${SITEMAP_LIMITS.maxFiles} files, ${SITEMAP_LIMITS.maxEntries} entries).`
      : `Fetched ${sitemap.fetchedFiles.length} sitemap file(s) via extension fetch.`,
  };
}

function buildHreflangClusterPanel(input: {
  accessGranted: boolean;
  auditedUrl: string;
  declaredAlternates: { hreflang: string; href: string }[];
  validateState: HreflangClusterValidateState;
  progress: HreflangClusterSignalsPanel['progress'];
  result: HreflangClusterValidationResult | null;
}): HreflangClusterSignalsPanel {
  const declaredSlice = truncateList(
    input.declaredAlternates,
    HREFLANG_CLUSTER_DISPLAY_LIMITS.maxDeclaredAlternates,
  );

  if (!input.accessGranted) {
    return {
      availability: 'needs-access',
      validateState: 'idle',
      seedUrl: null,
      declaredAlternates: [],
      declaredTotal: 0,
      declaredTruncated: false,
      limits: HREFLANG_CLUSTER_LIMITS,
      progress: null,
      result: null,
      detail:
        'Hreflang cluster validation requires site access and captured alternate links on the active page.',
    };
  }

  if (input.declaredAlternates.length === 0) {
    return {
      availability: 'unavailable',
      validateState: 'idle',
      seedUrl: input.auditedUrl,
      declaredAlternates: [],
      declaredTotal: 0,
      declaredTruncated: false,
      limits: HREFLANG_CLUSTER_LIMITS,
      progress: null,
      result: null,
      detail:
        'No hreflang alternates were captured on the active page. Run a glance or audit with hreflang evidence first.',
    };
  }

  const busy = input.validateState === 'busy';
  const done = input.validateState === 'done' || input.validateState === 'cancelled';

  let detail =
    'Opt-in network experiment: fetches alternate targets to verify return hreflang tags among successfully fetched members. Not Googlebot or crawler parity.';
  if (busy && input.progress) {
    detail = `Fetching alternates (${input.progress.completed}/${input.progress.total})${input.progress.currentUrl ? ` — ${input.progress.currentUrl}` : ''}.`;
  } else if (done && input.result) {
    const fetched = input.result.members.filter((member) => member.fetched).length;
    detail = input.result.cancelled
      ? `Cancelled after fetching ${fetched} member(s). ${input.result.findings.length} finding(s), ${input.result.errors.length} capture error(s).`
      : `Validated ${fetched} fetched member(s). ${input.result.findings.length} finding(s), ${input.result.errors.length} capture error(s).`;
  }

  return {
    availability: 'present',
    validateState: input.validateState,
    seedUrl: input.auditedUrl,
    declaredAlternates: declaredSlice.shown,
    declaredTotal: declaredSlice.total,
    declaredTruncated: declaredSlice.truncated,
    limits: HREFLANG_CLUSTER_LIMITS,
    progress: input.progress,
    result: input.result,
    detail,
  };
}

function buildVariantTestsPanel(input: {
  accessGranted: boolean;
  auditedUrl: string;
  baseUrl: string;
  kindOptions: VariantKindOptions;
  runState: VariantTestsRunState;
  progress: VariantTestsSignalsPanel['progress'];
  result: VariantTestRunResult | null;
}): VariantTestsSignalsPanel {
  if (!input.accessGranted) {
    return {
      availability: 'needs-access',
      runState: 'idle',
      baseUrl: input.baseUrl,
      kindOptions: input.kindOptions,
      limits: VARIANT_TEST_LIMITS,
      progress: null,
      result: null,
      detail:
        'URL variant redirect tests require site access and a user-selected HTTP(S) base URL.',
    };
  }

  const busy = input.runState === 'busy';
  const done = input.runState === 'done' || input.runState === 'cancelled';

  let detail =
    'Opt-in extension fetch experiment: requests URL variants (scheme, host, slash, case, index files) and records redirect chains. Observations flag inconsistent finals without assuming a preferred host.';
  if (busy && input.progress) {
    detail = `Fetching variants (${input.progress.completed}/${input.progress.total})${input.progress.currentUrl ? ` — ${input.progress.currentUrl}` : ''}.`;
  } else if (done && input.result) {
    const fetched = input.result.results.filter((row) => !row.skipped).length;
    detail = input.result.cancelled
      ? `Cancelled after ${fetched} variant request(s). ${input.result.observations.length} observation(s).`
      : `Completed ${fetched} variant request(s). ${input.result.finalGroups.length} final URL group(s), ${input.result.observations.length} observation(s).`;
  }

  return {
    availability: 'present',
    runState: input.runState,
    baseUrl: input.baseUrl,
    kindOptions: input.kindOptions,
    limits: VARIANT_TEST_LIMITS,
    progress: input.progress,
    result: input.result,
    detail,
  };
}

function buildSoft404ProbePanel(input: {
  accessGranted: boolean;
  auditedUrl: string;
  probeUrl: string;
  runState: Soft404ProbeRunState;
  progress: Soft404ProbeSignalsPanel['progress'];
  result: Soft404ProbeResult | null;
}): Soft404ProbeSignalsPanel {
  if (!input.accessGranted) {
    return {
      availability: 'needs-access',
      runState: 'idle',
      auditedUrl: input.auditedUrl,
      probeUrl: input.probeUrl,
      limits: SOFT_404_PROBE_LIMITS,
      progress: null,
      result: null,
      detail:
        'Soft-404 probe requires site access and a user-confirmed probe URL on the audited origin.',
    };
  }

  const busy = input.runState === 'busy';
  const done = input.runState === 'done' || input.runState === 'cancelled';

  let detail =
    'Opt-in extension fetch experiment: requests one nonexistent URL and compares it to the audited page. Observations are heuristic only — not Google soft-404 parity.';
  if (busy && input.progress) {
    detail = `Soft-404 probe ${input.progress.phase.replace(/-/g, ' ')}${input.progress.currentUrl ? ` — ${input.progress.currentUrl}` : ''}.`;
  } else if (done && input.result) {
    detail = input.result.cancelled
      ? 'Soft-404 probe cancelled before both fetches completed.'
      : `${input.result.observations.length} possible soft-404 observation(s) from probe comparison.`;
  }

  return {
    availability: 'present',
    runState: input.runState,
    auditedUrl: input.auditedUrl,
    probeUrl: input.probeUrl,
    limits: SOFT_404_PROBE_LIMITS,
    progress: input.progress,
    result: input.result,
    detail,
  };
}

function buildCssJsComparisonPanel(input: {
  accessGranted: boolean;
  auditedUrl: string;
  origin: string;
  runState: CssJsComparisonRunState;
  progress: CssJsComparisonSignalsPanel['progress'];
  result: CssJsComparisonResult | null;
}): CssJsComparisonSignalsPanel {
  if (!input.accessGranted) {
    return {
      availability: 'needs-access',
      runState: 'idle',
      auditedUrl: input.auditedUrl,
      origin: input.origin,
      cssOffOnly: true,
      limits: CSS_JS_COMPARISON_LIMITS,
      progress: null,
      result: null,
      detail: 'CSS/JS comparison requires site access for the active tab origin.',
    };
  }

  const busy = input.runState === 'busy';
  const done = input.runState === 'done' || input.runState === 'cancelled';

  let detail =
    'Opt-in comparison: opens a dedicated background tab to this URL, disables its stylesheets ' +
    '(css-injection-disable-v1), and diffs the DOM against the active tab. JavaScript-disabled comparison ' +
    'is deliberately omitted — see docs/css-js-comparison.md. Not Googlebot or crawler-rendering parity.';
  if (busy && input.progress) {
    detail = `CSS comparison ${input.progress.phase.replace(/-/g, ' ')}${input.progress.detail ? ` — ${input.progress.detail}` : ''}.`;
  } else if (done && input.result) {
    const changed = input.result.diffs.filter((d) => d.changed).length;
    detail = input.result.cancelled
      ? 'CSS comparison cancelled before both captures completed.'
      : `CSS comparison complete — ${changed} of ${input.result.diffs.length} field(s) changed, ${input.result.observations.length} observation(s).`;
  }

  return {
    availability: 'present',
    runState: input.runState,
    auditedUrl: input.auditedUrl,
    origin: input.origin,
    cssOffOnly: true,
    limits: CSS_JS_COMPARISON_LIMITS,
    progress: input.progress,
    result: input.result,
    detail,
  };
}

/** Build deduplicated sitemap candidates from robots directives and common paths. */
export function buildSitemapCandidatesForOrigin(
  origin: string,
  robots?: RobotsFetchResult | null,
): SitemapCandidate[] {
  const robotsSitemaps = robots?.ok ? robots.parsed.sitemaps : undefined;
  return discoverSitemapCandidates({ origin, robotsSitemaps });
}

export function buildCrawlSignalsModel(input: {
  tabUrl: string;
  documentUrl: string | null;
  origin: string;
  accessGranted: boolean;
  navigation?: NavigationObservationStatus;
  robots?: RobotsFetchResult | null;
  sitemap?: SitemapFetchResult | null;
  sitemapCandidates?: SitemapCandidate[];
  robotsFetchBusy?: boolean;
  sitemapFetchBusy?: boolean;
  hreflangAlternates?: { hreflang: string; href: string }[];
  hreflangValidateState?: HreflangClusterValidateState;
  hreflangProgress?: HreflangClusterSignalsPanel['progress'];
  hreflangResult?: HreflangClusterValidationResult | null;
  variantBaseUrl?: string;
  variantKindOptions?: VariantKindOptions;
  variantRunState?: VariantTestsRunState;
  variantProgress?: VariantTestsSignalsPanel['progress'];
  variantResult?: VariantTestRunResult | null;
  soft404ProbeUrl?: string;
  soft404RunState?: Soft404ProbeRunState;
  soft404Progress?: Soft404ProbeSignalsPanel['progress'];
  soft404Result?: Soft404ProbeResult | null;
  cssJsRunState?: CssJsComparisonRunState;
  cssJsProgress?: CssJsComparisonSignalsPanel['progress'];
  cssJsResult?: CssJsComparisonResult | null;
}): CrawlSignalsModel {
  const auditedUrl = input.documentUrl ?? input.tabUrl;
  const candidates =
    input.sitemapCandidates ?? buildSitemapCandidatesForOrigin(input.origin, input.robots ?? null);

  return {
    auditedUrl,
    origin: input.origin,
    accessGranted: input.accessGranted,
    navigation: buildNavigationPanel(input.accessGranted, auditedUrl, input.navigation),
    robots: buildRobotsPanel(
      input.accessGranted,
      input.origin,
      auditedUrl,
      input.robots,
      Boolean(input.robotsFetchBusy),
    ),
    sitemap: buildSitemapPanel(
      input.accessGranted,
      auditedUrl,
      candidates,
      input.sitemap,
      Boolean(input.sitemapFetchBusy),
    ),
    hreflangCluster: buildHreflangClusterPanel({
      accessGranted: input.accessGranted,
      auditedUrl,
      declaredAlternates: input.hreflangAlternates ?? [],
      validateState: input.hreflangValidateState ?? 'idle',
      progress: input.hreflangProgress ?? null,
      result: input.hreflangResult ?? null,
    }),
    variantTests: buildVariantTestsPanel({
      accessGranted: input.accessGranted,
      auditedUrl,
      baseUrl: input.variantBaseUrl ?? auditedUrl,
      kindOptions: input.variantKindOptions ?? DEFAULT_VARIANT_KIND_OPTIONS,
      runState: input.variantRunState ?? 'idle',
      progress: input.variantProgress ?? null,
      result: input.variantResult ?? null,
    }),
    soft404Probe: buildSoft404ProbePanel({
      accessGranted: input.accessGranted,
      auditedUrl,
      probeUrl: input.soft404ProbeUrl ?? auditedUrl,
      runState: input.soft404RunState ?? 'idle',
      progress: input.soft404Progress ?? null,
      result: input.soft404Result ?? null,
    }),
    cssJsComparison: buildCssJsComparisonPanel({
      accessGranted: input.accessGranted,
      auditedUrl,
      origin: input.origin,
      runState: input.cssJsRunState ?? 'idle',
      progress: input.cssJsProgress ?? null,
      result: input.cssJsResult ?? null,
    }),
  };
}
