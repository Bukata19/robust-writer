import { describe, it, expect, beforeEach } from 'vitest';
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
});
