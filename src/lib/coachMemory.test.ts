import { describe, it, expect, beforeEach } from 'vitest';
import {
  CoachMemory,
  clearAllCoachSessions,
  COACH_SESSION_PREFIX,
  type CoachTip,
} from './coachMemory';

const tip = (text: string, patternType = 'passive_voice'): CoachTip => ({
  text,
  patternType,
  category: 'clarity',
  confidence: 0.8,
});

beforeEach(() => {
  localStorage.clear();
});

describe('CoachMemory — session patterns', () => {
  it('accumulates pattern counts', () => {
    const m = new CoachMemory('s1');
    m.recordPattern('passive_voice', 2);
    m.recordPattern('passive_voice', 3);
    m.recordPattern('wordy_phrase', 1);
    expect(m.getSessionPatterns()).toEqual({ passive_voice: 5, wordy_phrase: 1 });
  });
});

describe('CoachMemory — tip history + dedupe', () => {
  it('records tips with their action', () => {
    const m = new CoachMemory('s1');
    m.recordTip(tip('Try active voice.'), 'accepted');
    m.recordTip(tip('Trim this phrase.', 'wordy_phrase'), 'skipped');
    expect(m.getTipHistory()).toHaveLength(2);
    expect(m.getTipHistory()[0].action).toBe('accepted');
  });

  it('hasSeenTip matches ignoring case and surrounding whitespace', () => {
    const m = new CoachMemory('s1');
    m.recordTip(tip('Try active voice.'), 'shown');
    expect(m.hasSeenTip('Try active voice.')).toBe(true);
    expect(m.hasSeenTip('  try ACTIVE voice.  ')).toBe(true);
    expect(m.hasSeenTip('A different tip.')).toBe(false);
  });

  it('counts accepted tips', () => {
    const m = new CoachMemory('s1');
    m.recordTip(tip('a'), 'accepted');
    m.recordTip(tip('b'), 'skipped');
    m.recordTip(tip('c'), 'accepted');
    expect(m.getAcceptedCount()).toBe(2);
    expect(m.getGivenCount()).toBe(3);
  });
});

describe('CoachMemory — streak', () => {
  it('increments on accept and resets on skip', () => {
    const m = new CoachMemory('s1');
    m.updateStreak(true);
    m.updateStreak(true);
    expect(m.getStreak()).toBe(2);
    m.updateStreak(false);
    expect(m.getStreak()).toBe(0);
    m.updateStreak(true);
    expect(m.getStreak()).toBe(1);
  });
});

describe('CoachMemory — persistence', () => {
  it('persists to localStorage and restores in a new instance', () => {
    const m = new CoachMemory('s1');
    m.recordPattern('weak_opener', 4);
    m.recordTip(tip('Open with the subject.'), 'accepted');
    m.updateStreak(true);

    const restored = new CoachMemory('s1');
    expect(restored.getSessionPatterns()).toEqual({ weak_opener: 4 });
    expect(restored.getTipHistory()).toHaveLength(1);
    expect(restored.getStreak()).toBe(1);
    expect(restored.hasSeenTip('Open with the subject.')).toBe(true);
  });

  it('uses the rb_coach_session_ key prefix', () => {
    const m = new CoachMemory('abc');
    m.recordPattern('repetition', 1);
    expect(localStorage.getItem(`${COACH_SESSION_PREFIX}abc`)).toBeTruthy();
  });

  it('survives corrupted stored state', () => {
    localStorage.setItem(`${COACH_SESSION_PREFIX}bad`, '{not json');
    const m = new CoachMemory('bad');
    expect(m.getSessionPatterns()).toEqual({});
    expect(m.getStreak()).toBe(0);
  });

  it('clear() removes the stored session', () => {
    const m = new CoachMemory('s1');
    m.recordPattern('repetition', 1);
    m.clear();
    expect(localStorage.getItem(`${COACH_SESSION_PREFIX}s1`)).toBeNull();
  });
});

describe('clearAllCoachSessions — sign-out sweep', () => {
  it('removes only rb_coach_session_* keys', () => {
    const a = new CoachMemory('s1');
    a.recordPattern('repetition', 1);
    const b = new CoachMemory('s2');
    b.recordPattern('repetition', 2);
    localStorage.setItem('rb_other', 'keep');

    clearAllCoachSessions();

    expect(localStorage.getItem(`${COACH_SESSION_PREFIX}s1`)).toBeNull();
    expect(localStorage.getItem(`${COACH_SESSION_PREFIX}s2`)).toBeNull();
    expect(localStorage.getItem('rb_other')).toBe('keep');
  });
});
