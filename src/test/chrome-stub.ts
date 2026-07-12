type ChromeStub = typeof chrome;

/**
 * Minimal chrome API stub for unit tests. Expand per-ticket as real APIs are used.
 */
export function createChromeStub(overrides: Partial<ChromeStub> = {}): ChromeStub {
  const stub = {
    runtime: {
      id: 'seo-audit-test-extension',
      lastError: undefined,
      getManifest: () => ({
        manifest_version: 3,
        name: 'SEO Audit Workbench',
        version: '0.1.0',
      }),
      sendMessage: async () => undefined,
      onMessage: {
        addListener: () => undefined,
        removeListener: () => undefined,
        hasListener: () => false,
      },
    },
    sidePanel: {
      setPanelBehavior: async () => undefined,
      open: async () => undefined,
    },
    permissions: {
      contains: async () => false,
      request: async () => false,
      remove: async () => true,
      getAll: async () => ({ permissions: [], origins: [] }),
    },
    tabs: {
      query: async () => [],
      get: async () => ({ id: 1, url: 'https://example.com/' }),
    },
    scripting: {
      executeScript: async () => [],
    },
    storage: {
      local: {
        get: async () => ({}),
        set: async () => undefined,
        remove: async () => undefined,
        clear: async () => undefined,
      },
    },
    ...overrides,
  };

  return stub as ChromeStub;
}
