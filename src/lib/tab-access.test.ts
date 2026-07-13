import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChromeStub } from '../test/chrome-stub';
import { getActiveTabSnapshot, pingActiveTab } from './tab-access';

describe('getActiveTabSnapshot', () => {
  beforeEach(() => {
    Object.assign(globalThis, { chrome: createChromeStub() });
  });

  it('reports ready + granted for an https tab under required host_permissions', async () => {
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 7, url: 'https://example.com/page' }],
        },
      }),
    });

    await expect(getActiveTabSnapshot()).resolves.toEqual({
      status: 'ready',
      tabId: 7,
      url: 'https://example.com/page',
      origin: 'https://example.com',
      pattern: 'https://example.com/*',
      granted: true,
    });
  });

  it('explains unsupported chrome:// tabs without probing permissions', async () => {
    const contains = vi.fn(async () => false);
    const request = vi.fn(async () => false);
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 3, url: 'chrome://settings' }],
        },
        permissions: {
          contains,
          request,
        },
      }),
    });

    const snapshot = await getActiveTabSnapshot();
    expect(snapshot.status).toBe('unsupported');
    expect(contains).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
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
