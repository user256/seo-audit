/**
 * Minimal chrome API stub for unit tests. Expand per-ticket as real APIs are used.
 */

/** Loose overrides — tests only stub the methods they exercise. */
export type ChromeStubOverrides = {
  runtime?: Record<string, unknown>;
  sidePanel?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  tabs?: Record<string, unknown>;
  scripting?: Record<string, unknown>;
  storage?: Record<string, unknown>;
};

export function createChromeStub(overrides: ChromeStubOverrides = {}): typeof chrome {
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
      ...overrides.runtime,
    },
    sidePanel: {
      setPanelBehavior: async () => undefined,
      open: async () => undefined,
      ...overrides.sidePanel,
    },
    permissions: {
      contains: async () => false,
      request: async () => false,
      remove: async () => true,
      getAll: async () => ({ permissions: [], origins: [] }),
      ...overrides.permissions,
    },
    tabs: {
      query: async () => [],
      get: async () => ({ id: 1, url: 'https://example.com/' }),
      ...overrides.tabs,
    },
    scripting: {
      executeScript: async () => [],
      ...overrides.scripting,
    },
    storage: {
      local: {
        get: async () => ({}),
        set: async () => undefined,
        remove: async () => undefined,
        clear: async () => undefined,
      },
      ...overrides.storage,
    },
  };

  return stub as unknown as typeof chrome;
}
