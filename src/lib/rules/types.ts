import type { Evidence, Finding, PageSnapshot, Severity } from '../schemas/audit';
import type { FieldState } from '../../content/dom-collector';

export type RuleContext = {
  snapshot: PageSnapshot;
  evidenceBySource: Map<string, Evidence>;
  pageUrl: string;
  pageOrigin: string | null;
  capturedAt: string;
};

export type Rule = {
  id: string;
  run: (ctx: RuleContext) => Finding[];
};

export type PageSummary = {
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byCategory: Record<string, number>;
  /** Never "indexable" when headers/robots.txt were not captured. */
  indexability: {
    status: 'unknown' | 'signals-partial';
    reason: string;
  };
  captureNotes: string[];
};

export function isFieldState(value: unknown): value is FieldState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'state' in value &&
    typeof (value as { state: unknown }).state === 'string'
  );
}

export function fieldFromEvidence(evidence: Evidence | undefined): FieldState | undefined {
  if (!evidence) return undefined;
  return isFieldState(evidence.value) ? evidence.value : undefined;
}

export function makeFinding(partial: Omit<Finding, 'id'> & { id?: string }): Finding {
  return {
    id: partial.id ?? `${partial.ruleId}-${partial.evidenceIds[0] ?? 'none'}`,
    ruleId: partial.ruleId,
    severity: partial.severity,
    category: partial.category,
    affectedUrl: partial.affectedUrl,
    description: partial.description,
    evidenceIds: partial.evidenceIds,
    recommendation: partial.recommendation,
    sourceRef: partial.sourceRef,
    capturedAt: partial.capturedAt,
  };
}

export function buildRuleContext(snapshot: PageSnapshot): RuleContext {
  const evidenceBySource = new Map<string, Evidence>();
  for (const item of snapshot.evidence) {
    evidenceBySource.set(item.source, item);
  }
  let pageOrigin: string | null = null;
  try {
    pageOrigin = new URL(snapshot.url).origin;
  } catch {
    pageOrigin = null;
  }
  return {
    snapshot,
    evidenceBySource,
    pageUrl: snapshot.url,
    pageOrigin,
    capturedAt: snapshot.capturedAt,
  };
}
