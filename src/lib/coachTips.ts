// Turns a detected pattern into a concrete coach tip. Pure templates — no
// network — so tips are instant, deterministic, and work offline. Wording
// adapts to the coach mode; the "why" adapts to the student's academic level.

import type { PatternType, PatternHit } from './coachPatterns';
import { PATTERN_CATEGORY } from './coachPatterns';
import type { CoachTip } from './coachMemory';

export type CoachMode = 'encouraging' | 'balanced' | 'strict';
export type AcademicLevel = 'high_school' | 'undergraduate' | 'postgraduate';

interface Template {
  tip: Record<CoachMode, string>;
  why: Record<AcademicLevel, string>;
  suggestion?: string;
  exampleBad?: string;
  exampleGood?: string;
}

const TEMPLATES: Record<PatternType, Template> = {
  passive_voice: {
    tip: {
      encouraging: 'Nice paragraph — try flipping a passive sentence to active voice.',
      balanced: 'A few sentences are passive. Name who does the action.',
      strict: 'Rewrite the passive constructions — say who acts, then what happens.',
    },
    why: {
      high_school: 'Active sentences are shorter and easier to follow — teachers notice.',
      undergraduate: 'Active voice makes your argument agent-driven and more direct.',
      postgraduate: 'Passive framing obscures agency; active voice sharpens causal claims.',
    },
    exampleBad: 'The experiment was conducted by the team.',
    exampleGood: 'The team conducted the experiment.',
  },
  wordy_phrase: {
    tip: {
      encouraging: 'Good flow — a couple of phrases could be tightened.',
      balanced: 'Some phrases here can be shorter without losing meaning.',
      strict: 'Cut the filler phrases — every one has a one-word replacement.',
    },
    why: {
      high_school: 'Shorter phrasing keeps the reader with you and saves word count.',
      undergraduate: 'Concise phrasing raises the signal-to-noise of your argument.',
      postgraduate: 'Economy of expression is a hallmark of publishable academic prose.',
    },
    exampleBad: 'In order to succeed, due to the fact that…',
    exampleGood: 'To succeed, because…',
  },
  weak_opener: {
    tip: {
      encouraging: 'Solid ideas — try opening a sentence with its real subject.',
      balanced: 'Sentences starting with "It is / There are" bury the subject.',
      strict: 'Replace the expletive openers — lead with the subject, not "It is".',
    },
    why: {
      high_school: 'Starting with the real subject makes your point land right away.',
      undergraduate: 'Expletive openers delay the subject and weaken topic sentences.',
      postgraduate: 'Fronting the grammatical subject strengthens thematic progression.',
    },
    exampleBad: 'There are many reasons the policy failed.',
    exampleGood: 'The policy failed for three reasons.',
  },
  complex_sentence: {
    tip: {
      encouraging: 'Rich detail here — one long sentence might read better split in two.',
      balanced: 'A sentence here runs long. Split it where the idea turns.',
      strict: 'Break the 30+ word sentences — one idea per sentence.',
    },
    why: {
      high_school: 'Long sentences lose readers; two short ones are easier to mark.',
      undergraduate: 'Overlong sentences dilute emphasis and invite grammar slips.',
      postgraduate: 'Controlled sentence length modulates emphasis; sprawl flattens it.',
    },
  },
  transition_density: {
    tip: {
      encouraging: 'You connect ideas well — a few transitions could go, though.',
      balanced: 'Transitions are stacking up. Let some sentences connect on their own.',
      strict: 'Too many "however / moreover" — cut the ones that add no logic.',
    },
    why: {
      high_school: 'Too many linking words makes writing feel stiff and padded.',
      undergraduate: 'Over-signposting reads as formulaic; strong logic needs fewer cues.',
      postgraduate: 'Dense discourse markers signal template writing, not argument.',
    },
  },
  repetition: {
    tip: {
      encouraging: 'Clear focus — vary a repeated word to keep the paragraph fresh.',
      balanced: 'A word repeats several times in this paragraph. Vary or restructure.',
      strict: 'The same word appears 3+ times in one paragraph — rework it.',
    },
    why: {
      high_school: 'Repeating a word makes writing feel stuck; synonyms show range.',
      undergraduate: 'Lexical variety keeps emphasis on ideas rather than echoes.',
      postgraduate: 'Unintended repetition suggests drafting residue; vary or pronominalize.',
    },
  },
};

const normalizeLevel = (level: string | null | undefined): AcademicLevel => {
  if (level === 'high_school' || level === 'postgraduate') return level;
  return 'undergraduate';
};

const normalizeMode = (mode: string | null | undefined): CoachMode => {
  if (mode === 'encouraging' || mode === 'strict') return mode;
  return 'balanced';
};

export function generateTip(
  patternType: PatternType,
  hit: PatternHit,
  opts: { mode?: string | null; academicLevel?: string | null } = {},
): CoachTip {
  const t = TEMPLATES[patternType];
  const mode = normalizeMode(opts.mode);
  const level = normalizeLevel(opts.academicLevel);
  return {
    text: t.tip[mode],
    patternType,
    category: PATTERN_CATEGORY[patternType],
    confidence: hit.confidence,
    why: t.why[level],
    suggestion:
      t.exampleBad && t.exampleGood ? `${t.exampleBad} → ${t.exampleGood}` : undefined,
  };
}
