import { describe, expect, it } from 'vitest';
import type { Evidence } from '../lib/schemas/audit';
import type { CheckDescriptor } from '../lib/rules/types';
import { renderCheckSelectionView } from './check-selection-view';

const titleEvidence: Evidence = {
  id: 'title-evidence',
  kind: 'dom',
  source: 'title',
  value: { state: 'present', value: 'Example title', selector: 'title' },
  capturedAt: '2026-07-12T12:00:00.000Z',
};

const optionalExperiment: CheckDescriptor = {
  id: 'experiment-check',
  label: 'Render comparison',
  description: 'Compares a bounded rendering experiment.',
  category: 'experiments',
  requiredSources: ['title'],
  cost: 'experiment',
  optIn: true,
  sourceRef: 'https://example.com/check',
  run: () => [],
  availability: ({ evidenceBySource }) =>
    evidenceBySource.has('title')
      ? { status: 'available', reason: 'Required evidence is available.' }
      : { status: 'unavailable', reason: 'Required evidence has not been captured: title.' },
};

describe('check selection view', () => {
  it('disables missing-evidence checks and exposes the reason', () => {
    const host = document.createElement('div');
    renderCheckSelectionView(host, {
      availability: { accessGranted: true, evidenceBySource: new Map() },
      selectedCheckIds: new Set(['experiment-check']),
      catalogue: [optionalExperiment],
      onSelectionChange: () => undefined,
    });

    const checkbox = host.querySelector<HTMLInputElement>('#check-experiment-check');
    expect(checkbox?.disabled).toBe(true);
    expect(host.textContent).toContain('Required evidence has not been captured: title.');
  });

  it('keeps opt-in checks unchecked and discloses permission and network consequences', () => {
    const host = document.createElement('div');
    renderCheckSelectionView(host, {
      availability: {
        accessGranted: true,
        evidenceBySource: new Map([['title', titleEvidence]]),
      },
      selectedCheckIds: new Set(),
      catalogue: [optionalExperiment],
      onSelectionChange: () => undefined,
    });

    const checkbox = host.querySelector<HTMLInputElement>('#check-experiment-check');
    expect(checkbox?.checked).toBe(false);
    expect(host.textContent).toMatch(/explicit selection.*site access.*network requests/i);
  });
});
