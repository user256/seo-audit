import { describe, expect, it } from 'vitest';
import type { Evidence } from '../schemas/audit';
import { CHECK_CATALOGUE } from './check-catalogue';
import {
  availabilityFromEvidence,
  defaultCheckIds,
  resolveAuditCheckSelection,
} from './check-selection';

const titleEvidence: Evidence = {
  id: 'title-evidence',
  kind: 'dom',
  source: 'title',
  value: { state: 'present', value: 'Example title', selector: 'title' },
  capturedAt: '2026-07-12T12:00:00.000Z',
};

describe('audit check selection', () => {
  it('defaults to every safe catalogue check and never to opt-in checks', () => {
    expect([...defaultCheckIds()]).toEqual(
      CHECK_CATALOGUE.filter((check) => !check.optIn).map((check) => check.id),
    );
  });

  it('records unavailable checks as skipped with their catalogue reason', () => {
    const selection = resolveAuditCheckSelection({
      requestedCheckIds: new Set(['title-missing-or-duplicate', 'canonical-rules']),
      availability: availabilityFromEvidence(true, [titleEvidence]),
    });

    expect(selection.selectedCheckIds).toEqual(['title-missing-or-duplicate']);
    expect(selection.skippedChecks).toContainEqual({
      checkId: 'canonical-rules',
      reason: 'Required evidence has not been captured: link[rel=canonical].',
    });
  });
});
