import type { CaptureError, Finding, Severity } from '../schemas/audit';
import { INDEXABILITY_SOURCES } from './indexability-evidence';
import type { PageSummary } from './types';

export type PageSummaryInput = {
  findings: Finding[];
  featureAvailability?: Record<string, boolean | 'unavailable'>;
  captureErrors?: CaptureError[];
  /** Evidence sources present on the evaluated snapshot (Ticket 204). */
  evidenceSources?: ReadonlySet<string>;
};

const EMPTY_SEVERITY: Record<Severity, number> = {
  info: 0,
  warning: 0,
  error: 0,
  critical: 0,
};

const BLOCKING_RULE_IDS = new Set([
  'indexability-noindex-signal',
  'indexability-robots-blocked',
  'indexability-robots-conflict',
  'indexability-redirect-loop',
  'indexability-sitemap-robots-blocked',
]);

const RECONCILIATION_SOURCES = [
  INDEXABILITY_SOURCES.BROWSER_NAVIGATION,
  INDEXABILITY_SOURCES.ROBOTS_EVALUATION,
  INDEXABILITY_SOURCES.SITEMAP_MEMBERSHIP,
] as const;

function reconciliationCaptureNotes(
  evidenceSources: ReadonlySet<string> | undefined,
  headersAvailable: boolean,
  robotsAvailable: boolean,
): string[] {
  const notes: string[] = [];
  if (!headersAvailable) {
    notes.push(
      'HTTP response headers were not captured; X-Robots-Tag and Content-Type reconciliation is insufficient data.',
    );
  }
  if (!robotsAvailable) {
    notes.push(
      'robots.txt was not fetched; robots.txt evaluation reconciliation is insufficient data.',
    );
  }
  if (evidenceSources) {
    if (!evidenceSources.has(INDEXABILITY_SOURCES.ROBOTS_EVALUATION) && robotsAvailable) {
      notes.push(
        `${INDEXABILITY_SOURCES.ROBOTS_EVALUATION} evidence is missing; robots crawl-block reconciliation was not run.`,
      );
    }
    if (!evidenceSources.has(INDEXABILITY_SOURCES.SITEMAP_MEMBERSHIP)) {
      notes.push(
        `${INDEXABILITY_SOURCES.SITEMAP_MEMBERSHIP} evidence is missing; sitemap vs robots reconciliation was not run.`,
      );
    }
    if (!evidenceSources.has(INDEXABILITY_SOURCES.BROWSER_NAVIGATION) && headersAvailable) {
      notes.push(
        `${INDEXABILITY_SOURCES.BROWSER_NAVIGATION} evidence is missing; header and redirect reconciliation was not run.`,
      );
    }
  }
  return notes;
}

function deriveIndexabilityReason(input: {
  findings: Finding[];
  headersAvailable: boolean;
  robotsAvailable: boolean;
  evidenceSources?: ReadonlySet<string>;
}): { status: PageSummary['indexability']['status']; reason: string } {
  const capturedSignals = RECONCILIATION_SOURCES.filter((source) =>
    input.evidenceSources?.has(source),
  );
  const blockingFindings = input.findings.filter((finding) =>
    BLOCKING_RULE_IDS.has(finding.ruleId),
  );

  if (!input.headersAvailable && !input.robotsAvailable) {
    return {
      status: 'unknown',
      reason:
        'Crawl/index signals cannot be reconciled yet: response headers and robots.txt were not captured. DOM meta robots alone is insufficient data.',
    };
  }

  if (blockingFindings.length > 0) {
    const families = [...new Set(blockingFindings.map((finding) => finding.ruleId))].join(', ');
    return {
      status: 'signals-partial',
      reason: `Observed blocking crawl/index signals (${families}). This audit reports captured signals only, not a search engine indexing decision.`,
    };
  }

  if (capturedSignals.length > 0) {
    return {
      status: 'signals-partial',
      reason:
        'Captured crawl/index sources were reconciled and no blocking signals were observed in available evidence. Search-engine indexing status is not determined by this audit.',
    };
  }

  return {
    status: 'signals-partial',
    reason:
      'Partial crawl/index captures exist, but reconciliation evidence is incomplete. Treat indexability as unknown until navigation, robots evaluation, and optional sitemap membership are captured.',
  };
}

/**
 * Aggregate findings. Never claims the page is “indexable” or definitively indexed
 * by a search engine — only observed signals from captured evidence.
 */
export function buildPageSummary(input: PageSummaryInput): PageSummary {
  const bySeverity: Record<Severity, number> = { ...EMPTY_SEVERITY };
  const byCategory: Record<string, number> = {};

  for (const finding of input.findings) {
    bySeverity[finding.severity] += 1;
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
  }

  const featureAvailability = input.featureAvailability ?? {};
  const headersAvailable = featureAvailability.headerCapture === true;
  const robotsAvailable = featureAvailability.robotsFetch === true;

  const captureNotes: string[] = [
    ...reconciliationCaptureNotes(input.evidenceSources, headersAvailable, robotsAvailable),
  ];
  for (const err of input.captureErrors ?? []) {
    captureNotes.push(`${err.source}: ${err.message}`);
  }

  const indexability = deriveIndexabilityReason({
    findings: input.findings,
    headersAvailable,
    robotsAvailable,
    evidenceSources: input.evidenceSources,
  });

  return {
    totalFindings: input.findings.length,
    bySeverity,
    byCategory,
    indexability,
    captureNotes,
  };
}
