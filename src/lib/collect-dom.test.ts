import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createChromeStub } from '../test/chrome-stub';
import { collectDomForActiveTab } from './collect-dom';
import { SessionRepository } from './storage/session-repository';
import { collectDomFactsInPage } from '../content/dom-collector';
import { FIXTURE_RELATIVE_URLS } from '../content/fixtures';
import { DOM_LIMITS } from './schemas/dom-limits';

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

  it('runs and records exactly the selected subset of checks', async () => {
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
    const result = await collectDomForActiveTab(repo, new Set(['title-missing-or-duplicate']));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.checkSelection.selectedCheckIds).toEqual(['title-missing-or-duplicate']);
      const loaded = await repo.get(result.sessionId);
      expect(loaded.status).toBe('ok');
      if (loaded.status === 'ok') {
        expect(loaded.session.checkSelection.selectedCheckIds).toEqual([
          'title-missing-or-duplicate',
        ]);
        expect(loaded.session.checkSelection.skippedChecks).toContainEqual({
          checkId: 'canonical-rules',
          reason: 'Not selected in the audit wizard.',
        });
        expect(
          loaded.session.findings.every((finding) => finding.ruleId.startsWith('title-')),
        ).toBe(true);
      }
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

  it('rejects malformed source-specific collector evidence with dom-evidence-invalid', async () => {
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
            facts.canonical = {
              state: 'present',
              value: { href: 42, absolute: 'https://example.com/canonical' },
              selector: 'link[rel=canonical]',
            };
            return [{ result: facts }];
          },
        },
      }),
    });

    const result = await collectDomForActiveTab(new SessionRepository(new IDBFactory()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.captureError?.code).toBe('dom-evidence-invalid');
      expect(result.captureError?.message).toMatch(/canonical\.value\.href/);
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

  it('saves a valid documentUrl longer than maxStringChars without dom-evidence-invalid', async () => {
    const longPath = 'a'.repeat(2_500);
    const longUrl = `https://example.com/${longPath}`;
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 4, url: longUrl }],
        },
        permissions: {
          contains: async () => true,
        },
        scripting: {
          executeScript: async () => {
            const facts = collectDomFactsInPage();
            facts.documentUrl = longUrl;
            facts.baseUri = longUrl;
            return [{ result: facts }];
          },
        },
      }),
    });

    const repo = new SessionRepository(new IDBFactory());
    const result = await collectDomForActiveTab(repo);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.url).toBe(longUrl);
      const docEvidence = result.snapshot.evidence.find((item) => item.source === 'document.URL');
      expect(docEvidence?.value).toMatchObject({
        documentUrl: longUrl,
        baseUri: longUrl,
      });
      expect((docEvidence?.value as { bounds?: unknown }).bounds).toBeUndefined();
    }
  });

  it('bounds an oversized documentUrl after navigation-race comparison', async () => {
    const exactUrl = `https://example.com/${'b'.repeat(9_000)}`;
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 4, url: exactUrl }],
        },
        permissions: {
          contains: async () => true,
        },
        scripting: {
          executeScript: async () => {
            const facts = collectDomFactsInPage();
            facts.documentUrl = exactUrl;
            facts.baseUri = exactUrl;
            return [{ result: facts }];
          },
        },
      }),
    });

    const result = await collectDomForActiveTab(new SessionRepository(new IDBFactory()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.url.length).toBe(DOM_LIMITS.maxUrlChars);
      expect(result.snapshot.url).toBe(exactUrl.slice(0, DOM_LIMITS.maxUrlChars));
      const docEvidence = result.snapshot.evidence.find((item) => item.source === 'document.URL');
      expect(docEvidence?.value).toMatchObject({
        documentUrl: exactUrl.slice(0, DOM_LIMITS.maxUrlChars),
        bounds: {
          documentUrl: {
            truncated: true,
            originalLength: exactUrl.length,
          },
          baseUri: {
            truncated: true,
            originalLength: exactUrl.length,
          },
        },
      });
      expect(result.captureErrors.every((error) => error.code !== 'dom-evidence-invalid')).toBe(
        true,
      );
    }
  });

  it('still detects navigation-race when exact long document URLs diverge', async () => {
    const tabUrl = `https://example.com/${'c'.repeat(3_000)}`;
    const otherUrl = `https://example.com/${'d'.repeat(3_000)}`;
    Object.assign(globalThis, {
      chrome: createChromeStub({
        tabs: {
          query: async () => [{ id: 4, url: tabUrl }],
        },
        permissions: {
          contains: async () => true,
        },
        scripting: {
          executeScript: async () => {
            const facts = collectDomFactsInPage();
            facts.documentUrl = otherUrl;
            return [{ result: facts }];
          },
        },
      }),
    });

    const result = await collectDomForActiveTab(new SessionRepository(new IDBFactory()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.captureError?.code).toBe('navigation-race');
      expect(result.captureError?.url).toBe(otherUrl);
    }
  });
});
