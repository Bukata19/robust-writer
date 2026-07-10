import { describe, it, expect } from 'vitest';
import { computeReport } from './coachReporting';
import type { CoachSessionRow, CoachTipRow } from './coachDb';

const session = (over: Partial<CoachSessionRow>): CoachSessionRow => ({
  id: 's',
  user_id: 'u',
  document_id: null,
  session_start: '2026-07-01T10:00:00Z',
  session_end: '2026-07-01T11:00:00Z',
  tips_given: 0,
  tips_accepted: 0,
  tips_skipped: 0,
  acceptance_rate: null,
  patterns: {},
  milestones: [],
  session_focus_areas: [],
  ...over,
});

const FROM = new Date('2026-07-01T00:00:00Z');
const TO = new Date('2026-07-08T00:00:00Z');

describe('computeReport', () => {
  it('totals tips and sessions across the range', () => {
    const sessions = [
      session({ id: 'a', tips_given: 5, tips_accepted: 3, tips_skipped: 1 }),
      session({ id: 'b', tips_given: 4, tips_accepted: 4, tips_skipped: 0 }),
    ];
    const r = computeReport(sessions, [], FROM, TO);
    expect(r.sessionCount).toBe(2);
    expect(r.tipsGiven).toBe(9);
    expect(r.tipsAccepted).toBe(7);
    expect(r.acceptanceRate).toBeCloseTo(7 / 9);
  });

  it('ranks top patterns by summed counts with labels', () => {
    const sessions = [
      session({ id: 'a', patterns: { passive_voice: 3, wordy_phrase: 1 } }),
      session({ id: 'b', patterns: { passive_voice: 2 } }),
    ];
    const r = computeReport(sessions, [], FROM, TO);
    expect(r.topPatterns[0]).toMatchObject({ type: 'passive_voice', count: 5 });
    expect(r.topPatterns[0].label.length).toBeGreaterThan(0);
    expect(r.topPatterns).toHaveLength(2);
  });

  it('reports improvements when a pattern declines between range halves', () => {
    const sessions = [
      session({ id: 'a', session_start: '2026-07-01T10:00:00Z', patterns: { passive_voice: 8 } }),
      session({ id: 'b', session_start: '2026-07-06T10:00:00Z', patterns: { passive_voice: 2 } }),
    ];
    const r = computeReport(sessions, [], FROM, TO);
    const imp = r.improvements.find((i) => i.type === 'passive_voice');
    expect(imp).toBeTruthy();
    expect(imp!.deltaPct).toBe(75); // 8 -> 2
  });

  it('does not report improvement when a pattern worsens', () => {
    const sessions = [
      session({ id: 'a', session_start: '2026-07-01T10:00:00Z', patterns: { repetition: 1 } }),
      session({ id: 'b', session_start: '2026-07-06T10:00:00Z', patterns: { repetition: 5 } }),
    ];
    const r = computeReport(sessions, [], FROM, TO);
    expect(r.improvements).toHaveLength(0);
  });

  it('handles the empty range', () => {
    const r = computeReport([], [], FROM, TO);
    expect(r.sessionCount).toBe(0);
    expect(r.tipsGiven).toBe(0);
    expect(r.acceptanceRate).toBeNull();
    expect(r.topPatterns).toHaveLength(0);
    expect(r.improvements).toHaveLength(0);
  });

  it('counts tip actions from the tip log', () => {
    const tips: CoachTipRow[] = [
      { user_id: 'u', session_id: 's', tip_text: 'a', pattern_type: 'passive_voice', category: 'clarity', confidence: 0.8, user_action: 'accepted' },
      { user_id: 'u', session_id: 's', tip_text: 'b', pattern_type: 'wordy_phrase', category: 'conciseness', confidence: 0.9, user_action: 'skipped' },
    ];
    const r = computeReport([], tips, FROM, TO);
    expect(r.tipLogCount).toBe(2);
  });
});
