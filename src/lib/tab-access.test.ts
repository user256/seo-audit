import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChromeStub } from '../test/chrome-stub';
import { getActiveTabSnapshot, pingActiveTab, requestOriginAccess } from './tab-access';

describe('getActiveTabSnapshot', () => {
  beforeEach(() => {
    Object.assign(globalThis, { chrome: createChromeStub() });
  });

  it('reports ready + granted=false for an https tab without permission', async () => {
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 7, url: 'https://example.com/page' }],
        },
        permissions: {
          contains: async () => false,
        },
      }),
    });

    await expect(getActiveTabSnapshot()).resolves.toEqual({
      status: 'ready',
      tabId: 7,
      url: 'https://example.com/page',
      origin: 'https://example.com',
      pattern: 'https://example.com/*',
      granted: false,
    });
  });

  it('explains unsupported chrome:// tabs without calling permissions.request', async () => {
    const request = vi.fn(async () => false);
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 3, url: 'chrome://settings' }],
        },
        permissions: {
          contains: async () => false,
          request,
        },
      }),
    });

    const snapshot = await getActiveTabSnapshot();
    expect(snapshot.status).toBe('unsupported');
    expect(request).not.toHaveBeenCalled();
  });
});

describe('requestOriginAccess', () => {
  it('requests exactly the supplied origin pattern', async () => {
    const request = vi.fn(async () => true);
    Object.assign(globalThis, {
      chrome: createChromeStub({
        permissions: {
          contains: async () => false,
          request,
        },
      }),
    });

    await expect(requestOriginAccess('https://example.com/*')).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({ origins: ['https://example.com/*'] });
  });
});

describe('pingActiveTab', () => {
  it('round-trips through scripting.executeScript', async () => {
    Object.assign(globalThis, {
      chrome: createChromeStub({
        scripting: {
          executeScript: async () => [{ result: { pong: true, href: 'https://example.com/' } }],
        },
      }),
    });

    await expect(pingActiveTab(7)).resolves.toEqual({
      ok: true,
      pong: true,
      href: 'https://example.com/',
    });
  });
});
