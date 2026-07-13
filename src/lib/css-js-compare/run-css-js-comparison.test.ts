import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomFacts } from '../../content/dom-collector';
import { CSS_DISABLE_METHOD_VERSION } from '../../content/css-disable-injection';
import {
  cancelCssJsComparison,
  resetCssJsComparisonState,
  runCssJsComparison,
} from './run-css-js-comparison';
import type { CssJsCompareChromeOps } from './types';

function domFacts(title: string): DomFacts {
  return {
    documentUrl: 'https://example.com/page',
    baseUri: 'https://example.com/page',
    collectedAt: '2026-07-13T12:00:00.000Z',
    title: { state: 'present', value: title, selector: 'title', count: 1 },
    metaDescription: { state: 'absent' },
    metaRobots: { state: 'absent' },
    canonical: { state: 'absent' },
    alternates: { state: 'absent' },
    openGraph: { state: 'absent' },
    twitter: { state: 'absent' },
    language: { state: 'absent' },
    viewport: { state: 'absent' },
    headings: {
      state: 'present',
      value: { levels: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 }, samples: [] },
      selector: 'h1–h6',
      count: 1,
    },
    links: {
      state: 'present',
      value: { total: 1, internal: 1, external: 0, other: 0, inventory: [] },
      selector: 'a[href]',
      count: 1,
    },
    images: {
      state: 'present',
      value: { total: 0, withAlt: 0, emptyAlt: 0, missingAlt: 0, inventory: [] },
      selector: 'img',
      count: 0,
    },
    html5: {
      state: 'present',
      value: {
        doctype: null,
        counts: { main: 0, nav: 0, header: 0, footer: 0, article: 0, section: 0, aside: 0 },
        hasMain: false,
        landmarkTotal: 0,
      },
      selector: 'main,nav,header,footer,article,section,aside',
      count: 0,
    },
    jsonLd: { state: 'absent' },
  } as DomFacts;
}

function fakeOps(overrides: Partial<CssJsCompareChromeOps> = {}): {
  ops: CssJsCompareChromeOps;
  createTab: ReturnType<typeof vi.fn>;
  closeTab: ReturnType<typeof vi.fn>;
} {
  const createTab = vi.fn(async () => 42);
  const closeTab = vi.fn(async () => undefined);
  const ops: CssJsCompareChromeOps = {
    captureDomFacts: vi.fn(async (tabId: number) =>
      domFacts(tabId === 1 ? 'Baseline' : 'Experiment'),
    ),
    captureVisibleText: vi.fn(async () => ({
      charCount: 100,
      hash: 'deadbeef',
      sampleText: 'sample',
      truncated: false,
    })),
    createTab,
    waitForTabLoad: vi.fn(async () => true),
    disableCss: vi.fn(async () => ({
      methodVersion: CSS_DISABLE_METHOD_VERSION,
      disabledStylesheetCount: 2,
      totalStylesheetCount: 2,
      inaccessibleStylesheetCount: 0,
      removedInlineStyleAttrCount: 0,
      appliedAt: '2026-07-13T12:00:00.000Z',
    })),
    closeTab,
    ...overrides,
  };
  return { ops, createTab, closeTab };
}

describe('runCssJsComparison', () => {
  beforeEach(() => {
    resetCssJsComparisonState();
  });

  afterEach(() => {
    resetCssJsComparisonState();
  });

  it('captures baseline and experiment, diffs them, and closes the experiment tab', async () => {
    const { ops, createTab, closeTab } = fakeOps();

    const result = await runCssJsComparison({
      requestId: 'ccj-1',
      activeTabId: 1,
      auditedUrl: 'https://example.com/page',
      chromeOps: ops,
    });

    expect(createTab).toHaveBeenCalledWith('https://example.com/page');
    expect(closeTab).toHaveBeenCalledWith(42);
    expect(result.cancelled).toBe(false);
    expect(result.methodVersion).toBe(CSS_DISABLE_METHOD_VERSION);
    expect(result.experimentTabRestored).toBe(true);
    expect(result.baseline.ok).toBe(true);
    expect(result.experiment.ok).toBe(true);
    expect(result.diffs.some((d) => d.field === 'title' && d.changed)).toBe(true);
    expect(result.observations.some((o) => o.kind === 'title-changed')).toBe(true);
    expect(result.javascriptOff.supported).toBe(false);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it('closes the experiment tab even when the experiment capture fails', async () => {
    const { ops, closeTab } = fakeOps({
      captureDomFacts: vi.fn(async (tabId: number) => (tabId === 1 ? domFacts('Baseline') : null)),
    });

    const result = await runCssJsComparison({
      requestId: 'ccj-2',
      activeTabId: 1,
      auditedUrl: 'https://example.com/page',
      chromeOps: ops,
    });

    expect(closeTab).toHaveBeenCalledWith(42);
    expect(result.experiment.ok).toBe(false);
    expect(result.diffs).toEqual([]);
    expect(result.limitations.some((line) => line.includes('Experiment capture failed'))).toBe(
      true,
    );
  });

  it('never opens a tab if cancelled before baseline capture finishes', async () => {
    const { ops, createTab } = fakeOps();
    ops.captureDomFacts = vi.fn(async () => {
      cancelCssJsComparison('ccj-3');
      return domFacts('Baseline');
    });

    const result = await runCssJsComparison({
      requestId: 'ccj-3',
      activeTabId: 1,
      auditedUrl: 'https://example.com/page',
      chromeOps: ops,
    });

    expect(createTab).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(true);
    expect(result.experimentTabRestored).toBe(true);
    expect(result.diffs).toEqual([]);
  });

  it('still closes the experiment tab when cancelled mid-run', async () => {
    const { ops, closeTab } = fakeOps();
    ops.disableCss = vi.fn(async () => {
      cancelCssJsComparison('ccj-4');
      return null;
    });

    const result = await runCssJsComparison({
      requestId: 'ccj-4',
      activeTabId: 1,
      auditedUrl: 'https://example.com/page',
      chromeOps: ops,
    });

    expect(closeTab).toHaveBeenCalledWith(42);
    expect(result.cancelled).toBe(true);
    expect(result.experiment.ok).toBe(false);
    expect(result.limitations.some((line) => line.includes('cancelled'))).toBe(true);
  });

  it('records a limitation and still restores when tab creation fails', async () => {
    const { ops, closeTab } = fakeOps({
      createTab: vi.fn(async () => {
        throw new Error('cannot open tab');
      }),
    });

    const result = await runCssJsComparison({
      requestId: 'ccj-5',
      activeTabId: 1,
      auditedUrl: 'https://example.com/page',
      chromeOps: ops,
    });

    expect(closeTab).not.toHaveBeenCalled();
    expect(result.experimentTabRestored).toBe(true);
    expect(result.experiment.ok).toBe(false);
    expect(
      result.limitations.some((line) => line.includes('Could not open the comparison tab')),
    ).toBe(true);
  });

  it('reports progress phases in order', async () => {
    const { ops } = fakeOps();
    const phases: string[] = [];

    await runCssJsComparison({
      requestId: 'ccj-6',
      activeTabId: 1,
      auditedUrl: 'https://example.com/page',
      chromeOps: ops,
      onProgress: (progress) => phases.push(progress.phase),
    });

    expect(phases).toEqual([
      'capturing-baseline',
      'opening-tab',
      'waiting-for-load',
      'disabling-css',
      'capturing-experiment',
      'comparing',
      'done',
    ]);
  });
});
