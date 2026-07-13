import type { AuditSession } from '../schemas/audit';
import type { Soft404ProbeRunState, VariantTestsRunState } from './crawl-signals-model';
import type { Soft404ProbeResult } from '../soft-404';
import {
  DEFAULT_VARIANT_KIND_OPTIONS,
  type VariantKindOptions,
  type VariantTestRunResult,
} from '../variants';

export type ComparisonEvidencePanelState = {
  variantBaseUrl: string;
  variantKindOptions: VariantKindOptions;
  variantRunState: VariantTestsRunState;
  variantResult: VariantTestRunResult | null;
  soft404ProbeUrl: string;
  soft404RunState: Soft404ProbeRunState;
  soft404Result: Soft404ProbeResult | null;
};

function runStateFromCancelled(cancelled: boolean): 'done' | 'cancelled' {
  return cancelled ? 'cancelled' : 'done';
}

/** Map persisted session comparison runs into crawl-signals panel memory. */
export function comparisonEvidenceFromSession(
  session: AuditSession,
  fallbackAuditedUrl: string,
): ComparisonEvidencePanelState {
  const variantTestRun = session.variantTestRun;
  const soft404ProbeRun = session.soft404ProbeRun;

  return {
    variantBaseUrl: variantTestRun?.baseUrl ?? fallbackAuditedUrl,
    variantKindOptions: variantTestRun?.kindOptions ?? { ...DEFAULT_VARIANT_KIND_OPTIONS },
    variantRunState: variantTestRun ? runStateFromCancelled(variantTestRun.cancelled) : 'idle',
    variantResult: variantTestRun ?? null,
    soft404ProbeUrl: soft404ProbeRun?.probeUrl ?? fallbackAuditedUrl,
    soft404RunState: soft404ProbeRun ? runStateFromCancelled(soft404ProbeRun.cancelled) : 'idle',
    soft404Result: soft404ProbeRun ?? null,
  };
}
