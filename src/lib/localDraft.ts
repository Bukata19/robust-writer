// Local, per-document draft backup used as an offline / crash safety net.
// On every editor change the current content is mirrored here; on load the
// editor can detect a backup newer than the last server save and offer to
// restore it. Never used to silently overwrite server content — the user is
// always asked. Text/JSON only.

const DRAFT_PREFIX = 'rb_draft_';

export interface LocalDraft {
  content: unknown;
  backedUpAt: number;
  /** Server revision (documents.updated_at) the editor had when this backup
      was written. Enables clock-skew-free "newer than saved" detection. */
  baseRevision?: string;
}

/** Write a local backup of the current content for a document. */
export function saveLocalDraft(
  id: string,
  content: unknown,
  savedAt: number,
  baseRevision?: string,
): void {
  if (!id) return;
  const entry: LocalDraft = { content, backedUpAt: savedAt };
  if (baseRevision) entry.baseRevision = baseRevision;
  try {
    localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(entry));
  } catch {
    // Best-effort — a full quota must never break the editor.
  }
}

/** Read the local draft for a document, or null if absent/corrupt. */
export function getLocalDraft(id: string): LocalDraft | null {
  if (!id) return null;
  try {
    // The read itself can throw (storage disabled / privacy mode), so it
    // lives inside the same defensive path as the parse.
    const raw = localStorage.getItem(DRAFT_PREFIX + id);
    if (!raw) return null;
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

/**
 * True when a local draft exists with edits the server hasn't seen.
 *
 * When both the draft and the caller carry a server revision token, compare
 * tokens: a draft based on the CURRENT server revision means nothing was saved
 * after the backup → it holds unsaved edits (clock-skew safe). A draft based
 * on an older revision is stale — the server moved past it. Legacy drafts
 * without a token fall back to the timestamp comparison.
 */
export function hasNewerDraft(
  id: string,
  lastSavedAt: number,
  currentRevision?: string,
): boolean {
  const draft = getLocalDraft(id);
  if (!draft) return false;
  if (currentRevision && draft.baseRevision) {
    return draft.baseRevision === currentRevision;
  }
  return draft.backedUpAt > lastSavedAt;
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
