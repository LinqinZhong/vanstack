const DB_NAME = 'vanstack-lowcode';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;
export const DRAFT_PUT_DEBOUNCE_MS = 200;

type DraftRecord = {
  key: string;
  xml: string;
  updatedAt: number;
};

type PendingPut = {
  xml: string;
  timer: ReturnType<typeof setTimeout>;
  resolvers: Array<() => void>;
};

const lastWrittenXml = new Map<string, string>();
const pendingPuts = new Map<string, PendingPut>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

export function draftKey(projectId: string, pageId: string, versionId: string) {
  return `${projectId}:${pageId}:${versionId}`;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          dbPromise = null;
          resolve(null);
        };
      } catch {
        dbPromise = null;
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function runStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return openDb().then((db) => {
    if (!db) {
      return undefined;
    }
    return new Promise<T | undefined>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, mode);
        const request = run(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
        tx.onabort = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  });
}

export async function getDraft(projectId: string, pageId: string, versionId: string): Promise<string | null> {
  try {
    const key = draftKey(projectId, pageId, versionId);
    const record = await runStore('readonly', (store) => store.get(key));
    const xml = (record as DraftRecord | undefined)?.xml;
    if (typeof xml === 'string') {
      lastWrittenXml.set(key, xml);
      return xml;
    }
    return null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, xml: string): Promise<void> {
  if (lastWrittenXml.get(key) === xml) {
    return Promise.resolve();
  }
  return runStore('readwrite', (store) =>
    store.put({ key, xml, updatedAt: Date.now() } satisfies DraftRecord),
  )
    .then((result) => {
      if (result !== undefined) {
        lastWrittenXml.set(key, xml);
      }
    })
    .catch(() => undefined);
}

function flushPending(key: string) {
  const current = pendingPuts.get(key);
  pendingPuts.delete(key);
  if (!current) {
    return;
  }
  clearTimeout(current.timer);
  void writeDraft(key, current.xml).finally(() => {
    for (const done of current.resolvers) {
      done();
    }
  });
}

function clearPending(key: string) {
  const pending = pendingPuts.get(key);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timer);
  pendingPuts.delete(key);
  for (const resolve of pending.resolvers) {
    resolve();
  }
}

export function putDraft(projectId: string, pageId: string, versionId: string, xml: string): Promise<void> {
  const key = draftKey(projectId, pageId, versionId);
  const pending = pendingPuts.get(key);
  if (!pending && lastWrittenXml.get(key) === xml) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    if (pending) {
      clearTimeout(pending.timer);
      pending.xml = xml;
      pending.resolvers.push(resolve);
      pending.timer = setTimeout(() => flushPending(key), DRAFT_PUT_DEBOUNCE_MS);
      return;
    }
    const next: PendingPut = {
      xml,
      resolvers: [resolve],
      timer: setTimeout(() => flushPending(key), DRAFT_PUT_DEBOUNCE_MS),
    };
    pendingPuts.set(key, next);
  });
}

export function putDraftNow(projectId: string, pageId: string, versionId: string, xml: string): Promise<void> {
  const key = draftKey(projectId, pageId, versionId);
  const pending = pendingPuts.get(key);
  const nextXml = pending?.xml ?? xml;
  if (pending) {
    clearTimeout(pending.timer);
    pendingPuts.delete(key);
  }
  return writeDraft(key, nextXml).finally(() => {
    if (pending) {
      for (const done of pending.resolvers) {
        done();
      }
    }
  });
}

export async function deleteDraft(projectId: string, pageId: string, versionId: string): Promise<void> {
  const key = draftKey(projectId, pageId, versionId);
  clearPending(key);
  lastWrittenXml.delete(key);
  try {
    await runStore('readwrite', (store) => store.delete(key));
  } catch {
    return;
  }
}
