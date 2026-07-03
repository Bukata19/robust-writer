import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  cacheDocument,
  getCachedDocument,
  getLastCachedDocument,
  clearOfflineDocs,
} from './offlineDocCache';

const docA = { id: 'a1', title: 'Alpha', content: { type: 'doc' }, doc_type: 'essay' };
const docB = { id: 'b2', title: 'Beta', content: { foo: 1 }, doc_type: 'report' };

describe('offlineDocCache', () => {
  beforeEach(() => localStorage.clear());

  it('caches and retrieves a document by id with a cachedAt stamp', () => {
    cacheDocument(docA);
    const got = getCachedDocument('a1');
    expect(got).not.toBeNull();
    expect(got!.id).toBe('a1');
    expect(got!.title).toBe('Alpha');
    expect(got!.content).toEqual({ type: 'doc' });
    expect(got!.doc_type).toBe('essay');
    expect(typeof got!.cachedAt).toBe('number');
  });

  it('returns null for an unknown id', () => {
    expect(getCachedDocument('nope')).toBeNull();
  });

  it('tracks the most recently cached document as the last-opened one', () => {
    cacheDocument(docA);
    cacheDocument(docB);
    expect(getLastCachedDocument()!.id).toBe('b2');
  });

  it('returns null from getLastCachedDocument when nothing is cached', () => {
    expect(getLastCachedDocument()).toBeNull();
  });

  it('survives corrupted JSON without throwing', () => {
    localStorage.setItem('rb_offline_doc_x', '{not json');
    expect(getCachedDocument('x')).toBeNull();
  });

  describe('storage access failures', () => {
    afterEach(() => vi.restoreAllMocks());

    it('returns null when localStorage.getItem itself throws', () => {
      cacheDocument(docA);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage denied');
      });
      expect(getCachedDocument('a1')).toBeNull();
      expect(getLastCachedDocument()).toBeNull();
    });
  });

  it('clearOfflineDocs removes all cached docs + last-id but leaves other keys', () => {
    cacheDocument(docA);
    cacheDocument(docB);
    localStorage.setItem('rb_wc_a1', '123'); // unrelated app key
    clearOfflineDocs();
    expect(getCachedDocument('a1')).toBeNull();
    expect(getCachedDocument('b2')).toBeNull();
    expect(getLastCachedDocument()).toBeNull();
    expect(localStorage.getItem('rb_wc_a1')).toBe('123');
  });
});
