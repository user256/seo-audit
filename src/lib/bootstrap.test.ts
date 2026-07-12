import { beforeEach, describe, expect, it } from 'vitest';
import { pingExtensionIdentity } from '../lib/bootstrap';
import { createChromeStub } from '../test/chrome-stub';

describe('toolchain bootstrap', () => {
  beforeEach(() => {
    Object.assign(globalThis, { chrome: createChromeStub() });
  });

  it('resolves chrome.runtime.id and writes to IndexedDB via fake-indexeddb', async () => {
    const result = await pingExtensionIdentity();
    expect(result.id).toBe('seo-audit-test-extension');
    expect(result.dbOk).toBe(true);
  });
});
