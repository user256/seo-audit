import type { CaptureError, Finding, Severity } from '../schemas/audit';
import type { PageSummary } from './types';

export type PageSummaryInput = {
  findings: Finding[];
  featureAvailability?: Record<string, boolean | 'unavailable'>;
  captureErrors?: CaptureError[];
};

const EMPTY_SEVERITY: Record<Severity, number> = {
  info: 0,
  warning: 0,
  error: 0,
  critical: 0,
};

/**
 * Aggregate findings. Never claims the page is “indexable” when HTTP headers
 * or robots.txt were not captured — those signals live in later tickets.
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

  const captureNotes: string[] = [];
  if (!headersAvailable) {
    captureNotes.push('HTTP response headers were not captured in this session.');
  }
  if (!robotsAvailable) {
    captureNotes.push('robots.txt was not fetched in this session.');
  }
  for (const err of input.captureErrors ?? []) {
    captureNotes.push(`${err.source}: ${err.message}`);
  }

  const indexability =
    headersAvailable && robotsAvailable
      ? {
          // Full reconciliation lands in Ticket 204; still do not claim indexable here.
          status: 'signals-partial' as const,
          reason:
            'Header and robots captures exist, but indexability reconciliation is not implemented in Sprint 1.',
        }
      : {
          status: 'unknown' as const,
          reason:
            'Crawl/index status cannot be concluded yet: response headers and/or robots.txt were not captured. DOM meta robots alone is insufficient.',
        };

  return {
    totalFindings: input.findings.length,
    bySeverity,
    byCategory,
    indexability,
    captureNotes,
  };
}
