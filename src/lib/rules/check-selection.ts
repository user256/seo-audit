import type { AuditCheckSelection, Evidence } from '../schemas/audit';
import { CHECK_CATALOGUE } from './check-catalogue';
import type { CheckAvailabilityContext, CheckDescriptor } from './types';

export type CheckSelectionInput = {
  /** Omit this for the one-click safe default. */
  requestedCheckIds?: ReadonlySet<string>;
  availability: CheckAvailabilityContext;
  catalogue?: readonly CheckDescriptor[];
};

/** The safe, one-click audit deliberately excludes individually consented checks. */
export function defaultCheckIds(
  catalogue: readonly CheckDescriptor[] = CHECK_CATALOGUE,
): Set<string> {
  return new Set(catalogue.filter((check) => !check.optIn).map((check) => check.id));
}

/**
 * Resolve the requested set against the evidence captured for this audit. This
 * is also the durable coverage record: a skipped check always has a reason.
 */
export function resolveAuditCheckSelection(input: CheckSelectionInput): AuditCheckSelection {
  const catalogue = input.catalogue ?? CHECK_CATALOGUE;
  const requested = input.requestedCheckIds ?? defaultCheckIds(catalogue);
  const skippedCheckIds = new Set<string>();
  const skippedChecks: AuditCheckSelection['skippedChecks'] = [];
  const selectedCheckIds: string[] = [];

  for (const check of catalogue) {
    if (!requested.has(check.id)) {
      skippedCheckIds.add(check.id);
      skippedChecks.push({
        checkId: check.id,
        reason: check.optIn
          ? 'Optional experimental check was not consented to.'
          : 'Not selected in the audit wizard.',
      });
      continue;
    }

    const availability = check.availability(input.availability);
    if (availability.status !== 'available') {
      skippedCheckIds.add(check.id);
      skippedChecks.push({ checkId: check.id, reason: availability.reason });
      continue;
    }
    selectedCheckIds.push(check.id);
  }

  for (const id of requested) {
    if (!catalogue.some((check) => check.id === id) && !skippedCheckIds.has(id)) {
      skippedChecks.push({
        checkId: id,
        reason: 'Check is not registered in this extension version.',
      });
    }
  }

  return { selectedCheckIds, skippedChecks };
}

/** Build a catalogue availability context from an already-captured snapshot. */
export function availabilityFromEvidence(
  accessGranted: boolean,
  evidence: readonly Evidence[],
): CheckAvailabilityContext {
  return {
    accessGranted,
    evidenceBySource: new Map(evidence.map((item) => [item.source, item] as const)),
  };
}
