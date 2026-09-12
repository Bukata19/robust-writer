// Writing Coach pattern engine. Pure, rule-based (no network, works offline),
// so tips are instant and free. Detects six writing patterns with a count and
// a confidence in the 0.6–0.95 band. Quoted text is ignored — the writer
// didn't author it.

export type PatternType =
  | 'passive_voice'
  | 'wordy_phrase'
  | 'weak_opener'
  | 'complex_sentence'
  | 'transition_density'
  | 'repetition';

export type PatternCategory = 'clarity' | 'conciseness' | 'tone' | 'structure' | 'grammar';

/** Character range within the analyzed paragraph text. */
export interface TextRange {
  start: number;
  end: number;
}

export interface PatternHit {
  count: number;
  confidence: number;
  /** Locations of the flagged text, relative to the analyzed paragraph. */
  ranges?: TextRange[];
}


export type PatternMap = Partial<Record<PatternType, PatternHit>>;

export const PATTERN_CATEGORY: Record<PatternType, PatternCategory> = {
  passive_voice: 'clarity',
  wordy_phrase: 'conciseness',
  weak_opener: 'clarity',
  complex_sentence: 'structure',
  transition_density: 'structure',
  repetition: 'tone',
};

const WORDY_PHRASES = [
  'in order to',
  'due to the fact that',
  'at this point in time',
  'in the event that',
  'for the purpose of',
  'with regard to',
  'in spite of the fact that',
  'on account of',
  'it is important to note that',
  'as a matter of fact',
  'in a timely manner',
  'in the process of',
  'has the ability to',
  'a large number of',
];

const TRANSITIONS = [
  'however',
  'therefore',
  'furthermore',
  'moreover',
  'consequently',
  'additionally',
  'nevertheless',
  'nonetheless',
  'thus',
  'hence',
  'meanwhile',
  'subsequently',
  'accordingly',
  'in addition',
  'as a result',
  'on the other hand',
  'in conclusion',
  'for example',
  'for instance',
];

// Irregular past participles the simple "-ed" passive regex would miss.
const IRREGULAR_PARTICIPLES = [
  'known', 'done', 'made', 'seen', 'taken', 'given', 'written', 'shown',
  'found', 'held', 'kept', 'left', 'lost', 'paid', 'sent', 'told', 'thought',
  'built', 'bought', 'caught', 'taught', 'sold', 'felt', 'meant', 'said',
  'chosen', 'broken', 'spoken', 'driven', 'drawn', 'grown', 'thrown', 'worn',
  'begun', 'sung', 'won', 'read', 'understood', 'set', 'put',
];

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'has', 'had', 'was',
  'were', 'are', 'is', 'been', 'being', 'will', 'would', 'could', 'should',
  'they', 'their', 'them', 'there', 'these', 'those', 'when', 'where', 'which',
  'while', 'what', 'about', 'into', 'over', 'under', 'because', 'also', 'more',
  'most', 'some', 'such', 'than', 'then', 'very', 'just', 'each', 'other',
  'only', 'both', 'between', 'through', 'during', 'before', 'after', 'many',
  'much', 'against', 'itself',
]);

// Require a 3+ char stem before "ed" so common short adjectives ("red",
// "sad", "mad", "bad") don't get flagged as passive-voice participles. Real
// past participles of any length still fall through IRREGULAR_PARTICIPLES.
const PASSIVE_RE = new RegExp(
  `\\b(?:is|are|was|were|been|being|be)\\s+(?:\\w{3,}ed|${IRREGULAR_PARTICIPLES.join('|')})\\b`,
  'gi',
);

/**
 * Add/remove a focus area with an inclusive cap (default 3). Shared by the
 * Writing Coach panel and Settings drawer so both stay in lockstep.
 */
export function toggleFocusArea<T>(current: T[], area: T, max = 3): T[] {
  return current.includes(area)
    ? current.filter((a) => a !== area)
    : current.length < max
      ? [...current, area]
      : current;
}

const WEAK_OPENER_RE = /^(?:it\s+is|it's|there\s+is|there\s+are|there\s+was|there\s+were)\b/i;

/**
 * Strip double-quoted spans and fenced code blocks — not the writer's prose.
 * Replacements are LENGTH-PRESERVING (blanked with spaces) so character offsets
 * in the cleaned text still line up with the original paragraph text.
 */
const blank = (m: string) => ' '.repeat(m.length);
const stripQuoted = (text: string): string =>
  text
    .replace(/```[\s\S]*?```/g, blank)
    .replace(/"[^"\n]{0,400}"/g, blank)
    .replace(/“[^”\n]{0,400}”/g, blank); // curly quotes

interface Span {
  text: string;
  start: number;
}

/** Sentence split that also reports each sentence's offset in `text`. */
const splitSentenceSpans = (text: string): Span[] => {
  const out: Span[] = [];
  let cursor = 0;
  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    const trimmedStart = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length > 0) out.push({ text: trimmed, start: cursor + trimmedStart });
    cursor += raw.length;
    // account for the whitespace consumed by the split
    const next = text.slice(cursor).match(/^\s+/);
    if (next) cursor += next[0].length;
  }
  return out;
};


const countWords = (text: string): number =>
  (text.match(/[\w'-]+/g) ?? []).length;

/** Confidence grows gently with evidence, clamped to the 0.6–0.95 band. */
const confidenceFor = (base: number, evidence: number): number =>
  Math.min(0.95, Math.max(0.6, base + Math.min(evidence - 1, 4) * 0.05));

export function detectPatterns(text: string): PatternMap {
  const result: PatternMap = {};
  const cleaned = stripQuoted(text ?? '');
  if (!cleaned.trim()) return result;

  const spans = splitSentenceSpans(cleaned);
  const totalWords = countWords(cleaned);

  // passive_voice — be-verb + past participle per sentence occurrence.
  let passive = 0;
  const passiveRanges: TextRange[] = [];
  for (const span of spans) {
    const re = new RegExp(PASSIVE_RE.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(span.text)) !== null) {
      passive++;
      passiveRanges.push({ start: span.start + m.index, end: span.start + m.index + m[0].length });
    }
  }
  if (passive > 0) {
    result.passive_voice = { count: passive, confidence: confidenceFor(0.7, passive), ranges: passiveRanges };
  }

  // wordy_phrase — known bloat phrases, case-insensitive.
  let wordy = 0;
  const wordyRanges: TextRange[] = [];
  const lower = cleaned.toLowerCase();
  for (const phrase of WORDY_PHRASES) {
    let idx = lower.indexOf(phrase);
    while (idx !== -1) {
      wordy++;
      wordyRanges.push({ start: idx, end: idx + phrase.length });
      idx = lower.indexOf(phrase, idx + phrase.length);
    }
  }
  if (wordy > 0) {
    result.wordy_phrase = { count: wordy, confidence: confidenceFor(0.85, wordy), ranges: wordyRanges };
  }

  // weak_opener — sentences starting with expletive constructions.
  let weak = 0;
  const weakRanges: TextRange[] = [];
  for (const span of spans) {
    const m = span.text.match(WEAK_OPENER_RE);
    if (m) {
      weak++;
      weakRanges.push({ start: span.start, end: span.start + m[0].length });
    }
  }
  if (weak > 0) {
    result.weak_opener = { count: weak, confidence: confidenceFor(0.8, weak), ranges: weakRanges };
  }

  // complex_sentence — > 30 words, or > 3 comma/semicolon-separated clauses.
  let complex = 0;
  const complexRanges: TextRange[] = [];
  for (const span of spans) {
    const words = countWords(span.text);
    const clauses = span.text.split(/[,;]/).length;
    if (words > 30 || clauses > 4) {
      complex++;
      complexRanges.push({ start: span.start, end: span.start + span.text.length });
    }
  }
  if (complex > 0) {
    result.complex_sentence = { count: complex, confidence: confidenceFor(0.75, complex), ranges: complexRanges };
  }

  // transition_density — transitions per 100 words; healthy is 3–5.
  if (totalWords >= 30) {
    let transitions = 0;
    const transitionRanges: TextRange[] = [];
    for (const t of TRANSITIONS) {
      const re = new RegExp(`(?<![\\w-])${t.replace(/\s+/g, '\\s+')}(?![\\w-])`, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(cleaned)) !== null) {
        transitions++;
        transitionRanges.push({ start: m.index, end: m.index + m[0].length });
      }
    }
    const per100 = (transitions / totalWords) * 100;
    if (per100 > 5) {
      const excess = Math.ceil(per100 - 5);
      result.transition_density = {
        count: excess,
        confidence: confidenceFor(0.65, excess),
        ranges: transitionRanges.sort((a, b) => a.start - b.start),
      };
    }
  }

  // repetition — same content word (4+ chars, non-stopword) 3+ times within a
  // paragraph. Paragraphs are the writer's own blocks; counting across them
  // would punish legitimate keyword use in long documents.
  let repeatedWords = 0;
  const repetitionRanges: TextRange[] = [];
  let paraOffset = 0;
  for (const para of cleaned.split(/\n{2,}/)) {
    const occurrences = new Map<string, TextRange[]>();
    const wordRe = /[a-z][a-z'-]{3,}/gi;
    let m: RegExpExecArray | null;
    while ((m = wordRe.exec(para)) !== null) {
      const w = m[0].toLowerCase();
      if (STOPWORDS.has(w)) continue;
      const list = occurrences.get(w) ?? [];
      list.push({ start: paraOffset + m.index, end: paraOffset + m.index + m[0].length });
      occurrences.set(w, list);
    }
    for (const list of occurrences.values()) {
      if (list.length >= 3) {
        repeatedWords++;
        repetitionRanges.push(...list);
      }
    }
    paraOffset += para.length + 2; // paragraph plus its separator
  }
  if (repeatedWords > 0) {
    result.repetition = {
      count: repeatedWords,
      confidence: confidenceFor(0.7, repeatedWords),
      ranges: repetitionRanges.sort((a, b) => a.start - b.start),
    };
  }

  return result;
}

