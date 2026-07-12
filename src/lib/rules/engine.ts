import type { Finding, PageSnapshot } from '../schemas/audit';
import { PAGE_RULES } from './page-rules';
import { buildPageSummary, type PageSummaryInput } from './summary';
import { buildRuleContext, type PageSummary } from './types';

export type EvaluatePageResult = {
  findings: Finding[];
  summary: PageSummary;
};

/**
 * Run all page rules against a DOM PageSnapshot.
 * Deterministic: same snapshot → same finding order and IDs.
 */
export function evaluatePageSnapshot(
  snapshot: PageSnapshot,
  extras: Omit<PageSummaryInput, 'findings'> = {},
): EvaluatePageResult {
  const ctx = buildRuleContext(snapshot);
  const findings = PAGE_RULES.flatMap((rule) => rule.run(ctx));
  const summary = buildPageSummary({
    findings,
    featureAvailability: extras.featureAvailability,
    captureErrors: extras.captureErrors,
  });
  return { findings, summary };
}

export { buildPageSummary } from './summary';
export type { PageSummary } from './types';
export { PAGE_RULES } from './page-rules';
