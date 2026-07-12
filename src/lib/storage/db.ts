/**
 * IndexedDB open + migration helpers for audit sessions.
 * DB version is independent of AUDIT_SCHEMA_VERSION (record shape).
 */

export const DB_NAME = 'seo-audit';
export const DB_VERSION = 1;
export const SESSIONS_STORE = 'sessions';
export const QUARANTINE_STORE = 'quarantine';

export function openAuditDb(indexedDBImpl: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDBImpl.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      runMigrations(db, oldVersion, DB_VERSION);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

/**
 * Additive migrations only. Record-level schema upgrades happen in the
 * repository when reading (validate → migrate or quarantine).
 */
export function runMigrations(db: IDBDatabase, oldVersion: number, newVersion: number): void {
  if (oldVersion < 1 && newVersion >= 1) {
    if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
      const sessions = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
      sessions.createIndex('byCaptureTime', 'captureTime', { unique: false });
      sessions.createIndex('byUpdatedAt', 'updatedAt', { unique: false });
    }
    if (!db.objectStoreNames.contains(QUARANTINE_STORE)) {
      db.createObjectStore(QUARANTINE_STORE, { keyPath: 'id' });
    }
  }
}
