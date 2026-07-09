import { describe, it, expect } from 'vitest';
import { generateTip } from './coachTips';
import type { PatternType } from './coachPatterns';

const PATTERNS: PatternType[] = [
  'passive_voice',
  'wordy_phrase',
  'weak_opener',
  'complex_sentence',
  'transition_density',
  'repetition',
];

describe('generateTip', () => {
  it('produces a tip for every pattern type', () => {
    for (const p of PATTERNS) {
      const tip = generateTip(p, { count: 2, confidence: 0.8 });
      expect(tip.text.length).toBeGreaterThan(10);
      expect(tip.patternType).toBe(p);
      expect(tip.why!.length).toBeGreaterThan(10);
      expect(tip.confidence).toBe(0.8);
    }
  });

  it('wording differs by coach mode', () => {
    const enc = generateTip('passive_voice', { count: 1, confidence: 0.7 }, { mode: 'encouraging' });
    const strict = generateTip('passive_voice', { count: 1, confidence: 0.7 }, { mode: 'strict' });
    expect(enc.text).not.toBe(strict.text);
  });

  it('why differs by academic level', () => {
    const hs = generateTip('wordy_phrase', { count: 1, confidence: 0.9 }, { academicLevel: 'high_school' });
    const pg = generateTip('wordy_phrase', { count: 1, confidence: 0.9 }, { academicLevel: 'postgraduate' });
    expect(hs.why).not.toBe(pg.why);
  });

  it('defaults unknown mode/level to balanced/undergraduate', () => {
    const a = generateTip('repetition', { count: 1, confidence: 0.7 }, { mode: 'bogus', academicLevel: null });
    const b = generateTip('repetition', { count: 1, confidence: 0.7 }, { mode: 'balanced', academicLevel: 'undergraduate' });
    expect(a.text).toBe(b.text);
    expect(a.why).toBe(b.why);
  });

  it('tip text is unique per pattern within a mode (dedupe-safe)', () => {
    const texts = PATTERNS.map((p) => generateTip(p, { count: 1, confidence: 0.7 }).text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
