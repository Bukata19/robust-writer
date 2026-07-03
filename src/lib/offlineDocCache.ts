// localStorage-backed cache of the current / last-opened document so it can be
// read and exported while offline. Text/JSON only — no IndexedDB, no AI, no
// server sync. Every read is defensive: corrupted or missing entries return
// null instead of throwing.

const DOC_PREFIX = 'rb_offline_doc_';
const LAST_ID_KEY = 'rb_offline_last_id';

export interface CachedDoc {
  id: string;
  title: string;
  content: unknown;
  doc_type: string;
  cachedAt: number;
}

interface CacheInput {
  id: string;
  title: string;
  content: unknown;
  doc_type: string;
}

/** Store one document and record it as the last-opened doc. */
export function cacheDocument(doc: CacheInput): void {
  if (!doc?.id) return;
  const entry: CachedDoc = {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    doc_type: doc.doc_type,
    cachedAt: Date.now(),
  };
  try {
    localStorage.setItem(DOC_PREFIX + doc.id, JSON.stringify(entry));
    localStorage.setItem(LAST_ID_KEY, doc.id);
  } catch {
    // Quota exceeded or storage unavailable — offline caching is best-effort
    // and must never break the (online) save/edit path.
  }
}

/** Retrieve a cached document by id, or null if absent/corrupt. */
export function getCachedDocument(id: string): CachedDoc | null {
  if (!id) return null;
  const raw = localStorage.getItem(DOC_PREFIX + id);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedDoc;
    if (!parsed || parsed.id !== id) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Retrieve the most recently cached document, or null. */
export function getLastCachedDocument(): CachedDoc | null {
  const id = localStorage.getItem(LAST_ID_KEY);
  if (!id) return null;
  return getCachedDocument(id);
}

/**
 * Remove every cached document + the last-opened pointer. Call on sign-out so
 * a shared/library machine never leaves one user's document readable to the
 * next. Leaves unrelated app keys intact.
 */
export function clearOfflineDocs(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(DOC_PREFIX) || k === LAST_ID_KEY)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
