import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveLocalDraft,
  getLocalDraft,
  clearLocalDraft,
  hasNewerDraft,
  clearAllLocalDrafts,
} from './localDraft';

describe('localDraft', () => {
  beforeEach(() => localStorage.clear());

  it('saves and retrieves a draft with its backedUpAt stamp', () => {
    saveLocalDraft('d1', { type: 'doc', text: 'hi' }, 1000);
    const got = getLocalDraft('d1');
    expect(got).not.toBeNull();
    expect(got!.content).toEqual({ type: 'doc', text: 'hi' });
    expect(got!.backedUpAt).toBe(1000);
  });

  it('returns null for a missing draft', () => {
    expect(getLocalDraft('missing')).toBeNull();
  });

  it('clears a draft', () => {
    saveLocalDraft('d2', { a: 1 }, 500);
    clearLocalDraft('d2');
    expect(getLocalDraft('d2')).toBeNull();
  });

  it('hasNewerDraft is true only when the draft is newer than the last save', () => {
    saveLocalDraft('d3', { a: 1 }, 2000);
    expect(hasNewerDraft('d3', 1000)).toBe(true);
    expect(hasNewerDraft('d3', 2000)).toBe(false);
    expect(hasNewerDraft('d3', 3000)).toBe(false);
  });

  it('hasNewerDraft is false when no draft exists', () => {
    expect(hasNewerDraft('none', 0)).toBe(false);
  });

  it('survives corrupted JSON without throwing', () => {
    localStorage.setItem('rb_draft_bad', '{oops');
    expect(getLocalDraft('bad')).toBeNull();
    expect(hasNewerDraft('bad', 0)).toBe(false);
  });

  it('clearAllLocalDrafts removes every draft but leaves other keys', () => {
    saveLocalDraft('d1', { a: 1 }, 1);
    saveLocalDraft('d2', { b: 2 }, 2);
    localStorage.setItem('rb_offline_last_id', 'd1'); // unrelated key
    clearAllLocalDrafts();
    expect(getLocalDraft('d1')).toBeNull();
    expect(getLocalDraft('d2')).toBeNull();
    expect(localStorage.getItem('rb_offline_last_id')).toBe('d1');
  });

  describe('storage access failures', () => {
    afterEach(() => vi.restoreAllMocks());

    it('returns null / false when localStorage.getItem itself throws', () => {
      saveLocalDraft('d5', { a: 1 }, 100);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage denied');
      });
      expect(getLocalDraft('d5')).toBeNull();
      expect(hasNewerDraft('d5', 0)).toBe(false);
    });
  });

  describe('revision-based comparison (clock-skew safe)', () => {
    it('stores the server revision the draft was based on', () => {
      saveLocalDraft('r1', { a: 1 }, 100, '2026-07-03T10:00:00Z');
      expect(getLocalDraft('r1')!.baseRevision).toBe('2026-07-03T10:00:00Z');
    });

    it('is newer when the base revision matches the current server revision, regardless of clocks', () => {
      // Client clock far BEHIND server clock: time compare would say "older",
      // but the server has not changed since the backup → unsaved edits exist.
      saveLocalDraft('r2', { a: 1 }, 100, 'rev-A');
      expect(hasNewerDraft('r2', 999_999, 'rev-A')).toBe(true);
    });

    it('is not newer when the server has moved past the draft base revision', () => {
      // Client clock far AHEAD: time compare would say "newer", but the server
      // was saved after this backup → the draft is stale.
      saveLocalDraft('r3', { a: 1 }, 999_999, 'rev-A');
      expect(hasNewerDraft('r3', 100, 'rev-B')).toBe(false);
    });

    it('falls back to time comparison for legacy drafts without a revision', () => {
      saveLocalDraft('r4', { a: 1 }, 2000);
      expect(hasNewerDraft('r4', 1000, 'rev-A')).toBe(true);
      expect(hasNewerDraft('r4', 3000, 'rev-A')).toBe(false);
    });
  });
});
