import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderCrawlSignalsPanel, type CrawlSignalsViewHandlers } from './crawl-signals-view';
import { buildCrawlSignalsModel } from '../lib/dashboard/crawl-signals-model';

function makeHandlers(): CrawlSignalsViewHandlers {
  return {
    onFetchRobots: vi.fn(),
    onFetchSitemap: vi.fn(),
    onUaProfileSelectionChange: vi.fn(),
    onUaProfileCustomUaChange: vi.fn(),
    onValidateHreflangCluster: vi.fn(),
    onCancelHreflangCluster: vi.fn(),
    onRunVariantTests: vi.fn(),
    onCancelVariantTests: vi.fn(),
    onVariantBaseUrlChange: vi.fn(),
    onVariantKindChange: vi.fn(),
    onRunSoft404Probe: vi.fn(),
    onCancelSoft404Probe: vi.fn(),
    onSoft404ProbeUrlChange: vi.fn(),
    onRunCssJsComparison: vi.fn(),
    onCancelCssJsComparison: vi.fn(),
  };
}

function renderPanel(accessGranted = true) {
  const container = document.createElement('section');
  document.body.append(container);
  const handlers = makeHandlers();
  const model = buildCrawlSignalsModel({
    tabUrl: 'https://example.com/page',
    documentUrl: 'https://example.com/page',
    origin: 'https://example.com',
    accessGranted,
  });
  renderCrawlSignalsPanel(container, model, handlers);
  return { container, handlers, model };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('renderCrawlSignalsPanel', () => {
  it('renders the heading, audited URL, and every signal panel', () => {
    const { container } = renderPanel();

    expect(container.querySelector('h2')?.textContent).toBe('Crawl signals');
    expect(container.textContent).toContain('https://example.com/page');
    for (const id of [
      'crawl-panel-navigation',
      'crawl-panel-robots',
      'crawl-panel-sitemap',
      'crawl-panel-ua-profile',
      'crawl-panel-hreflang-cluster',
      'crawl-panel-variant-tests',
      'crawl-panel-soft-404',
      'crawl-panel-css-js-comparison',
    ]) {
      expect(container.querySelector(`#${id}`), id).not.toBeNull();
    }
  });

  it('discloses the panel-open background fetch and that the page never reloads', () => {
    const { container } = renderPanel();
    const note = container.querySelector('#crawl-auto-fetch-note');

    expect(note).not.toBeNull();
    expect(note?.textContent).toContain('fetched automatically in the background');
    expect(note?.textContent).toContain('without cookies or credentials');
    expect(note?.textContent).toContain('never reloaded');
  });

  it('wires the robots and sitemap fetch buttons to their handlers', () => {
    const { container, handlers } = renderPanel();

    (container.querySelector('#fetch-robots') as HTMLButtonElement).click();
    expect(handlers.onFetchRobots).toHaveBeenCalledTimes(1);

    (container.querySelector('#fetch-sitemap') as HTMLButtonElement).click();
    expect(handlers.onFetchSitemap).toHaveBeenCalledTimes(1);
  });

  it('keeps a previously opened panel open across re-renders', () => {
    const { container, handlers, model } = renderPanel();
    const robotsPanel = container.querySelector('#crawl-panel-robots') as HTMLDetailsElement;
    robotsPanel.open = true;

    renderCrawlSignalsPanel(container, model, handlers);
    const reRendered = container.querySelector('#crawl-panel-robots') as HTMLDetailsElement;
    expect(reRendered.open).toBe(true);
  });
});
