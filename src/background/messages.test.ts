import { beforeEach, describe, expect, it } from 'vitest';
import { createChromeStub } from '../test/chrome-stub';
import { handleExtensionRequest } from './messages';

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
});
