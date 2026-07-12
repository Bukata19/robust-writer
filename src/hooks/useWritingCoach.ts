// The Writing Coach loop: wait for a 12s typing pause, run the local pattern
// engine on the current paragraph, pick the most useful un-seen pattern
// (repeat offenders first), and surface a template tip tuned to the user's
// mode and academic level. Fully client-side — no network per tip.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { detectPatterns, PATTERN_CATEGORY, type PatternType } from '@/lib/coachPatterns';
import { generateTip, variantCount } from '@/lib/coachTips';

import type { CoachTip } from '@/lib/coachMemory';
import { useCoach } from '@/contexts/CoachContext';
import { useAuth } from '@/contexts/AuthContext';

const PAUSE_MS = 12_000;
const MIN_WORDS = 15;
const ACCEPT_COOLDOWN_MS = 10_000;

// Mode → minimum confidence a pattern needs to earn a tip.
const MODE_THRESHOLD: Record<string, number> = {
  encouraging: 0.8,
  balanced: 0.7,
  strict: 0,
};

interface Options {
  editor: Editor | null;
  /** Optional assignment context; boosts matching focus categories (Coach 5). */
  suggestedFocus?: string[];
}

export function useWritingCoach({ editor, suggestedFocus }: Options) {
  const { profile } = useAuth();
  const coach = useCoach();
  const [tip, setTip] = useState<CoachTip | null>(null);

  const timerRef = useRef<number | null>(null);
  const cooldownUntilRef = useRef(0);
  const lastParagraphRef = useRef('');
  const tipRef = useRef<CoachTip | null>(null);
  tipRef.current = tip;

  // Live values for the pause callback without re-subscribing the editor.
  const coachRef = useRef(coach);
  coachRef.current = coach;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const suggestedFocusRef = useRef(suggestedFocus);
  suggestedFocusRef.current = suggestedFocus;

  const dismiss = useCallback(() => setTip(null), []);

  const onAccept = useCallback(() => {
    const current = tipRef.current;
    if (!current) return;
    coachRef.current.recordTipAction(current, 'accepted');
    cooldownUntilRef.current = Date.now() + ACCEPT_COOLDOWN_MS;
    setTip(null);
  }, []);

  const onSkip = useCallback(() => {
    const current = tipRef.current;
    if (!current) return;
    coachRef.current.recordTipAction(current, 'skipped');
    setTip(null);
  }, []);

  useEffect(() => {
    if (!editor || !coach.enabled) {
      setTip(null);
      return;
    }

    const evaluate = () => {
      const c = coachRef.current;
      if (!c.session) return;
      if (Date.now() < cooldownUntilRef.current) return;

      let paragraph = '';
      try {
        paragraph = editor.state.selection.$anchor.node(1)?.textContent ?? '';
      } catch {
        paragraph = '';
      }
      if (paragraph.trim().split(/\s+/).filter(Boolean).length < MIN_WORDS) return;
      if (paragraph === lastParagraphRef.current) return;
      lastParagraphRef.current = paragraph;

      const detected = detectPatterns(paragraph);
      const entries = Object.entries(detected) as [PatternType, { count: number; confidence: number }][];
      if (entries.length === 0) return;

      c.recordPatterns(Object.fromEntries(entries.map(([t, h]) => [t, h.count])));

      const threshold = MODE_THRESHOLD[c.mode] ?? 0.7;
      const focus = new Set([...(c.focusAreas ?? []), ...(suggestedFocusRef.current ?? [])]);
      const repeatCounts = new Map(
        c.aggregates.map((a) => [a.pattern_type, a.total_occurrences]),
      );

      const ranked = entries
        .filter(([, hit]) => hit.confidence >= threshold)
        .map(([type, hit]) => {
          const focusBoost = focus.size > 0 && focus.has(PATTERN_CATEGORY[type]) ? 1 : 0;
          const repeatBoost = Math.min((repeatCounts.get(type) ?? 0) / 20, 1);
          return { type, hit, score: focusBoost * 2 + repeatBoost + hit.confidence };
        })
        .sort((a, b) => b.score - a.score);

      for (const { type, hit } of ranked) {
        // Primary gate: has enough time elapsed since we last flagged THIS
        // pattern? (Prevents robotic re-hits, but doesn't silence forever.)
        if (!c.canShowPattern(type)) continue;
        const idx = c.nextVariantIndex(type, variantCount(type, c.mode));
        const candidate = generateTip(type, hit, {
          mode: c.mode,
          academicLevel: (profileRef.current as { academic_level?: string | null } | null)?.academic_level,
          variantIndex: idx,
        });
        // Secondary gate: don't repeat literally identical wording within the
        // suppression window (belt-and-braces on top of variant rotation).
        if (c.wasSameTextShownRecently(candidate.text)) continue;
        c.recordTipShown(candidate);
        setTip(candidate);
        return;
      }

    };

    const handler = () => {
      // Typing again means the current tip was ignored — clear it and rearm.
      setTip(null);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(evaluate, PAUSE_MS);
    };

    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [editor, coach.enabled]);

  return { tip, streak: coach.session?.streak ?? 0, onAccept, onSkip, dismiss };
}
