// Per-session coach memory: which patterns fired, which tips were shown and
// what the user did with them, and the current accept streak. Persisted to
// localStorage (guarded — storage failures must never break the editor) so a
// reload mid-session doesn't repeat tips; synced to Supabase at session end
// by the coach context, then cleared.

import type { PatternCategory } from './coachPatterns';
import { sweepLocalStorageKeysWithPrefix } from './storageSweep';

export const COACH_SESSION_PREFIX = 'rb_coach_session_';

// Cap retained per-session tip history so a long session can't inflate
// localStorage (and the eventual server payload) without bound. When we hit
// the cap we first drop unresolved 'shown' entries (no user action to
// preserve), then fall back to oldest-first eviction.
const MAX_TIP_HISTORY = 200;

export interface CoachTip {
  text: string;
  patternType: string;
  category: PatternCategory;
  confidence: number;
  why?: string;
  suggestion?: string;
}

export type TipAction = 'accepted' | 'skipped' | 'learned' | 'shown';

export interface RecordedTip extends CoachTip {
  action: TipAction;
  at: number;
}

interface PersistedState {
  patterns: Record<string, number>;
  tips: RecordedTip[];
  streak: number;
  /** Last time (ms epoch) a tip was shown for a given pattern type. */
  lastShownAt: Record<string, number>;
  /** Last variant index used per pattern type (for wording rotation). */
  lastVariantIndex: Record<string, number>;
}

const emptyState = (): PersistedState => ({
  patterns: {},
  tips: [],
  streak: 0,
  lastShownAt: {},
  lastVariantIndex: {},
});

const normalizeTip = (text: string) => text.trim().toLowerCase();

/** Default rolling cooldown between tips for the same pattern (25 min). */
export const PATTERN_COOLDOWN_MS = 25 * 60 * 1000;
/** Short window in which exact-same wording is suppressed. */
export const SAME_TEXT_SUPPRESSION_MS = PATTERN_COOLDOWN_MS;


export class CoachMemory {
  private readonly key: string;
  private state: PersistedState;

  constructor(sessionId: string) {
    this.key = `${COACH_SESSION_PREFIX}${sessionId}`;
    this.state = this.load();
  }

  private load(): PersistedState {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return emptyState();
      return {
        patterns: typeof parsed.patterns === 'object' && parsed.patterns ? parsed.patterns : {},
        tips: Array.isArray(parsed.tips) ? parsed.tips : [],
        streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
        lastShownAt:
          typeof parsed.lastShownAt === 'object' && parsed.lastShownAt ? parsed.lastShownAt : {},
        lastVariantIndex:
          typeof parsed.lastVariantIndex === 'object' && parsed.lastVariantIndex
            ? parsed.lastVariantIndex
            : {},
      };
    } catch {
      return emptyState();
    }
  }


  private save(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.state));
    } catch {
      // Storage full / disabled — memory continues in-process only.
    }
  }

  recordPattern(type: string, count: number): void {
    this.state.patterns[type] = (this.state.patterns[type] ?? 0) + count;
    this.save();
  }

  getSessionPatterns(): Record<string, number> {
    return { ...this.state.patterns };
  }

  recordTip(tip: CoachTip, action: TipAction): void {
    this.state.tips.push({ ...tip, action, at: Date.now() });
    if (this.state.tips.length > MAX_TIP_HISTORY) {
      // Prefer pruning still-'shown' tips (no user decision yet) before
      // dropping actioned history that the server report cares about.
      const pruned = this.state.tips.filter((t) => t.action !== 'shown');
      this.state.tips = (pruned.length >= this.state.tips.length - MAX_TIP_HISTORY / 2
        ? pruned
        : this.state.tips
      ).slice(-MAX_TIP_HISTORY);
    }
    this.save();
  }

  getTipHistory(): RecordedTip[] {
    return [...this.state.tips];
  }

  hasSeenTip(tipText: string): boolean {
    const norm = normalizeTip(tipText);
    return this.state.tips.some((t) => normalizeTip(t.text) === norm);
  }

  /** Upgrade the most recent record of this tip (e.g. 'shown' → 'accepted'). */
  updateTipAction(tipText: string, action: TipAction): void {
    const norm = normalizeTip(tipText);
    for (let i = this.state.tips.length - 1; i >= 0; i--) {
      if (normalizeTip(this.state.tips[i].text) === norm) {
        this.state.tips[i].action = action;
        this.save();
        return;
      }
    }
  }

  getAcceptedCount(): number {
    return this.state.tips.filter((t) => t.action === 'accepted').length;
  }

  getGivenCount(): number {
    return this.state.tips.length;
  }

  getSkippedCount(): number {
    return this.state.tips.filter((t) => t.action === 'skipped').length;
  }

  getStreak(): number {
    return this.state.streak;
  }

  updateStreak(accepted: boolean): void {
    this.state.streak = accepted ? this.state.streak + 1 : 0;
    this.save();
  }

  /** Remove this session's stored state (after a successful server sync). */
  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // ignore
    }
  }
}

/** Sign-out sweep: remove every stored coach session. */
export function clearAllCoachSessions(): void {
  sweepLocalStorageKeysWithPrefix(COACH_SESSION_PREFIX);
}
