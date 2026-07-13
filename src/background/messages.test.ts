import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChromeStub } from '../test/chrome-stub';
import { resetCssJsComparisonState } from '../lib/css-js-compare';
import { resetClusterValidationState } from '../lib/hreflang/cluster-validate';
import { resetSoft404ProbeState } from '../lib/soft-404';
import { resetVariantTestState } from '../lib/variants';
import { handleExtensionRequest } from './messages';
import { createEmptySession, SessionRepository } from '../lib/storage/session-repository';
import {
  sampleSoft404ProbeResult,
  sampleVariantTestRunResult,
} from '../lib/schemas/comparison-evidence';

describe('handleExtensionRequest', () => {
  beforeEach(() => {
    resetClusterValidationState();
    resetVariantTestState();
    resetSoft404ProbeState();
    resetCssJsComparisonState();
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 9, url: 'https://shop.example/item' }],
        },
        permissions: {
          contains: async () => false,
          request: async () => true,
        },
        scripting: {
          executeScript: async () => [
            { result: { pong: true, href: 'https://shop.example/item' } },
          ],
        },
        runtime: {
          sendMessage: async () => undefined,
        },
      }),
    });
  });

  afterEach(() => {
    resetClusterValidationState();
    resetVariantTestState();
    resetSoft404ProbeState();
    resetCssJsComparisonState();
    vi.unstubAllGlobals();
  });

  it('returns an active-tab snapshot for GET_ACTIVE_TAB_SNAPSHOT', async () => {
    const response = await handleExtensionRequest({ type: 'GET_ACTIVE_TAB_SNAPSHOT' });
    expect(response).toEqual({
      type: 'ACTIVE_TAB_SNAPSHOT',
      snapshot: {
        status: 'ready',
        tabId: 9,
        url: 'https://shop.example/item',
        origin: 'https://shop.example',
        pattern: 'https://shop.example/*',
        granted: true,
      },
    });
  });

  it('round-trips a content-script ping', async () => {
    const response = await handleExtensionRequest({
      type: 'PING_ACTIVE_TAB',
      tabId: 9,
    });
    expect(response).toEqual({
      type: 'PING_RESULT',
      result: { ok: true, pong: true, href: 'https://shop.example/item' },
    });
  });

  it('cancels an in-flight hreflang cluster validation by requestId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const signal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }),
    );

    const run = handleExtensionRequest({
      type: 'VALIDATE_HREFLANG_CLUSTER',
      requestId: 'cluster-cancel-test',
      seedUrl: 'https://shop.example/en',
      alternates: [
        { hreflang: 'en', href: 'https://shop.example/en' },
        { hreflang: 'de', href: 'https://shop.example/de' },
      ],
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const cancel = await handleExtensionRequest({
      type: 'CANCEL_HREFLANG_CLUSTER',
      requestId: 'cluster-cancel-test',
    });
    expect(cancel).toEqual({
      type: 'HREFLANG_CLUSTER_CANCELLED',
      requestId: 'cluster-cancel-test',
      cancelled: true,
    });

    const result = await run;
    expect(result.type).toBe('HREFLANG_CLUSTER_RESULT');
    if (result.type === 'HREFLANG_CLUSTER_RESULT') {
      expect(result.result.cancelled).toBe(true);
      expect(result.result.requestId).toBe('cluster-cancel-test');
    }
  });

  it('cancels an in-flight URL variant test run by requestId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const signal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }),
    );

    const run = handleExtensionRequest({
      type: 'RUN_URL_VARIANT_TESTS',
      requestId: 'variant-cancel-test',
      baseUrl: 'https://shop.example/item',
      kindOptions: {
        scheme: true,
        www: true,
        trailingSlash: true,
        case: false,
        indexFilenames: false,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const cancel = await handleExtensionRequest({
      type: 'CANCEL_URL_VARIANT_TESTS',
      requestId: 'variant-cancel-test',
    });
    expect(cancel).toEqual({
      type: 'URL_VARIANT_TESTS_CANCELLED',
      requestId: 'variant-cancel-test',
      cancelled: true,
    });

    const result = await run;
    expect(result.type).toBe('URL_VARIANT_TESTS_RESULT');
    if (result.type === 'URL_VARIANT_TESTS_RESULT') {
      expect(result.result.cancelled).toBe(true);
      expect(result.result.requestId).toBe('variant-cancel-test');
    }
  });

  it('cancels an in-flight soft-404 probe by requestId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const signal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }),
    );

    const run = handleExtensionRequest({
      type: 'RUN_SOFT_404_PROBE',
      requestId: 'soft-404-cancel-test',
      auditedUrl: 'https://shop.example/item',
      probeUrl: 'https://shop.example/seo-audit-probe-cancel',
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const cancel = await handleExtensionRequest({
      type: 'CANCEL_SOFT_404_PROBE',
      requestId: 'soft-404-cancel-test',
    });
    expect(cancel).toEqual({
      type: 'SOFT_404_PROBE_CANCELLED',
      requestId: 'soft-404-cancel-test',
      cancelled: true,
    });

    const result = await run;
    expect(result.type).toBe('SOFT_404_PROBE_RESULT');
    if (result.type === 'SOFT_404_PROBE_RESULT') {
      expect(result.result.cancelled).toBe(true);
      expect(result.result.requestId).toBe('soft-404-cancel-test');
    }
  });

  it('runs a CSS/JS comparison end-to-end and always closes the experiment tab', async () => {
    const createdTabIds: number[] = [];
    const removedTabIds: number[] = [];
    let nextTabId = 100;

    function sampleFacts(title: string) {
      return {
        documentUrl: 'https://shop.example/item',
        baseUri: 'https://shop.example/item',
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
      };
    }

    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 9, url: 'https://shop.example/item' }],
          get: async (tabId: number) => ({ id: tabId, status: 'complete' }),
          create: async () => {
            const id = nextTabId;
            nextTabId += 1;
            createdTabIds.push(id);
            return { id };
          },
          remove: async (tabId: number) => {
            removedTabIds.push(tabId);
          },
          onUpdated: {
            addListener: () => undefined,
            removeListener: () => undefined,
          },
        },
        permissions: { contains: async () => false, request: async () => true },
        scripting: {
          executeScript: async ({
            target,
            func,
          }: {
            target: { tabId: number };
            func: (...args: unknown[]) => unknown;
          }) => {
            if (func.name === 'collectDomFactsInPage') {
              return [{ result: sampleFacts(target.tabId === 9 ? 'Baseline' : 'Experiment') }];
            }
            if (func.name === 'collectVisibleTextFingerprintInPage') {
              return [
                { result: { charCount: 12, hash: 'cafebabe', sampleText: 'hi', truncated: false } },
              ];
            }
            if (func.name === 'disableCssInPage') {
              return [
                {
                  result: {
                    methodVersion: 'css-injection-disable-v1',
                    disabledStylesheetCount: 0,
                    totalStylesheetCount: 0,
                    inaccessibleStylesheetCount: 0,
                    removedInlineStyleAttrCount: 0,
                    appliedAt: '2026-07-13T12:00:00.000Z',
                  },
                },
              ];
            }
            return [{ result: null }];
          },
        },
        runtime: { sendMessage: async () => undefined },
      }),
    });

    const response = await handleExtensionRequest({
      type: 'RUN_CSS_JS_COMPARISON',
      requestId: 'css-js-e2e',
      activeTabId: 9,
      auditedUrl: 'https://shop.example/item',
    });

    expect(response.type).toBe('CSS_JS_COMPARISON_RESULT');
    if (response.type === 'CSS_JS_COMPARISON_RESULT') {
      expect(response.result.cancelled).toBe(false);
      expect(response.result.experimentTabRestored).toBe(true);
      expect(response.result.baseline.ok).toBe(true);
      expect(response.result.experiment.ok).toBe(true);
      expect(response.result.diffs.some((d) => d.field === 'title' && d.changed)).toBe(true);
    }
    expect(createdTabIds).toHaveLength(1);
    expect(removedTabIds).toEqual(createdTabIds);
  });

  it('cancels an in-flight CSS/JS comparison by requestId', async () => {
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 9, url: 'https://shop.example/item' }],
          get: async (tabId: number) => ({ id: tabId, status: 'complete' }),
          create: async () => ({ id: 200 }),
          remove: async () => undefined,
          onUpdated: {
            addListener: () => undefined,
            removeListener: () => undefined,
          },
        },
        permissions: { contains: async () => false, request: async () => true },
        scripting: {
          executeScript: async ({ func }: { func: (...args: unknown[]) => unknown }) => {
            // Slow down the baseline capture so a cancel can land while the run is in flight.
            if (func.name === 'collectDomFactsInPage') {
              await new Promise((resolve) => setTimeout(resolve, 20));
            }
            return [{ result: null }];
          },
        },
        runtime: { sendMessage: async () => undefined },
      }),
    });

    const run = handleExtensionRequest({
      type: 'RUN_CSS_JS_COMPARISON',
      requestId: 'css-js-cancel-test',
      activeTabId: 9,
      auditedUrl: 'https://shop.example/item',
    });

    const cancel = await handleExtensionRequest({
      type: 'CANCEL_CSS_JS_COMPARISON',
      requestId: 'css-js-cancel-test',
    });
    expect(cancel).toEqual({
      type: 'CSS_JS_COMPARISON_CANCELLED',
      requestId: 'css-js-cancel-test',
      cancelled: true,
    });

    const result = await run;
    expect(result.type).toBe('CSS_JS_COMPARISON_RESULT');
    if (result.type === 'CSS_JS_COMPARISON_RESULT') {
      expect(result.result.cancelled).toBe(true);
      expect(result.result.requestId).toBe('css-js-cancel-test');
    }
  });

  it('finds the latest session for a URL via FIND_LATEST_SESSION_FOR_URL', async () => {
    const repo = new SessionRepository();
    await repo.save(
      createEmptySession({
        id: 'url-sess',
        tabUrl: 'https://shop.example/item',
        finalUrl: 'https://shop.example/item',
        extensionVersion: '0.1.0',
      }),
    );

    const response = await handleExtensionRequest({
      type: 'FIND_LATEST_SESSION_FOR_URL',
      url: 'https://shop.example/item',
    });
    expect(response.type).toBe('LATEST_SESSION_FOR_URL');
    if (response.type === 'LATEST_SESSION_FOR_URL') {
      expect(response.result).toMatchObject({
        status: 'ok',
        session: { id: 'url-sess' },
      });
    }

    const missing = await handleExtensionRequest({
      type: 'FIND_LATEST_SESSION_FOR_URL',
      url: 'https://missing.example/',
    });
    expect(missing).toEqual({
      type: 'LATEST_SESSION_FOR_URL',
      result: { status: 'none' },
    });
  });

  it('persists and restores bounded variant and soft-404 probe runs on a session', async () => {
    const repo = new SessionRepository();
    const session = createEmptySession({
      id: 'comparison-sess',
      tabUrl: 'https://shop.example/item',
      finalUrl: 'https://shop.example/item',
      extensionVersion: '0.1.0',
    });
    await repo.save(session);

    const variant = sampleVariantTestRunResult({ cancelled: false });
    const probe = sampleSoft404ProbeResult({ cancelled: true });

    const variantSaved = await handleExtensionRequest({
      type: 'SAVE_VARIANT_TEST_RUN',
      sessionId: 'comparison-sess',
      result: variant,
    });
    expect(variantSaved).toEqual({
      type: 'VARIANT_TEST_RUN_SAVED',
      sessionId: 'comparison-sess',
    });

    const probeSaved = await handleExtensionRequest({
      type: 'SAVE_SOFT_404_PROBE_RUN',
      sessionId: 'comparison-sess',
      result: probe,
    });
    expect(probeSaved).toEqual({
      type: 'SOFT_404_PROBE_RUN_SAVED',
      sessionId: 'comparison-sess',
    });

    const loaded = await handleExtensionRequest({
      type: 'LOAD_SESSION',
      sessionId: 'comparison-sess',
    });
    expect(loaded.type).toBe('SESSION_LOADED');
    if (loaded.type === 'SESSION_LOADED' && loaded.result.status === 'ok') {
      expect(loaded.result.session.variantTestRun).toMatchObject({
        requestId: 'vt-sample',
        cancelled: false,
      });
      expect(loaded.result.session.soft404ProbeRun).toMatchObject({
        requestId: 'sf-sample',
        cancelled: true,
      });
      expect(JSON.stringify(loaded.result.session)).not.toMatch(/bodyText|rawBody|htmlBody/i);
    }
  });
});
