import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { SessionRepository, createEmptySession } from '../lib/storage/session-repository';
import { collectDomFactsInPage } from './dom-collector';
import { domFactsToPageSnapshot } from './dom-facts-to-snapshot';
import { FIXTURE_RELATIVE_URLS } from './fixtures';

describe('DOM collector → session repository', () => {
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

  it('saves a validated PageSnapshot through the session repository', async () => {
    const repo = new SessionRepository(new IDBFactory());
    const session = createEmptySession({
      id: 'audit-dom-1',
      tabUrl: 'https://example.com/shop/item',
      finalUrl: 'https://example.com/shop/item',
      extensionVersion: '0.1.0',
      featureAvailability: { domCollector: true },
    });
    const facts = collectDomFactsInPage();
    const snapshot = domFactsToPageSnapshot(facts, 'snap-dom-1');
    session.snapshots.push(snapshot);
    session.featureAvailability = { ...session.featureAvailability, domCollector: true };

    const saved = await repo.save(session);
    const loaded = await repo.get(saved.id);
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.session.snapshots[0]?.evidence.length).toBeGreaterThan(0);
      expect(loaded.session.snapshots[0]?.url).toBe('https://example.com/shop/item');
    }
  });
});
