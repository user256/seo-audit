import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createChromeStub } from '../test/chrome-stub';
import { handleExtensionRequest } from './messages';
import { createEmptySession, SessionRepository } from '../lib/storage/session-repository';

describe('handleExtensionRequest', () => {
  beforeEach(() => {
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
      }),
    });
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
        granted: false,
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
