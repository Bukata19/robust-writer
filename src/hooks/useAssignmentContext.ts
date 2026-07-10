// Bridges the Assignment Decoder's session into the Writing Coach: maps the
// assignment's instruction verbs and outline sections onto coach focus
// categories, so tips lean toward what the assignment is actually graded on.
// Pure derivation over the decoder's live state — no storage, no network.

import { useMemo } from 'react';
import type { PatternCategory } from '@/lib/coachPatterns';

// The subset of decoder state the mapping needs (structural typing keeps this
// hook decoupled from the decoder hook's full return object).
export interface AssignmentLike {
  sessionContext?: string;
  questionAnalysis?: { instructionVerbs?: string[] } | null;
  outline?: { heading: string }[];
  step?: string;
}

// Instruction verb → the categories that kind of writing lives or dies on.
const VERB_FOCUS: Record<string, PatternCategory[]> = {
  analyse: ['clarity', 'structure'],
  analyze: ['clarity', 'structure'],
  evaluate: ['clarity', 'structure'],
  discuss: ['clarity', 'structure'],
  compare: ['structure', 'clarity'],
  contrast: ['structure', 'clarity'],
  argue: ['clarity', 'tone'],
  justify: ['clarity', 'tone'],
  persuade: ['tone', 'clarity'],
  critique: ['clarity', 'tone'],
  describe: ['conciseness', 'structure'],
  outline: ['conciseness', 'structure'],
  summarise: ['conciseness'],
  summarize: ['conciseness'],
  explain: ['clarity', 'conciseness'],
  define: ['conciseness', 'clarity'],
};

export interface AssignmentContext {
  /** True once the decoder has produced a usable assignment session. */
  active: boolean;
  /** Coach categories to prioritize, deduped, max 2 (leaves room for the user's own picks). */
  suggestedFocus: PatternCategory[];
  /** Short human line for the coach panel strip. */
  summary: string | null;
}

export function useAssignmentContext(assignment: AssignmentLike | null | undefined): AssignmentContext {
  return useMemo(() => {
    const verbs = (assignment?.questionAnalysis?.instructionVerbs ?? [])
      .map((v) => v.toLowerCase().trim());
    const hasSession = Boolean(assignment?.sessionContext) && verbs.length > 0;
    if (!hasSession) {
      return { active: false, suggestedFocus: [], summary: null };
    }

    const focus: PatternCategory[] = [];
    for (const verb of verbs) {
      for (const cat of VERB_FOCUS[verb] ?? []) {
        if (!focus.includes(cat)) focus.push(cat);
      }
    }
    const suggestedFocus = focus.slice(0, 2);
    const summary =
      suggestedFocus.length > 0
        ? `Assignment asks you to ${verbs.slice(0, 2).join(' and ')} — prioritizing ${suggestedFocus.join(' and ')}.`
        : null;

    return { active: true, suggestedFocus, summary };
  }, [assignment?.sessionContext, assignment?.questionAnalysis]);
}
