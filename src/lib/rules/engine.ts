import type { Finding, PageSnapshot } from '../schemas/audit';
import { CHECK_CATALOGUE } from './check-catalogue';
import { buildPageSummary, type PageSummaryInput } from './summary';
import { buildRuleContext, type PageSummary } from './types';

export type EvaluatePageResult = {
  findings: Finding[];
  summary: PageSummary;
};

export type EvaluatePageOptions = Omit<PageSummaryInput, 'findings'> & {
  /** Omit to run every default (non-opt-in) check. */
  checkIds?: ReadonlySet<string>;
};

/**
 * Run all page rules against a DOM PageSnapshot.
 * Deterministic: same snapshot → same finding order and IDs.
 */
export function evaluatePageSnapshot(
  snapshot: PageSnapshot,
  options: EvaluatePageOptions = {},
): EvaluatePageResult {
  const ctx = buildRuleContext(snapshot);
  const checks = options.checkIds
    ? CHECK_CATALOGUE.filter((check) => options.checkIds!.has(check.id))
    : CHECK_CATALOGUE.filter((check) => !check.optIn);
  const findings = checks.flatMap((check) => check.run(ctx));
  const evidenceSources = new Set(snapshot.evidence.map((item) => item.source));
  const summary = buildPageSummary({
    findings,
    featureAvailability: options.featureAvailability,
    captureErrors: options.captureErrors,
    evidenceSources,
  });
  return { findings, summary };
}

export { buildPageSummary } from './summary';
export type {
  CheckAvailability,
  CheckAvailabilityContext,
  CheckAvailabilityStatus,
  CheckDescriptor,
  PageSummary,
} from './types';
export {
  CHECK_CATALOGUE,
  PAGE_RULES,
  resolveCheckAvailability,
  type ResolvedCheckAvailability,
} from './check-catalogue';
