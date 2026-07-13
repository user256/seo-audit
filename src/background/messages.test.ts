import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChromeStub } from '../test/chrome-stub';
import { resetClusterValidationState } from '../lib/hreflang/cluster-validate';
import { resetSoft404ProbeState } from '../lib/soft-404';
import { resetVariantTestState } from '../lib/variants';
import { handleExtensionRequest } from './messages';
import { createEmptySession, SessionRepository } from '../lib/storage/session-repository';

describe('handleExtensionRequest', () => {
  beforeEach(() => {
    resetClusterValidationState();
    resetVariantTestState();
    resetSoft404ProbeState();
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
});
