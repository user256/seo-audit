/**
 * Tiny helper used by the bootstrap unit test to prove the chrome stub and
 * IndexedDB mock are wired. Real session storage lands in Ticket 102.
 */
export async function pingExtensionIdentity(): Promise<{
  id: string;
  dbOk: boolean;
}> {
  const id = chrome.runtime.id;

  const dbOk = await new Promise<boolean>((resolve, reject) => {
    const request = indexedDB.open('seo-audit-bootstrap', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ ok: true }, 'ping');
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });

  return { id, dbOk };
}
