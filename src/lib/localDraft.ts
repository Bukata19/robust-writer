// Local, per-document draft backup used as an offline / crash safety net.
// On every editor change the current content is mirrored here; on load the
// editor can detect a backup newer than the last server save and offer to
// restore it. Never used to silently overwrite server content — the user is
// always asked. Text/JSON only.

const DRAFT_PREFIX = 'rb_draft_';

export interface LocalDraft {
  content: unknown;
  backedUpAt: number;
}

/** Write a local backup of the current content for a document. */
export function saveLocalDraft(id: string, content: unknown, savedAt: number): void {
  if (!id) return;
  const entry: LocalDraft = { content, backedUpAt: savedAt };
  try {
    localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(entry));
  } catch {
    // Best-effort — a full quota must never break the editor.
  }
}

/** Read the local draft for a document, or null if absent/corrupt. */
export function getLocalDraft(id: string): LocalDraft | null {
  if (!id) return null;
  const raw = localStorage.getItem(DRAFT_PREFIX + id);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalDraft;
    if (!parsed || typeof parsed.backedUpAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remove the local draft for a document (e.g. after a successful save). */
export function clearLocalDraft(id: string): void {
  if (!id) return;
  try {
    localStorage.removeItem(DRAFT_PREFIX + id);
  } catch {
    // ignore
  }
}

/** True when a local draft exists that is newer than the last server save. */
export function hasNewerDraft(id: string, lastSavedAt: number): boolean {
  const draft = getLocalDraft(id);
  return !!draft && draft.backedUpAt > lastSavedAt;
}

/**
 * Remove every local draft. Call on sign-out so in-progress writing isn't left
 * behind on a shared machine for the next user. Leaves unrelated keys intact.
 */
export function clearAllLocalDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
