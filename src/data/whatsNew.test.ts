import { describe, it, expect, beforeEach } from 'vitest';
import { WHATS_NEW, hasUnseenUpdate, markUpdatesSeen } from './whatsNew';

describe('whatsNew seen-state', () => {
  beforeEach(() => localStorage.clear());

  it('has entries ordered newest-first with unique ids', () => {
    expect(WHATS_NEW.length).toBeGreaterThan(0);
    const ids = WHATS_NEW.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const dates = WHATS_NEW.map((e) => Date.parse(e.date));
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });

  it('reports unseen on a fresh browser', () => {
    expect(hasUnseenUpdate()).toBe(true);
  });

  it('clears after markUpdatesSeen and persists', () => {
    markUpdatesSeen();
    expect(hasUnseenUpdate()).toBe(false);
  });

  it('re-flags when a stale (older) id is stored — a new entry re-arms the dot', () => {
    localStorage.setItem('rb_whatsnew_seen', 'some-old-entry-id');
    expect(hasUnseenUpdate()).toBe(true);
  });

  it('survives storage access failures without throwing', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('denied'); };
    try {
      expect(hasUnseenUpdate()).toBe(true); // fail open: show the dot
      expect(() => markUpdatesSeen()).not.toThrow();
    } finally {
      Storage.prototype.getItem = orig;
    }
  });
});
