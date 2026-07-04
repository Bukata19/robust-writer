import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  computeDeterministicScore,
  deriveRiskLevel,
  hashText,
  SCORER_VERSION,
} from '../../supabase/functions/plagiarism/scoring';

describe('normalizeText', () => {
  it('converts CRLF and lone CR to LF', () => {
    expect(normalizeText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeText('  hello world \n')).toBe('hello world');
  });

  it('applies NFC unicode normalization (composed === decomposed)', () => {
    const composed = 'café';        // é as one code point
    const decomposed = 'café';     // e + combining acute
    expect(normalizeText(decomposed)).toBe(normalizeText(composed));
  });

  it('is idempotent', () => {
    const once = normalizeText('  a\r\nb  ');
    expect(normalizeText(once)).toBe(once);
  });
});

describe('computeDeterministicScore', () => {
  const signals = (b: number, s: number, t: number, c: number) => ({
    burstinessScore: b,
    signatureWordDensity: s,
    transitionDensity: t,
    coherenceUniformityScore: c,
  });

  it('is a pure function — identical input, identical output', () => {
    const s = signals(63, 5.2, 9.7, 71);
    expect(computeDeterministicScore(s)).toBe(computeDeterministicScore(s));
  });

  it('returns 0 for all-zero signals', () => {
    expect(computeDeterministicScore(signals(0, 0, 0, 0))).toBe(0);
  });

  it('returns 100 when every component saturates', () => {
    expect(computeDeterministicScore(signals(100, 8, 15, 100))).toBe(100);
  });

  it('weights components 30/30/20/20 at their half-scale points', () => {
    // burstiness 50/100, sigDensity 4 (half of 8-cap), transition 7.5 (half of
    // 15-cap), coherence 50/100 → every component contributes half its weight.
    expect(computeDeterministicScore(signals(50, 4, 7.5, 50))).toBe(50);
  });

  it('caps the density components so extreme values cannot exceed their weight', () => {
    // sig density 80 (10× the cap) must contribute exactly 30, no more.
    expect(computeDeterministicScore(signals(0, 80, 0, 0))).toBe(30);
    expect(computeDeterministicScore(signals(0, 0, 999, 0))).toBe(20);
  });

  it('is monotonic in each signal', () => {
    const base = computeDeterministicScore(signals(40, 2, 5, 40));
    expect(computeDeterministicScore(signals(60, 2, 5, 40))).toBeGreaterThan(base);
    expect(computeDeterministicScore(signals(40, 4, 5, 40))).toBeGreaterThan(base);
    expect(computeDeterministicScore(signals(40, 2, 10, 40))).toBeGreaterThan(base);
    expect(computeDeterministicScore(signals(40, 2, 5, 60))).toBeGreaterThan(base);
  });

  it('always returns a clamped integer 0-100', () => {
    const out = computeDeterministicScore(signals(100, 999, 999, 100));
    expect(Number.isInteger(out)).toBe(true);
    expect(out).toBeGreaterThanOrEqual(0);
    expect(out).toBeLessThanOrEqual(100);
  });
});

describe('deriveRiskLevel', () => {
  it('maps the fixed bands', () => {
    expect(deriveRiskLevel(0)).toBe('clean');
    expect(deriveRiskLevel(15)).toBe('clean');
    expect(deriveRiskLevel(16)).toBe('low_risk');
    expect(deriveRiskLevel(40)).toBe('low_risk');
    expect(deriveRiskLevel(41)).toBe('moderate');
    expect(deriveRiskLevel(70)).toBe('moderate');
    expect(deriveRiskLevel(71)).toBe('high_risk');
    expect(deriveRiskLevel(100)).toBe('high_risk');
  });
});

describe('hashText', () => {
  it('produces a 64-char hex sha-256 and is deterministic', async () => {
    const a = await hashText('the same essay text');
    const b = await hashText('the same essay text');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the text changes', async () => {
    expect(await hashText('essay one')).not.toBe(await hashText('essay two'));
  });

  it('folds the scorer version into the digest', async () => {
    // Hash must depend on SCORER_VERSION so a future formula bump invalidates
    // old cache rows automatically. Sanity: hashing the raw text without the
    // version prefix gives a different digest.
    const withVersion = await hashText('same text');
    const enc = new TextEncoder().encode('same text');
    const rawDigest = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', enc)),
    ).map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(withVersion).not.toBe(rawDigest);
    expect(SCORER_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('whitespace/line-ending variants hash identically after normalizeText', async () => {
    const a = await hashText(normalizeText('Line one.\r\nLine two.  '));
    const b = await hashText(normalizeText('Line one.\nLine two.'));
    expect(a).toBe(b);
  });
});
