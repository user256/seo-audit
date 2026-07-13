import type { DomFacts, FieldState } from '../../content/dom-collector';
import type { VisibleTextFingerprint } from '../../content/visible-text-fingerprint';

export type CssJsComparisonDiffField =
  | 'title'
  | 'metaDescription'
  | 'canonical'
  | 'headings'
  | 'links'
  | 'jsonLd'
  | 'visibleText';

export type CssJsComparisonDiff = {
  field: CssJsComparisonDiffField;
  label: string;
  baselineSummary: string;
  experimentSummary: string;
  changed: boolean;
};

export type CssJsComparisonObservationKind =
  | 'title-changed'
  | 'meta-description-changed'
  | 'canonical-changed'
  | 'headings-changed'
  | 'links-changed'
  | 'jsonld-changed'
  | 'visible-text-changed';

export type CssJsComparisonObservation = {
  id: string;
  kind: CssJsComparisonObservationKind;
  summary: string;
  detail: string;
};

/** Bounded, deterministic text summary for the generic (title/meta-like) FieldState shape. */
function describeStringField(field: FieldState): string {
  switch (field.state) {
    case 'absent':
      return '(absent)';
    case 'empty':
      return '(empty)';
    case 'inaccessible':
      return `(inaccessible: ${field.detail})`;
    case 'malformed':
      return `(malformed: ${field.raw})`;
    case 'duplicate':
      return `(duplicate ×${field.count})`;
    case 'present':
      return typeof field.value === 'string' ? field.value : (field.raw ?? '(present)');
    default:
      return '(unknown)';
  }
}

function describeCanonical(field: DomFacts['canonical']): string {
  switch (field.state) {
    case 'absent':
      return '(absent)';
    case 'empty':
      return '(empty)';
    case 'inaccessible':
      return `(inaccessible: ${field.detail})`;
    case 'malformed':
      return `(malformed: ${field.raw})`;
    case 'duplicate':
      return `(duplicate ×${field.count})`;
    case 'present': {
      const value = field.value as { href: string; absolute: string };
      return value.absolute || value.href || '(present)';
    }
    default:
      return '(unknown)';
  }
}

type HeadingsValue = { levels: Record<string, number>; samples: { level: string; text: string }[] };

function describeHeadings(field: DomFacts['headings']): { summary: string; total: number } {
  if (field.state !== 'present') return { summary: `(${field.state})`, total: 0 };
  const value = field.value as HeadingsValue;
  const total = Object.values(value.levels).reduce((a, b) => a + b, 0);
  const parts = Object.entries(value.levels)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${level}:${count}`);
  return { summary: parts.length > 0 ? parts.join(' ') : '(no headings)', total };
}

type LinksValue = { total: number; internal: number; external: number; other: number };

function describeLinks(field: DomFacts['links']): { summary: string; total: number } {
  if (field.state !== 'present') return { summary: `(${field.state})`, total: 0 };
  const value = field.value as LinksValue;
  return {
    summary: `total:${value.total} internal:${value.internal} external:${value.external} other:${value.other}`,
    total: value.total,
  };
}

type JsonLdValue = { parseStatus: 'ok' | 'invalid-json' | 'empty' | 'truncated' }[];

function describeJsonLd(field: DomFacts['jsonLd']): { summary: string; total: number } {
  if (field.state === 'absent') return { summary: '(absent)', total: 0 };
  if (field.state !== 'present') return { summary: `(${field.state})`, total: 0 };
  const value = field.value as JsonLdValue;
  const counts: Record<string, number> = { ok: 0, 'invalid-json': 0, empty: 0, truncated: 0 };
  for (const entry of value) counts[entry.parseStatus] = (counts[entry.parseStatus] ?? 0) + 1;
  const total = field.count ?? value.length;
  return {
    summary: `count:${total} ok:${counts.ok} invalid:${counts['invalid-json']} empty:${counts.empty} truncated:${counts.truncated}`,
    total,
  };
}

function describeVisibleText(fp: VisibleTextFingerprint | null): string {
  if (!fp) return '(not captured)';
  return `${fp.charCount} chars, hash ${fp.hash}${fp.truncated ? ' [truncated]' : ''}`;
}

export type CompareDomFactsInput = {
  /** Unique per run — used to build stable, non-colliding observation ids. */
  requestId: string;
  baseline: DomFacts;
  experiment: DomFacts;
  baselineVisibleText: VisibleTextFingerprint | null;
  experimentVisibleText: VisibleTextFingerprint | null;
};

export type CompareDomFactsResult = {
  diffs: CssJsComparisonDiff[];
  observations: CssJsComparisonObservation[];
};

/**
 * Bounded, deterministic comparison of two DomFacts captures (Ticket 303).
 * Every comparison is a plain string/count equality check — no heuristic
 * scoring — so results are reproducible given the same two captures.
 */
export function compareDomFacts(input: CompareDomFactsInput): CompareDomFactsResult {
  const diffs: CssJsComparisonDiff[] = [];
  const observations: CssJsComparisonObservation[] = [];

  const addDiff = (
    field: CssJsComparisonDiffField,
    label: string,
    baselineSummary: string,
    experimentSummary: string,
    kind: CssJsComparisonObservationKind,
    detail?: string,
  ): void => {
    const changed = baselineSummary !== experimentSummary;
    diffs.push({ field, label, baselineSummary, experimentSummary, changed });
    if (changed) {
      observations.push({
        id: `css-js-diff-${input.requestId}-${field}`,
        kind,
        summary: `${label} changed when CSS was disabled.`,
        detail: detail ?? `Baseline: ${baselineSummary} · CSS-disabled: ${experimentSummary}`,
      });
    }
  };

  addDiff(
    'title',
    'Title',
    describeStringField(input.baseline.title),
    describeStringField(input.experiment.title),
    'title-changed',
  );
  addDiff(
    'metaDescription',
    'Meta description',
    describeStringField(input.baseline.metaDescription),
    describeStringField(input.experiment.metaDescription),
    'meta-description-changed',
  );
  addDiff(
    'canonical',
    'Canonical link',
    describeCanonical(input.baseline.canonical),
    describeCanonical(input.experiment.canonical),
    'canonical-changed',
  );

  const baseHeadings = describeHeadings(input.baseline.headings);
  const expHeadings = describeHeadings(input.experiment.headings);
  addDiff(
    'headings',
    'Headings (h1–h6)',
    baseHeadings.summary,
    expHeadings.summary,
    'headings-changed',
    `Baseline: ${baseHeadings.summary} (${baseHeadings.total} total) · CSS-disabled: ${expHeadings.summary} (${expHeadings.total} total)`,
  );

  const baseLinks = describeLinks(input.baseline.links);
  const expLinks = describeLinks(input.experiment.links);
  addDiff(
    'links',
    'Link counts',
    baseLinks.summary,
    expLinks.summary,
    'links-changed',
    `Baseline: ${baseLinks.summary} · CSS-disabled: ${expLinks.summary} (Δ ${expLinks.total - baseLinks.total} total links)`,
  );

  const baseJsonLd = describeJsonLd(input.baseline.jsonLd);
  const expJsonLd = describeJsonLd(input.experiment.jsonLd);
  addDiff(
    'jsonLd',
    'JSON-LD parse counts',
    baseJsonLd.summary,
    expJsonLd.summary,
    'jsonld-changed',
  );

  const baseVisible = describeVisibleText(input.baselineVisibleText);
  const expVisible = describeVisibleText(input.experimentVisibleText);
  const charDelta =
    input.baselineVisibleText && input.experimentVisibleText
      ? input.experimentVisibleText.charCount - input.baselineVisibleText.charCount
      : null;
  addDiff(
    'visibleText',
    'Visible text fingerprint',
    baseVisible,
    expVisible,
    'visible-text-changed',
    charDelta != null
      ? `Baseline: ${baseVisible} · CSS-disabled: ${expVisible} (Δ ${charDelta >= 0 ? '+' : ''}${charDelta} chars)`
      : `Baseline: ${baseVisible} · CSS-disabled: ${expVisible}`,
  );

  return { diffs, observations };
}
