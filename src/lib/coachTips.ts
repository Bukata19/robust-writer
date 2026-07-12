// Turns a detected pattern into a concrete coach tip. Pure templates — no
// network — so tips are instant, deterministic, and work offline. Wording
// adapts to the coach mode; the "why" adapts to the student's academic level.
//
// Each pattern+mode has multiple phrasing variants so that when the coach
// legitimately re-flags a recurring pattern later in the same session, the
// wording rotates rather than repeating verbatim. The dedupe primary key is
// the pattern type + a rolling cooldown (see CoachMemory); variants are only
// a freshness layer on top of that.

import type { PatternType, PatternHit } from './coachPatterns';
import { PATTERN_CATEGORY } from './coachPatterns';
import type { CoachTip } from './coachMemory';

export type CoachMode = 'encouraging' | 'balanced' | 'strict';
export type AcademicLevel = 'high_school' | 'undergraduate' | 'postgraduate';

interface Template {
  tip: Record<CoachMode, string[]>;
  why: Record<AcademicLevel, string>;
  suggestion?: string;
  exampleBad?: string;
  exampleGood?: string;
}

const TEMPLATES: Record<PatternType, Template> = {
  passive_voice: {
    tip: {
      encouraging: [
        'Nice paragraph — try flipping a passive sentence to active voice.',
        'Great momentum — one active-voice swap would sharpen this even more.',
        'Solid writing — pick a passive sentence and name who does the action.',
      ],
      balanced: [
        'A few sentences are passive. Name who does the action.',
        'Passive voice is creeping back in — put the actor first.',
        'Try converting a passive sentence: subject, then verb.',
      ],
      strict: [
        'Rewrite the passive constructions — say who acts, then what happens.',
        'Passive voice again — restructure so the actor drives the sentence.',
        'Cut the passive framing. Lead with the agent doing the work.',
      ],
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
      encouraging: [
        'Good flow — a couple of phrases could be tightened.',
        'Reading well — a small trim on a filler phrase would sharpen it.',
        'Nice rhythm — one or two phrases have shorter equivalents.',
      ],
      balanced: [
        'Some phrases here can be shorter without losing meaning.',
        'Filler phrases are stacking up — swap in one-word replacements.',
        'Trim a wordy phrase or two; the meaning survives fine.',
      ],
      strict: [
        'Cut the filler phrases — every one has a one-word replacement.',
        'More padding — replace the wordy phrases with single words.',
        'Tighten this: filler phrases are diluting the sentences.',
      ],
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
      encouraging: [
        'Solid ideas — try opening a sentence with its real subject.',
        'Good thought — lead with the subject instead of "It is / There are".',
        'Nice draft — one sentence would land harder if the subject came first.',
      ],
      balanced: [
        'Sentences starting with "It is / There are" bury the subject.',
        'Expletive openers again — front the real subject.',
        'Reopen a sentence with its subject rather than "It is / There are".',
      ],
      strict: [
        'Replace the expletive openers — lead with the subject, not "It is".',
        'Drop the "There are" / "It is" starts — put the subject first.',
        'Expletive openers keep appearing — restructure to subject-first.',
      ],
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
      encouraging: [
        'Rich detail here — one long sentence might read better split in two.',
        'Great content — a long sentence could breathe with a split.',
        'Good depth — try breaking one long sentence where the idea turns.',
      ],
      balanced: [
        'A sentence here runs long. Split it where the idea turns.',
        'Long sentence again — break it at a natural clause boundary.',
        'One-idea-per-sentence: split the longest sentence here.',
      ],
      strict: [
        'Break the 30+ word sentences — one idea per sentence.',
        'Long sentences again. Split them so each carries one idea.',
        'Cut the runaway sentences into shorter units at each clause.',
      ],
    },
    why: {
      high_school: 'Long sentences lose readers; two short ones are easier to mark.',
      undergraduate: 'Overlong sentences dilute emphasis and invite grammar slips.',
      postgraduate: 'Controlled sentence length modulates emphasis; sprawl flattens it.',
    },
  },
  transition_density: {
    tip: {
      encouraging: [
        'You connect ideas well — a few transitions could go, though.',
        'Nice logic — trim a transition or two; the flow will still hold.',
        'Good structure — a couple of "however / moreover" could come out.',
      ],
      balanced: [
        'Transitions are stacking up. Let some sentences connect on their own.',
        'Too many linkers — drop the ones that don\'t add real logic.',
        'Trim the discourse markers; the argument can carry itself.',
      ],
      strict: [
        'Too many "however / moreover" — cut the ones that add no logic.',
        'Over-signposting again — remove transitions that don\'t change meaning.',
        'Strip the redundant transitions; keep only the ones that pivot logic.',
      ],
    },
    why: {
      high_school: 'Too many linking words makes writing feel stiff and padded.',
      undergraduate: 'Over-signposting reads as formulaic; strong logic needs fewer cues.',
      postgraduate: 'Dense discourse markers signal template writing, not argument.',
    },
  },
  repetition: {
    tip: {
      encouraging: [
        'Clear focus — vary a repeated word to keep the paragraph fresh.',
        'Nice consistency — swap in a synonym for a repeated word.',
        'Good clarity — one repeated word could use a synonym.',
      ],
      balanced: [
        'A word repeats several times in this paragraph. Vary or restructure.',
        'Repetition again — try a synonym or a pronoun on one instance.',
        'The same word keeps returning — rework or pronominalize.',
      ],
      strict: [
        'The same word appears 3+ times in one paragraph — rework it.',
        'Repetition again. Vary the word or restructure the sentences.',
        'Break the repetition: synonym, pronoun, or reworked clause.',
      ],
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

/** How many wording variants exist for a given pattern+mode. */
export function variantCount(patternType: PatternType, mode?: string | null): number {
  return TEMPLATES[patternType].tip[normalizeMode(mode)].length;
}

export function generateTip(
  patternType: PatternType,
  hit: PatternHit,
  opts: { mode?: string | null; academicLevel?: string | null; variantIndex?: number } = {},
): CoachTip {
  const t = TEMPLATES[patternType];
  const mode = normalizeMode(opts.mode);
  const level = normalizeLevel(opts.academicLevel);
  const variants = t.tip[mode];
  const idx =
    typeof opts.variantIndex === 'number'
      ? ((opts.variantIndex % variants.length) + variants.length) % variants.length
      : 0;
  return {
    text: variants[idx],
    patternType,
    category: PATTERN_CATEGORY[patternType],
    confidence: hit.confidence,
    why: t.why[level],
    suggestion:
      t.exampleBad && t.exampleGood ? `${t.exampleBad} → ${t.exampleGood}` : undefined,
  };
}
