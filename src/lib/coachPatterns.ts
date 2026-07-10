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

export interface PatternHit {
  count: number;
  confidence: number;
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

/** Strip double-quoted spans and fenced code blocks — not the writer's prose. */
const stripQuoted = (text: string): string =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/"[^"\n]{0,400}"/g, ' ')
    .replace(/“[^”\n]{0,400}”/g, ' '); // curly quotes

const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const countWords = (text: string): number =>
  (text.match(/[\w'-]+/g) ?? []).length;

/** Confidence grows gently with evidence, clamped to the 0.6–0.95 band. */
const confidenceFor = (base: number, evidence: number): number =>
  Math.min(0.95, Math.max(0.6, base + Math.min(evidence - 1, 4) * 0.05));

export function detectPatterns(text: string): PatternMap {
  const result: PatternMap = {};
  const cleaned = stripQuoted(text ?? '');
  if (!cleaned.trim()) return result;

  const sentences = splitSentences(cleaned);
  const totalWords = countWords(cleaned);

  // passive_voice — be-verb + past participle per sentence occurrence.
  let passive = 0;
  for (const s of sentences) {
    passive += (s.match(PASSIVE_RE) ?? []).length;
  }
  if (passive > 0) result.passive_voice = { count: passive, confidence: confidenceFor(0.7, passive) };

  // wordy_phrase — known bloat phrases, case-insensitive.
  let wordy = 0;
  const lower = cleaned.toLowerCase();
  for (const phrase of WORDY_PHRASES) {
    let idx = lower.indexOf(phrase);
    while (idx !== -1) {
      wordy++;
      idx = lower.indexOf(phrase, idx + phrase.length);
    }
  }
  if (wordy > 0) result.wordy_phrase = { count: wordy, confidence: confidenceFor(0.85, wordy) };

  // weak_opener — sentences starting with expletive constructions.
  let weak = 0;
  for (const s of sentences) {
    if (WEAK_OPENER_RE.test(s)) weak++;
  }
  if (weak > 0) result.weak_opener = { count: weak, confidence: confidenceFor(0.8, weak) };

  // complex_sentence — > 30 words, or > 3 comma/semicolon-separated clauses.
  let complex = 0;
  for (const s of sentences) {
    const words = countWords(s);
    const clauses = s.split(/[,;]/).length;
    if (words > 30 || clauses > 4) complex++;
  }
  if (complex > 0) result.complex_sentence = { count: complex, confidence: confidenceFor(0.75, complex) };

  // transition_density — transitions per 100 words; healthy is 3–5.
  if (totalWords >= 30) {
    let transitions = 0;
    for (const t of TRANSITIONS) {
      const re = new RegExp(`(?<![\\w-])${t.replace(/\s+/g, '\\s+')}(?![\\w-])`, 'gi');
      transitions += (cleaned.match(re) ?? []).length;
    }
    const per100 = (transitions / totalWords) * 100;
    if (per100 > 5) {
      const excess = Math.ceil(per100 - 5);
      result.transition_density = { count: excess, confidence: confidenceFor(0.65, excess) };
    }
  }

  // repetition — same content word (4+ chars, non-stopword) 3+ times within a
  // paragraph. Paragraphs are the writer's own blocks; counting across them
  // would punish legitimate keyword use in long documents.
  const paragraphs = cleaned.split(/\n{2,}/);
  let repeatedWords = 0;
  for (const para of paragraphs) {
    const words = (para.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []).filter(
      (w) => !STOPWORDS.has(w),
    );
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    for (const n of freq.values()) {
      if (n >= 3) repeatedWords++;
    }
  }
  if (repeatedWords > 0) {
    result.repetition = { count: repeatedWords, confidence: confidenceFor(0.7, repeatedWords) };
  }

  return result;
}
