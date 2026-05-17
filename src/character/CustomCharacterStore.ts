const DB_NAME    = "marble-runner-db";
const DB_VERSION = 1;
const STORE      = "custom-char";
const KEY        = "current";

export interface StoredCustomChar {
  glbBuffer:        ArrayBuffer;
  avatarId:         string;
  name:             string;
  thumbnailDataUrl?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess       = () => resolve(req.result);
    req.onerror         = () => reject(req.error);
  });
}

export async function saveCustomChar(data: StoredCustomChar): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(data, KEY);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function loadCustomChar(): Promise<StoredCustomChar | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function clearCustomChar(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(KEY);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// Placeholder — returns empty string so the picker falls back to the letter avatar.
// Wire up a real thumbnail URL once an avatar provider is configured.
export function rpmThumbnailUrl(_avatarId: string): string {
  return "";
}
