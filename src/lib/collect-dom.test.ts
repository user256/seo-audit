import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createChromeStub } from '../test/chrome-stub';
import { collectDomForActiveTab } from './collect-dom';
import { SessionRepository } from './storage/session-repository';
import { collectDomFactsInPage } from '../content/dom-collector';
import { FIXTURE_RELATIVE_URLS } from '../content/fixtures';

describe('collectDomForActiveTab', () => {
  beforeEach(() => {
    document.open();
    document.write(FIXTURE_RELATIVE_URLS);
    document.close();
    Object.defineProperty(document, 'URL', {
      configurable: true,
      get: () => 'https://example.com/shop/item',
    });
    Object.defineProperty(document, 'baseURI', {
      configurable: true,
      get: () => 'https://example.com/shop/',
    });
  });

  it('returns permission-denied CaptureError without calling scripting', async () => {
    const executeScript = async () => [];
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 4, url: 'https://example.com/shop/item' }],
        },
        permissions: {
          contains: async () => false,
        },
        scripting: { executeScript },
      }),
    });

    const result = await collectDomForActiveTab(new SessionRepository(new IDBFactory()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.captureError?.code).toBe('permission-denied');
    }
  });

  it('saves a session when access is granted', async () => {
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 4, url: 'https://example.com/shop/item' }],
        },
        permissions: {
          contains: async () => true,
        },
        scripting: {
          executeScript: async () => [{ result: collectDomFactsInPage() }],
        },
      }),
    });

    const repo = new SessionRepository(new IDBFactory());
    const result = await collectDomForActiveTab(repo);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const loaded = await repo.get(result.sessionId);
      expect(loaded.status).toBe('ok');
      expect(result.snapshot.captureLimits).toBeTruthy();
    }
  });

  it('records a navigation-race CaptureError when the tab URL changes mid-collection', async () => {
    let queryCount = 0;
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => {
            queryCount += 1;
            const url =
              queryCount === 1 ? 'https://example.com/shop/item' : 'https://example.com/shop/other';
            return [{ id: 4, url }];
          },
        },
        permissions: {
          contains: async () => true,
        },
        scripting: {
          executeScript: async () => [{ result: collectDomFactsInPage() }],
        },
      }),
    });

    const result = await collectDomForActiveTab(new SessionRepository(new IDBFactory()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.captureError?.code).toBe('navigation-race');
    }
  });

  it('records a navigation-race CaptureError when document URL diverges from the tab', async () => {
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 4, url: 'https://example.com/shop/item' }],
        },
        permissions: {
          contains: async () => true,
        },
        scripting: {
          executeScript: async () => {
            const facts = collectDomFactsInPage();
            facts.documentUrl = 'https://example.com/elsewhere';
            return [{ result: facts }];
          },
        },
      }),
    });

    const result = await collectDomForActiveTab(new SessionRepository(new IDBFactory()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.captureError?.code).toBe('navigation-race');
    }
  });

  it('rejects malformed collector payloads with dom-evidence-invalid', async () => {
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 4, url: 'https://example.com/shop/item' }],
        },
        permissions: {
          contains: async () => true,
        },
        scripting: {
          executeScript: async () => [{ result: { not: 'dom-facts' } }],
        },
      }),
    });

    const result = await collectDomForActiveTab(new SessionRepository(new IDBFactory()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.captureError?.code).toBe('dom-evidence-invalid');
    }
  });

  it('rejects a null executeScript result with collector-empty-result', async () => {
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 4, url: 'https://example.com/shop/item' }],
        },
        permissions: {
          contains: async () => true,
        },
        scripting: {
          executeScript: async () => [{ result: null }],
        },
      }),
    });

    const result = await collectDomForActiveTab(new SessionRepository(new IDBFactory()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.captureError?.code).toBe('collector-empty-result');
    }
  });
});
