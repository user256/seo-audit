import { describe, expect, it } from 'vitest';
import type { Evidence } from '../schemas/audit';
import { CHECK_CATALOGUE, resolveCheckAvailability } from './check-catalogue';

const titleEvidence: Evidence = {
  id: 'ev-title',
  kind: 'dom',
  source: 'title',
  value: {
    state: 'present',
    value: 'Example page title',
    selector: 'title',
  },
  capturedAt: '2026-07-12T12:00:00.000Z',
};

function titleCheck() {
  const check = CHECK_CATALOGUE.find((item) => item.id === 'title-missing-or-duplicate');
  if (!check) throw new Error('Title check is not registered.');
  return check;
}

describe('CHECK_CATALOGUE', () => {
  it('registers every existing page rule with complete stable metadata', () => {
    expect(CHECK_CATALOGUE.map((check) => check.id)).toEqual([
      'title-missing-or-duplicate',
      'title-length-advisory',
      'description-missing-or-duplicate',
      'canonical-rules',
      'robots-meta-directives',
      'hreflang-invalid-url',
      'hreflang-directive-validation',
      'jsonld-malformed',
      'jsonld-structural-validation',
      'language-missing',
      'images-missing-alt',
      'images-empty-alt-advisory',
      'indexability-noindex-signal',
      'indexability-robots-conflict',
      'indexability-robots-blocked',
      'indexability-canonical-mismatch',
      'indexability-redirect-anomaly',
      'indexability-non-html-content',
      'indexability-sitemap-robots-blocked',
    ]);
    for (const check of CHECK_CATALOGUE) {
      expect(check.label).not.toBe('');
      expect(check.description).not.toBe('');
      expect(check.category).not.toBe('');
      expect(check.requiredSources.length).toBeGreaterThan(0);
      if (check.id.startsWith('indexability-')) {
        expect(check.cost).toBe('network');
      } else {
        expect(check.cost).toBe('dom');
      }
      expect(check.optIn).toBe(false);
      expect(check.sourceRef).toMatch(/^https:\/\//);
    }
  });

  it('reports availability from access and captured evidence without treating absent sources as passes', () => {
    const check = titleCheck();

    expect(
      check.availability({
        accessGranted: true,
        evidenceBySource: new Map([['title', titleEvidence]]),
      }),
    ).toEqual({
      status: 'available',
      reason: 'Required evidence is available.',
    });
    expect(check.availability({ accessGranted: false, evidenceBySource: new Map() })).toMatchObject(
      {
        status: 'needs-access',
      },
    );
    expect(check.availability({ accessGranted: true, evidenceBySource: new Map() })).toMatchObject({
      status: 'unavailable',
    });
  });

  it('keeps persisted evidence available without a new grant and exposes inaccessible fields', () => {
    const available = resolveCheckAvailability({
      accessGranted: false,
      evidenceBySource: new Map([['title', titleEvidence]]),
    });
    expect(available.find((item) => item.checkId === 'title-missing-or-duplicate')).toMatchObject({
      status: 'available',
    });

    const inaccessible: Evidence = {
      ...titleEvidence,
      value: { state: 'inaccessible', detail: 'Collector did not have page access.' },
    };
    expect(
      titleCheck().availability({
        accessGranted: true,
        evidenceBySource: new Map([['title', inaccessible]]),
      }),
    ).toMatchObject({ status: 'unavailable' });
  });
});
