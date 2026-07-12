import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_NORMAL_TEXT } from '../lib/contrast';
import { renderFindingsPanel } from './findings-view';
import type { Finding } from '../lib/schemas/audit';

/**
 * Token pairs shipped in sidepanel.css. Measured here because axe colour-contrast
 * cannot run under JSDOM (HTMLCanvasElement.getContext is unimplemented).
 */
export const THEME_CONTRAST_SAMPLES = {
  light: {
    fgOnBg: { fg: '#1a1a1a', bg: '#f7f7f5' },
    mutedOnBg: { fg: '#555555', bg: '#f7f7f5' },
    accentTextOnAccent: { fg: '#ffffff', bg: '#0b5fff' },
  },
  dark: {
    fgOnBg: { fg: '#eceef2', bg: '#12141a' },
    mutedOnBg: { fg: '#b0b6c2', bg: '#12141a' },
    accentTextOnAccent: { fg: '#0b1220', bg: '#6ea8ff' },
  },
} as const;

const WORKSPACE_FIXTURE = `
<main id="workspace-main">
  <a class="skip-link" href="#workspace-main">Skip to workspace</a>
  <header>
    <h1>SEO Audit Workbench</h1>
    <p class="lede">Inspect the active tab.</p>
  </header>
  <p id="workspace-phase" class="phase-badge" aria-live="polite">State: Saved audit</p>
  <section aria-labelledby="tab-heading">
    <h2 id="tab-heading">Active tab</h2>
    <dl class="facts">
      <div><dt>URL</dt><dd>https://example.com/</dd></div>
      <div><dt>Access</dt><dd>Granted for https://example.com</dd></div>
    </dl>
    <p id="status-message" class="status" role="status" aria-live="polite">Audit saved.</p>
    <div class="actions">
      <button type="button">Start audit</button>
      <button type="button" class="secondary">Refresh</button>
      <button type="button" class="secondary">Open report</button>
    </div>
  </section>
  <section id="findings-section" aria-labelledby="findings-heading">
    <h2 id="findings-heading">Findings</h2>
    <p id="findings-summary" class="lede">1 findings</p>
    <div id="findings-panel"></div>
  </section>
</main>
`;

describe('workspace accessibility', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en';
    document.title = 'SEO Audit Workbench';
    document.body.innerHTML = WORKSPACE_FIXTURE;
    const finding: Finding = {
      id: 'f1',
      ruleId: 'title-missing',
      severity: 'error',
      category: 'metadata',
      affectedUrl: 'https://example.com/',
      description: 'Missing title',
      evidenceIds: [],
      recommendation: 'Add a title',
      sourceRef: 'https://developers.google.com/search/docs/appearance/title-link',
      capturedAt: '2026-07-12T12:00:00.000Z',
    };
    renderFindingsPanel(document.querySelector('#findings-panel')!, [finding], new Map());
  });

  it('has no serious or critical axe violations (excluding colour-contrast under JSDOM)', async () => {
    const results = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
      // JSDOM cannot measure contrast (canvas getContext missing). Token ratios
      // are asserted separately below — do not treat axe colour-contrast as evidence.
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  it('documents WCAG AA contrast for light and dark body tokens', () => {
    for (const [theme, samples] of Object.entries(THEME_CONTRAST_SAMPLES)) {
      for (const [name, pair] of Object.entries(samples)) {
        const ratio = contrastRatio(pair.fg, pair.bg);
        expect(
          ratio,
          `${theme}.${name} ${pair.fg} on ${pair.bg} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
      }
    }
  });
});
