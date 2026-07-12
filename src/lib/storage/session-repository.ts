import {
  AUDIT_SCHEMA_VERSION,
  parseAuditSession,
  QuarantinedRecordSchema,
  type AuditSession,
  type QuarantinedRecord,
} from '../schemas/audit';
import { openAuditDb, QUARANTINE_STORE, SESSIONS_STORE } from './db';

export type SessionListItem = {
  id: string;
  tabUrl: string;
  finalUrl: string;
  captureTime: string;
  updatedAt: string;
  extensionVersion: string;
};

export type LoadSessionResult =
  | { status: 'ok'; session: AuditSession }
  | { status: 'missing'; id: string }
  | { status: 'quarantined'; record: QuarantinedRecord };

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export class SessionRepository {
  constructor(private readonly indexedDBImpl: IDBFactory = indexedDB) {}

  private async db(): Promise<IDBDatabase> {
    return openAuditDb(this.indexedDBImpl);
  }

  async save(session: AuditSession): Promise<AuditSession> {
    const parsed = parseAuditSession(session);
    if (!parsed.ok) {
      throw new Error(`Refusing to save invalid session: ${parsed.issues?.join('; ')}`);
    }
    const now = new Date().toISOString();
    const toStore: AuditSession = {
      ...parsed.value,
      schemaVersion: AUDIT_SCHEMA_VERSION,
      updatedAt: now,
    };

    const db = await this.db();
    try {
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      tx.objectStore(SESSIONS_STORE).put(toStore);
      await txDone(tx);
      return toStore;
    } finally {
      db.close();
    }
  }

  async get(id: string): Promise<LoadSessionResult> {
    const db = await this.db();
    try {
      const tx = db.transaction([SESSIONS_STORE, QUARANTINE_STORE], 'readwrite');
      const raw = await requestToPromise(tx.objectStore(SESSIONS_STORE).get(id));

      if (raw === undefined) {
        const quarantined = await requestToPromise(tx.objectStore(QUARANTINE_STORE).get(id));
        await txDone(tx);
        if (quarantined !== undefined) {
          const q = QuarantinedRecordSchema.parse(quarantined);
          return { status: 'quarantined', record: q };
        }
        return { status: 'missing', id };
      }

      const parsed = parseAuditSession(raw);
      if (parsed.ok) {
        await txDone(tx);
        return { status: 'ok', session: parsed.value };
      }

      const record: QuarantinedRecord = {
        id,
        quarantinedAt: new Date().toISOString(),
        reason: `Schema validation failed: ${parsed.issues?.join('; ') ?? parsed.error}`,
        originalSchemaVersion:
          raw && typeof raw === 'object' && 'schemaVersion' in raw
            ? (raw as { schemaVersion: unknown }).schemaVersion
            : undefined,
        payload: raw,
      };
      tx.objectStore(SESSIONS_STORE).delete(id);
      tx.objectStore(QUARANTINE_STORE).put(record);
      await txDone(tx);
      return { status: 'quarantined', record };
    } finally {
      db.close();
    }
  }

  async list(): Promise<SessionListItem[]> {
    const db = await this.db();
    try {
      const tx = db.transaction(SESSIONS_STORE, 'readonly');
      const all = await requestToPromise(tx.objectStore(SESSIONS_STORE).getAll());
      await txDone(tx);

      const items: SessionListItem[] = [];
      for (const raw of all) {
        const parsed = parseAuditSession(raw);
        if (!parsed.ok) {
          continue;
        }
        items.push({
          id: parsed.value.id,
          tabUrl: parsed.value.tabUrl,
          finalUrl: parsed.value.finalUrl,
          captureTime: parsed.value.captureTime,
          updatedAt: parsed.value.updatedAt,
          extensionVersion: parsed.value.extensionVersion,
        });
      }
      return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } finally {
      db.close();
    }
  }

  async delete(id: string): Promise<boolean> {
    const db = await this.db();
    try {
      const tx = db.transaction([SESSIONS_STORE, QUARANTINE_STORE], 'readwrite');
      const existing = await requestToPromise(tx.objectStore(SESSIONS_STORE).get(id));
      const quarantined = await requestToPromise(tx.objectStore(QUARANTINE_STORE).get(id));
      if (existing !== undefined) {
        tx.objectStore(SESSIONS_STORE).delete(id);
      }
      if (quarantined !== undefined) {
        tx.objectStore(QUARANTINE_STORE).delete(id);
      }
      await txDone(tx);
      return existing !== undefined || quarantined !== undefined;
    } finally {
      db.close();
    }
  }

  async listQuarantine(): Promise<QuarantinedRecord[]> {
    const db = await this.db();
    try {
      const tx = db.transaction(QUARANTINE_STORE, 'readonly');
      const all = await requestToPromise(tx.objectStore(QUARANTINE_STORE).getAll());
      await txDone(tx);
      return all.map((row) => QuarantinedRecordSchema.parse(row));
    } finally {
      db.close();
    }
  }
}

export function createEmptySession(input: {
  id: string;
  tabUrl: string;
  finalUrl: string;
  extensionVersion: string;
  featureAvailability?: AuditSession['featureAvailability'];
  captureTime?: string;
}): AuditSession {
  const now = input.captureTime ?? new Date().toISOString();
  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    id: input.id,
    createdAt: now,
    updatedAt: now,
    tabUrl: input.tabUrl,
    finalUrl: input.finalUrl,
    captureTime: now,
    extensionVersion: input.extensionVersion,
    featureAvailability: input.featureAvailability ?? {
      domCollector: false,
      headerCapture: 'unavailable',
      robotsFetch: 'unavailable',
    },
    snapshots: [],
    findings: [],
    captureErrors: [],
  };
}
