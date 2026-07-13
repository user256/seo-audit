import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { DB_NAME, openAuditDb, runMigrations } from './db';
import { createEmptySession, SessionRepository } from './session-repository';

describe('SessionRepository', () => {
  let factory: IDBFactory;
  let repo: SessionRepository;

  beforeEach(() => {
    factory = new IDBFactory();
    repo = new SessionRepository(factory);
  });

  it('round-trips save → get → list → delete', async () => {
    const session = createEmptySession({
      id: 'round-1',
      tabUrl: 'https://example.com/path',
      finalUrl: 'https://example.com/path',
      extensionVersion: '0.1.0',
      featureAvailability: {
        domCollector: true,
        headerCapture: 'unavailable',
      },
    });

    const saved = await repo.save(session);
    expect(saved.id).toBe('round-1');

    const loaded = await repo.get('round-1');
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.session.tabUrl).toBe('https://example.com/path');
      expect(loaded.session.finalUrl).toBe('https://example.com/path');
      expect(loaded.session.extensionVersion).toBe('0.1.0');
      expect(JSON.stringify(loaded.session)).not.toMatch(/cookie|authorization|password/i);
    }

    const listed = await repo.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe('round-1');

    await expect(repo.delete('round-1')).resolves.toBe(true);
    await expect(repo.get('round-1')).resolves.toEqual({
      status: 'missing',
      id: 'round-1',
    });
  });

  it('finds the latest matching session for a URL', async () => {
    const older = createEmptySession({
      id: 'older',
      tabUrl: 'https://example.com/page',
      finalUrl: 'https://example.com/page',
      extensionVersion: '0.1.0',
      captureTime: '2026-07-13T10:00:00.000Z',
    });
    older.updatedAt = '2026-07-13T10:00:00.000Z';
    await repo.save(older);

    const newer = createEmptySession({
      id: 'newer',
      tabUrl: 'https://example.com/page',
      finalUrl: 'https://example.com/page',
      extensionVersion: '0.1.0',
      captureTime: '2026-07-13T11:00:00.000Z',
    });
    newer.updatedAt = '2026-07-13T11:00:00.000Z';
    await repo.save(newer);

    await repo.save(
      createEmptySession({
        id: 'other',
        tabUrl: 'https://other.example/',
        finalUrl: 'https://other.example/',
        extensionVersion: '0.1.0',
      }),
    );

    const found = await repo.findLatestForUrl('https://example.com/page');
    expect(found).toMatchObject({ status: 'ok', session: { id: 'newer' } });

    const byFinal = await repo.findLatestForUrl('https://example.com/page');
    expect(byFinal.status).toBe('ok');

    await expect(repo.findLatestForUrl('https://missing.example/')).resolves.toEqual({
      status: 'none',
    });
  });

  it('quarantines invalid records instead of crashing', async () => {
    const db = await openAuditDb(factory);
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put({
      id: 'broken-1',
      schemaVersion: 2,
      // missing required fields
      tabUrl: 'https://example.com/',
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    const result = await repo.get('broken-1');
    expect(result.status).toBe('quarantined');
    if (result.status === 'quarantined') {
      expect(result.record.reason).toMatch(/Schema validation failed/i);
      expect(result.record.payload).toMatchObject({ id: 'broken-1' });
    }

    const quarantine = await repo.listQuarantine();
    expect(quarantine.some((q) => q.id === 'broken-1')).toBe(true);
  });

  it('migrates schemaVersion-1 sessions in place on get', async () => {
    const db = await openAuditDb(factory);
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put({
      schemaVersion: 1,
      id: 'legacy-1',
      createdAt: '2026-07-12T12:00:00.000Z',
      updatedAt: '2026-07-12T12:00:00.000Z',
      tabUrl: 'https://example.com/legacy',
      finalUrl: 'https://example.com/legacy',
      captureTime: '2026-07-12T12:00:00.000Z',
      extensionVersion: '0.1.0',
      featureAvailability: { domCollector: true },
      snapshots: [
        {
          id: 'snap-legacy',
          url: 'https://example.com/legacy',
          capturedAt: '2026-07-12T12:00:00.000Z',
          evidence: [],
        },
      ],
      findings: [],
      captureErrors: [],
      reportMarkdown: '',
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    const loaded = await repo.get('legacy-1');
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.session.schemaVersion).toBe(3);
      expect(loaded.session.snapshots[0]?.captureLimits).toBeTruthy();
    }

    const again = await repo.get('legacy-1');
    expect(again.status).toBe('ok');
    if (again.status === 'ok') {
      expect(again.session.schemaVersion).toBe(3);
    }
  });

  it('creates object stores via migration from version 0', async () => {
    const db = await openAuditDb(factory);
    expect(db.name).toBe(DB_NAME);
    expect(db.objectStoreNames.contains('sessions')).toBe(true);
    expect(db.objectStoreNames.contains('quarantine')).toBe(true);
    db.close();

    // Idempotent for already-migrated DBs: calling runMigrations again is a no-op
    // when stores exist (upgrade path only runs on version bumps).
    const db2 = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(DB_NAME, 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    runMigrations(db2, 1, 1);
    db2.close();
  });

  it('rejects saves that omit the DOM-evidence version marker', async () => {
    const session = createEmptySession({
      id: 'bypass-missing',
      tabUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      extensionVersion: '0.1.0',
    });
    session.snapshots.push({
      id: 'snap-missing',
      url: 'https://example.com/',
      capturedAt: session.captureTime,
      evidence: [
        {
          id: 'title-0',
          kind: 'dom',
          source: 'title',
          value: { state: 'present', value: ['not', 'a', 'title'], selector: 'title' },
          capturedAt: session.captureTime,
        },
      ],
      captureLimits: {
        schemaVersion: 1,
        applied: {
          maxStringChars: 2_000,
          maxMetaItems: 40,
          maxAlternateItems: 50,
          maxJsonLdChars: 50_000,
          maxJsonLdScripts: 25,
          maxHeadingSamplesPerLevel: 5,
        },
        maxSnapshotChars: 400_000,
        maxSessionChars: 1_500_000,
      },
    });

    await expect(repo.save(session)).rejects.toThrow(/domEvidenceSchemaVersion|version 2/i);
  });

  it('rejects saves that downgrade to the historical DOM-evidence marker', async () => {
    const session = createEmptySession({
      id: 'bypass-historical',
      tabUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      extensionVersion: '0.1.0',
    });
    session.snapshots.push({
      id: 'snap-historical',
      url: 'https://example.com/',
      capturedAt: session.captureTime,
      evidence: [
        {
          id: 'title-0',
          kind: 'dom',
          source: 'title',
          value: { state: 'present', value: ['not', 'a', 'title'], selector: 'title' },
          capturedAt: session.captureTime,
        },
      ],
      captureLimits: {
        schemaVersion: 1,
        applied: {
          maxStringChars: 2_000,
          maxMetaItems: 40,
          maxAlternateItems: 50,
          maxJsonLdChars: 50_000,
          maxJsonLdScripts: 25,
          maxHeadingSamplesPerLevel: 5,
        },
        maxSnapshotChars: 400_000,
        maxSessionChars: 1_500_000,
        domEvidenceSchemaVersion: 1,
      },
    });

    await expect(repo.save(session)).rejects.toThrow(/domEvidenceSchemaVersion|version 2/i);
  });

  it('keeps a valid migrated historical session readable on get', async () => {
    const db = await openAuditDb(factory);
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put({
      schemaVersion: 1,
      id: 'historical-dom',
      createdAt: '2026-07-12T12:00:00.000Z',
      updatedAt: '2026-07-12T12:00:00.000Z',
      tabUrl: 'https://example.com/legacy',
      finalUrl: 'https://example.com/legacy',
      captureTime: '2026-07-12T12:00:00.000Z',
      extensionVersion: '0.1.0',
      featureAvailability: { domCollector: true },
      snapshots: [
        {
          id: 'snap-legacy-dom',
          url: 'https://example.com/legacy',
          capturedAt: '2026-07-12T12:00:00.000Z',
          evidence: [
            {
              id: 'title-0',
              kind: 'dom',
              source: 'title',
              // Historical payloads were not source-validated; keep readable after migration.
              value: { state: 'present', value: { weird: true }, selector: 'title' },
              capturedAt: '2026-07-12T12:00:00.000Z',
            },
          ],
        },
      ],
      findings: [],
      captureErrors: [],
      reportMarkdown: '',
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    const loaded = await repo.get('historical-dom');
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.session.schemaVersion).toBe(3);
      expect(loaded.session.snapshots[0]?.captureLimits?.domEvidenceSchemaVersion).toBe(1);
    }
  });
});
