import type { DomFacts, FieldState } from '../../content/dom-collector';
import type { NavigationObservationStatus } from '../network/types';
import type { RobotsFetchResult } from '../robots/fetch-robots';
import { evaluateRobotsForUrl } from '../robots/evaluate-robots';

export type SignalAvailability = 'present' | 'unavailable' | 'needs-access';

export type IndexabilityRow = {
  label: string;
  value: string;
  source: string;
};

export type SeoDashboardModel = {
  tabUrl: string;
  documentUrl: string | null;
  accessGranted: boolean;
  status: {
    availability: SignalAvailability;
    code: number | null;
    detail: string;
  };
  journey: {
    availability: SignalAvailability;
    hops: { url: string; status: number | null }[];
    detail: string;
  };
  indexability: {
    status: 'unknown' | 'signals-partial';
    summary: string;
    rows: IndexabilityRow[];
  };
  title: string;
  description: string;
  headings: { levels: Record<string, number>; samples: { level: string; text: string }[] } | null;
  html5: {
    doctype: string | null;
    counts: Record<string, number>;
    hasMain: boolean;
  } | null;
  links: {
    total: number;
    internal: number;
    external: number;
    other: number;
    inventory: { href: string; absolute: string | null; text: string }[];
  } | null;
  images: {
    total: number;
    withAlt: number;
    emptyAlt: number;
    missingAlt: number;
    inventory: { src: string; alt: string | null; altState: string }[];
  } | null;
  inventoryLoaded: boolean;
};

function fieldText(field: FieldState | undefined, fallback = '—'): string {
  if (!field) return fallback;
  if (field.state === 'absent') return '(absent)';
  if (field.state === 'empty') return '(empty)';
  if (field.state === 'inaccessible') return `(unavailable: ${field.detail})`;
  if (field.state === 'malformed') return `(malformed: ${field.detail})`;
  if (field.state === 'duplicate') return `(${field.count} values)`;
  if (field.state === 'present') {
    if (typeof field.value === 'string') return field.value;
    if (field.raw) return field.raw;
    return JSON.stringify(field.value);
  }
  return fallback;
}

function canonicalText(field: FieldState | undefined): string {
  if (!field) return '—';
  if (field.state === 'present') {
    const value = field.value as { absolute?: string; href?: string } | undefined;
    return value?.absolute ?? value?.href ?? field.raw ?? '—';
  }
  return fieldText(field);
}

function robotsText(field: FieldState | undefined): string {
  if (!field) return '—';
  if (field.state === 'present') {
    const value = field.value as { content?: string } | string;
    if (typeof value === 'string') return value;
    return value?.content ?? field.raw ?? '—';
  }
  if (field.state === 'duplicate') {
    return field.values
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'content' in item) {
          return String((item as { content: unknown }).content ?? '');
        }
        return '';
      })
      .filter(Boolean)
      .join(' | ');
  }
  return fieldText(field);
}

/** Pre-access dashboard: tab URL only; network + DOM slots explain they need Allow. */
export function buildPreAccessDashboard(tabUrl: string): SeoDashboardModel {
  return {
    tabUrl,
    documentUrl: null,
    accessGranted: false,
    status: {
      availability: 'needs-access',
      code: null,
      detail: 'HTTP status requires site access (and Ticket 201 capture).',
    },
    journey: {
      availability: 'needs-access',
      hops: [],
      detail:
        'Redirect journey from the requested URL needs site access. The address bar shows the final tab URL only.',
    },
    indexability: {
      status: 'unknown',
      summary: 'Cannot assess indexability before site access.',
      rows: [
        { label: 'Final tab URL', value: tabUrl, source: 'chrome.tabs' },
        { label: 'Canonical', value: 'needs access', source: 'dom' },
        { label: 'Meta robots', value: 'needs access', source: 'dom' },
        { label: 'HTTP headers / X-Robots-Tag', value: 'needs access', source: 'network' },
        { label: 'robots.txt', value: 'not fetched', source: 'robots' },
      ],
    },
    title: '—',
    description: '—',
    headings: null,
    html5: null,
    links: null,
    images: null,
    inventoryLoaded: false,
  };
}

/** Shown when access is granted but inventory has not loaded or failed. */
export function buildGrantedShellDashboard(tabUrl: string, detail: string): SeoDashboardModel {
  const base = buildPreAccessDashboard(tabUrl);
  return {
    ...base,
    accessGranted: true,
    status: {
      availability: 'unavailable',
      code: null,
      detail: 'HTTP status is not captured yet (Ticket 201).',
    },
    journey: {
      availability: 'unavailable',
      hops: [{ url: tabUrl, status: null }],
      detail,
    },
    indexability: {
      status: 'unknown',
      summary: detail,
      rows: [
        { label: 'Final tab URL', value: tabUrl, source: 'chrome.tabs' },
        { label: 'Canonical', value: 'inventory pending', source: 'dom' },
        { label: 'Meta robots', value: 'inventory pending', source: 'dom' },
        {
          label: 'HTTP headers / X-Robots-Tag',
          value: 'unavailable',
          source: 'network',
        },
        { label: 'robots.txt', value: 'not fetched', source: 'robots' },
      ],
    },
    inventoryLoaded: false,
  };
}

/** Glance dashboard from DOM inventory, optionally enriched with navigation + robots. */
export function buildGlanceDashboard(input: {
  tabUrl: string;
  facts: DomFacts;
  navigation?: NavigationObservationStatus;
  robots?: RobotsFetchResult | null;
}): SeoDashboardModel {
  const { facts, tabUrl, navigation, robots } = input;
  const headings =
    facts.headings.state === 'present'
      ? (facts.headings.value as {
          levels: Record<string, number>;
          samples: { level: string; text: string }[];
        })
      : null;
  const links =
    facts.links.state === 'present' ? (facts.links.value as SeoDashboardModel['links']) : null;
  const images =
    facts.images.state === 'present' ? (facts.images.value as SeoDashboardModel['images']) : null;
  const html5 =
    facts.html5.state === 'present' ? (facts.html5.value as SeoDashboardModel['html5']) : null;

  const network = networkSlotsFromObservation(navigation, facts.documentUrl);
  const robotsRow = robotsIndexabilityRow(robots, facts.documentUrl || tabUrl);
  const hasNav = navigation?.status === 'observed';
  const hasRobots = robots?.ok === true;
  let summary: string;
  if (hasNav && hasRobots) {
    summary = 'DOM + browser-navigation headers + robots.txt captured.';
  } else if (hasNav) {
    summary = 'DOM + browser-navigation headers captured. robots.txt not fetched yet.';
  } else if (hasRobots) {
    summary =
      'DOM + robots.txt captured. Browser-navigation headers were not observed (reload while the panel watches the tab).';
  } else {
    summary =
      'DOM signals only — browser-navigation headers were not observed (reload while the panel watches the tab). robots.txt not fetched.';
  }

  return {
    tabUrl,
    documentUrl: facts.documentUrl,
    accessGranted: true,
    status: network.status,
    journey: network.journey,
    indexability: {
      status: hasNav || hasRobots ? 'signals-partial' : 'unknown',
      summary,
      rows: [
        { label: 'Document URL', value: facts.documentUrl, source: 'dom' },
        { label: 'Canonical', value: canonicalText(facts.canonical), source: 'dom' },
        { label: 'Meta robots', value: robotsText(facts.metaRobots), source: 'dom' },
        {
          label: 'HTTP headers / X-Robots-Tag',
          value: network.xRobotsValue,
          source: 'network',
        },
        robotsRow,
      ],
    },
    title: fieldText(facts.title),
    description: fieldText(facts.metaDescription),
    headings,
    html5,
    links,
    images,
    inventoryLoaded: true,
  };
}

function robotsIndexabilityRow(
  robots: RobotsFetchResult | null | undefined,
  auditedUrl: string,
): { label: string; value: string; source: string } {
  if (!robots) {
    return { label: 'robots.txt', value: 'not fetched', source: 'robots' };
  }
  if (!robots.ok) {
    return {
      label: 'robots.txt',
      value: `fetch issue (${robots.error.code})`,
      source: 'robots',
    };
  }
  const evaluation = evaluateRobotsForUrl(robots.parsed, auditedUrl);
  if (!evaluation.ok) {
    return {
      label: 'robots.txt',
      value: `fetched (HTTP ${robots.status}); path evaluation unavailable`,
      source: 'robots',
    };
  }
  const googlebot = evaluation.profiles.Googlebot;
  const wildcard = evaluation.profiles['*'];
  const bits = [
    `Googlebot ${googlebot.crawlable ? 'allowed' : 'blocked'}`,
    `* ${wildcard.crawlable ? 'allowed' : 'blocked'}`,
  ];
  return {
    label: 'robots.txt',
    value: `fetched (HTTP ${robots.status}) — ${bits.join('; ')} for ${evaluation.path}`,
    source: 'robots',
  };
}

function networkSlotsFromObservation(
  navigation: NavigationObservationStatus | undefined,
  fallbackUrl: string,
): {
  status: SeoDashboardModel['status'];
  journey: SeoDashboardModel['journey'];
  xRobotsValue: string;
} {
  if (!navigation || navigation.status === 'unavailable') {
    const detail =
      navigation?.message ?? 'Browser-navigation status/headers were not observed for this load.';
    const recovery =
      navigation?.recovery === 'reload-and-reobserve'
        ? ' Use “Capture navigation (reload)” while this panel is open.'
        : '';
    return {
      status: {
        availability: 'unavailable',
        code: null,
        detail: `${detail}${recovery}`,
      },
      journey: {
        availability: 'unavailable',
        hops: [{ url: fallbackUrl, status: null }],
        detail:
          'Showing the final document URL only. Redirect hops require an observed browser navigation.',
      },
      xRobotsValue: 'unavailable',
    };
  }

  const hops: { url: string; status: number | null }[] = [];
  for (const hop of navigation.redirectHops) {
    hops.push({ url: hop.fromUrl, status: hop.status });
  }
  hops.push({ url: navigation.finalUrl, status: navigation.statusCode });

  return {
    status: {
      availability: 'present',
      code: navigation.statusCode,
      detail: `Observed browser navigation (not an extension fetch).`,
    },
    journey: {
      availability: 'present',
      hops,
      detail:
        navigation.redirectHops.length === 0
          ? 'No redirects observed on the main-frame navigation.'
          : `Recorded ${navigation.redirectHops.length} redirect hop(s) from browser navigation.`,
    },
    xRobotsValue: navigation.headers['x-robots-tag'] ?? '(absent)',
  };
}

export type UrlKind = 'relative' | 'absolute';

/**
 * Classify a raw href/src attribute as relative or absolute. Anything with a URL
 * scheme (`https:`, `mailto:`, `data:`, …) or a protocol-relative `//host` prefix
 * is absolute; everything else (`/path`, `./x`, `#hash`, `?q`) is relative.
 */
export function classifyUrl(raw: string): UrlKind {
  const value = raw.trim();
  if (value.startsWith('//')) return 'absolute';
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) ? 'absolute' : 'relative';
}

/** RFC 4180 cell: quote when it contains a comma, quote, CR, or LF; double internal quotes. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\r\n');
}

/** CSV: link (resolved), anchor text, relative/absolute (of the authored href), source page. */
export function formatLinksForClipboard(
  links: NonNullable<SeoDashboardModel['links']>,
  source: string,
): string {
  return toCsv(
    ['link', 'anchor', 'type', 'source'],
    links.inventory.map((row) => [
      row.absolute ?? row.href,
      row.text,
      classifyUrl(row.href),
      source,
    ]),
  );
}

/** CSV: image src, alt attribute (missing/empty distinguished), relative/absolute, source page. */
export function formatImagesForClipboard(
  images: NonNullable<SeoDashboardModel['images']>,
  source: string,
): string {
  return toCsv(
    ['image', 'alt-attrib', 'type', 'source'],
    images.inventory.map((row) => [
      row.src,
      row.altState === 'missing'
        ? '(missing)'
        : row.altState === 'empty'
          ? '(empty)'
          : (row.alt ?? ''),
      classifyUrl(row.src),
      source,
    ]),
  );
}
