import { describe, it, expect } from 'vitest';
import { detectPatterns, type PatternType } from './coachPatterns';

const count = (r: ReturnType<typeof detectPatterns>, t: PatternType) => r[t]?.count ?? 0;
const conf = (r: ReturnType<typeof detectPatterns>, t: PatternType) => r[t]?.confidence ?? 0;

describe('detectPatterns — passive voice', () => {
  it('detects simple be + past participle', () => {
    const r = detectPatterns('The ball was thrown by the pitcher. The results were analyzed carefully.');
    expect(count(r, 'passive_voice')).toBe(2);
  });

  it('does not flag active voice', () => {
    const r = detectPatterns('The pitcher threw the ball. She analyzed the results carefully.');
    expect(count(r, 'passive_voice')).toBe(0);
  });

  it('detects irregular participles', () => {
    const r = detectPatterns('The essay was written last night. Mistakes were made.');
    expect(count(r, 'passive_voice')).toBe(2);
  });

  it('does not flag adjectival "is happy" style predicates', () => {
    const r = detectPatterns('The dog is happy. The room was quiet.');
    expect(count(r, 'passive_voice')).toBe(0);
  });
});

describe('detectPatterns — wordy phrases', () => {
  it('detects common wordy phrases', () => {
    const r = detectPatterns('In order to succeed, you must work. Due to the fact that it rained, we stayed in.');
    expect(count(r, 'wordy_phrase')).toBe(2);
  });

  it('is case-insensitive', () => {
    const r = detectPatterns('IN ORDER TO win, train hard.');
    expect(count(r, 'wordy_phrase')).toBe(1);
  });

  it('returns zero on concise text', () => {
    const r = detectPatterns('To succeed, you must work. Because it rained, we stayed in.');
    expect(count(r, 'wordy_phrase')).toBe(0);
  });
});

describe('detectPatterns — weak openers', () => {
  it('detects sentences starting with It is / There are', () => {
    const r = detectPatterns('It is clear that the policy failed. There are many reasons for this.');
    expect(count(r, 'weak_opener')).toBe(2);
  });

  it('does not flag "It" as a normal subject mid-sentence', () => {
    const r = detectPatterns('The committee reviewed it. It runs fast.');
    expect(count(r, 'weak_opener')).toBe(0);
  });
});

describe('detectPatterns — complex sentences', () => {
  it('flags a sentence over 30 words', () => {
    const long = 'The committee, which had been meeting for several hours in the main conference room on the third floor of the administration building, finally reached a decision about the new policy proposal yesterday afternoon.';
    const r = detectPatterns(long);
    expect(count(r, 'complex_sentence')).toBeGreaterThanOrEqual(1);
  });

  it('does not flag short clear sentences', () => {
    const r = detectPatterns('The committee met. They reached a decision. The policy passed.');
    expect(count(r, 'complex_sentence')).toBe(0);
  });
});

describe('detectPatterns — transition density', () => {
  it('flags overuse of transitions', () => {
    const text =
      'However, the results were mixed. Furthermore, the sample was small. Moreover, the method was flawed. ' +
      'Therefore, we must be careful. Nevertheless, the trend is clear. Consequently, more work is needed.';
    const r = detectPatterns(text);
    expect(count(r, 'transition_density')).toBeGreaterThanOrEqual(1);
  });

  it('accepts a healthy transition rate', () => {
    const text =
      'The results were mixed because the sample was small. The method also had flaws that limited the findings. ' +
      'However, the overall trend points in a clear direction that future work can build on with better data.';
    const r = detectPatterns(text);
    expect(count(r, 'transition_density')).toBe(0);
  });
});

describe('detectPatterns — repetition', () => {
  it('flags the same content word used 3+ times in a paragraph', () => {
    const r = detectPatterns('The system works well. The system scales. Every system needs care.');
    expect(count(r, 'repetition')).toBeGreaterThanOrEqual(1);
  });

  it('ignores stopwords', () => {
    const r = detectPatterns('The cat and the dog and the bird all sat on the mat by the door.');
    expect(count(r, 'repetition')).toBe(0);
  });

  it('counts per paragraph, not across paragraphs', () => {
    const r = detectPatterns('The system works.\n\nThe system scales.\n\nEvery system needs care.');
    expect(count(r, 'repetition')).toBe(0);
  });
});

describe('detectPatterns — quoted text is ignored', () => {
  it('does not flag patterns inside double quotes', () => {
    const r = detectPatterns('The author notes, "In order to succeed, it is essential that efforts are made." That claim is bold.');
    expect(count(r, 'wordy_phrase')).toBe(0);
    expect(count(r, 'passive_voice')).toBe(0);
  });
});

describe('detectPatterns — confidence scores', () => {
  it('keeps confidences in the 0.6–0.95 band for detected patterns', () => {
    const r = detectPatterns(
      'It is true that the ball was thrown. In order to win, there are many things that were done. ' +
      'The system works. The system scales. The system grows.'
    );
    for (const key of Object.keys(r) as PatternType[]) {
      expect(conf(r, key)).toBeGreaterThanOrEqual(0.6);
      expect(conf(r, key)).toBeLessThanOrEqual(0.95);
    }
  });

  it('omits patterns with zero count entirely', () => {
    const r = detectPatterns('Short and clean.');
    expect(Object.keys(r)).toHaveLength(0);
  });
});

describe('detectPatterns — robustness + performance', () => {
  it('handles empty and whitespace input', () => {
    expect(detectPatterns('')).toEqual({});
    expect(detectPatterns('   \n\n  ')).toEqual({});
  });

  it('processes a 1000-word document in under 200ms', () => {
    const para =
      'It is often said that the essay was written in order to demonstrate a point. However, the argument was made poorly. ';
    const text = para.repeat(60); // ~1200 words
    const t0 = performance.now();
    detectPatterns(text);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(200);
  });
});
