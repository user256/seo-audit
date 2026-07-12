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
    }
  });
});
