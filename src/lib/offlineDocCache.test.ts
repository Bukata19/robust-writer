import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheDocument,
  getCachedDocument,
  getLastCachedDocument,
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
});
