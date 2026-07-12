import { describe, expect, it } from 'vitest';
import type { Finding } from '../lib/schemas/audit';
import {
  groupFindingsByCategory,
  phaseFromTab,
  sortFindings,
  withCollecting,
  withSavedAudit,
  withTab,
  initialWorkspace,
} from './workspace-state';

const baseFinding = (overrides: Partial<Finding>): Finding => ({
  id: 'f1',
  ruleId: 'title-missing',
  severity: 'error',
  category: 'metadata',
  affectedUrl: 'https://example.com/',
  description: 'Missing title',
  evidenceIds: ['title-0'],
  recommendation: 'Add a title',
  sourceRef: 'https://example.com/ref',
  capturedAt: '2026-07-12T12:00:00.000Z',
  ...overrides,
});

describe('workspace-state', () => {
  it('maps unsupported and permission phases from the active tab', () => {
    expect(
      phaseFromTab({
        status: 'unsupported',
        url: 'chrome://extensions',
        reason: 'unsupported',
      }),
    ).toBe('unsupported-tab');
    expect(
      phaseFromTab({
        status: 'ready',
        tabId: 1,
        url: 'https://example.com/',
        origin: 'https://example.com',
        pattern: 'https://example.com/*',
        granted: false,
      }),
    ).toBe('permission-required');
  });

  it('enters collecting then saved-audit without dropping session id', () => {
    let model = initialWorkspace();
    model = withTab(model, {
      status: 'ready',
      tabId: 1,
      url: 'https://example.com/',
      origin: 'https://example.com',
      pattern: 'https://example.com/*',
      granted: true,
    });
    model = withCollecting(model);
    expect(model.phase).toBe('collecting');
    model = withSavedAudit(model, {
      sessionId: 'sess-1',
      findings: [baseFinding({})],
      summary: {
        totalFindings: 1,
        bySeverity: { info: 0, warning: 0, error: 1, critical: 0 },
        byCategory: { metadata: 1 },
        indexability: { status: 'unknown', reason: 'no headers' },
        captureNotes: [],
      },
    });
    expect(model.phase).toBe('saved-audit');
    expect(model.sessionId).toBe('sess-1');
  });

  it('sorts findings by severity then category', () => {
    const sorted = sortFindings([
      baseFinding({ id: '2', severity: 'info', category: 'z', ruleId: 'b' }),
      baseFinding({ id: '1', severity: 'error', category: 'a', ruleId: 'a' }),
      baseFinding({ id: '3', severity: 'warning', category: 'm', ruleId: 'c' }),
    ]);
    expect(sorted.map((f) => f.id)).toEqual(['1', '3', '2']);
  });

  it('groups findings by category for expand/collapse UI', () => {
    const grouped = groupFindingsByCategory([
      baseFinding({ id: '1', category: 'metadata' }),
      baseFinding({ id: '2', category: 'indexability', ruleId: 'canonical-missing' }),
      baseFinding({ id: '3', category: 'metadata', ruleId: 'language-missing' }),
    ]);
    expect([...grouped.keys()]).toEqual(['indexability', 'metadata']);
    expect(grouped.get('metadata')).toHaveLength(2);
  });
});
