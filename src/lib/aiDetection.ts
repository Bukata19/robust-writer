// Client-side AI-signal lexicon + matching helpers. Mirrors the deterministic
// lists in supabase/functions/plagiarism/index.ts so the editor can highlight
// AI words/phrases live (no API call) and offer one-click human alternatives.

export const AI_WORDS: string[] = [
  'delve', 'tapestry', 'leverage', 'leveraging', 'leveraged',
  'navigating', 'crucial', 'paramount', 'multifaceted', 'robust',
  'nuanced', 'nuance', 'furthermore', 'moreover', 'myriad',
  'comprehensive', 'underscore', 'underscores', 'underscored',
  'pivotal', 'seamlessly', 'intricate', 'holistic', 'synergy',
  'synergies', 'synergistic', 'foster', 'fosters', 'fostered',
  'fostering', 'facilitate', 'facilitates', 'facilitated',
  'facilitating', 'streamline', 'streamlines', 'streamlined',
  'optimize', 'optimizes', 'optimized', 'optimizing',
  'innovative', 'cutting-edge', 'state-of-the-art', 'groundbreaking',
  'transformative', 'revolutionize', 'revolutionizes', 'empower',
  'empowers', 'empowered', 'empowering', 'harness', 'harnesses',
  'harnessing', 'harnessed', 'proactive', 'proactively',
];

export const AI_PHRASES: string[] = [
  'it is worth noting that',
  'it should be mentioned that',
  'it is important to note that',
  'it is essential to note that',
  'it is crucial to understand',
  'in conclusion,',
  'to summarize,',
  'in summary,',
  'to sum up,',
  "in today's rapidly evolving",
  "in today's fast-paced",
  'in the ever-changing',
  'in the modern era',
  'it is undeniable that',
  'there is no denying that',
  'it goes without saying that',
  'needless to say,',
  'last but not least,',
  'in light of the above',
  'in light of the fact',
  'due to the fact that',
  'as previously mentioned',
  'as mentioned above',
  'as stated above',
  'plays a crucial role',
  'plays a pivotal role',
  'plays a key role',
  'is of paramount importance',
];

// Human-sounding alternatives for one-click swaps. Keys are lowercase; the
// replacement preserves the original capitalisation pattern (see applyCase).
export const WORD_ALTERNATIVES: Record<string, string> = {
  delve: 'look', 'delve into': 'explore', leverage: 'use', leveraging: 'using',
  leveraged: 'used', crucial: 'key', paramount: 'vital', multifaceted: 'complex',
  robust: 'strong', nuanced: 'subtle', furthermore: 'also', moreover: 'also',
  myriad: 'many', comprehensive: 'full', underscore: 'highlight',
  underscores: 'highlights', pivotal: 'central', seamlessly: 'smoothly',
  intricate: 'complex', holistic: 'whole', synergy: 'teamwork',
  foster: 'support', fosters: 'supports', facilitate: 'help',
  facilitates: 'helps', streamline: 'simplify', streamlines: 'simplifies',
  optimize: 'improve', optimizes: 'improves', innovative: 'new',
  'cutting-edge': 'advanced', 'state-of-the-art': 'advanced',
  groundbreaking: 'novel', transformative: 'major', revolutionize: 'transform',
  empower: 'enable', empowers: 'enables', harness: 'use', harnesses: 'uses',
  proactive: 'active', proactively: 'actively', navigating: 'handling',
};

export interface Occurrence {
  start: number;
  end: number;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Find every (case-insensitive) occurrence of `term` in `text`.
 * - `wholeWord`: term must be bounded by non-word chars (so "foster" doesn't
 *   match inside "fostering").
 * - `flexible`: any whitespace run in the term matches any whitespace run in the
 *   text (tolerates the editor's block separators vs. the model's quoting).
 */
export function findOccurrences(
  text: string,
  term: string,
  { wholeWord = false, flexible = false }: { wholeWord?: boolean; flexible?: boolean } = {},
): Occurrence[] {
  if (!term) return [];
  const body = flexible
    ? escapeRegExp(term.trim()).replace(/\\?\s+/g, '\\s+')
    : escapeRegExp(term);
  const pattern = wholeWord ? `(?<![\\w-])${body}(?![\\w-])` : body;
  const re = new RegExp(pattern, 'gi');
  const out: Occurrence[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length });
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width
  }
  return out;
}

/** Returns the human alternative for a matched word, preserving its case. */
export function alternativeFor(matched: string): string | null {
  const alt = WORD_ALTERNATIVES[matched.toLowerCase()];
  if (!alt) return null;
  return applyCase(matched, alt);
}

// Mirror common capitalisation: ALL CAPS, Title Case, or lowercase.
function applyCase(source: string, target: string): string {
  if (source === source.toUpperCase() && /[A-Z]/.test(source)) return target.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) return target.charAt(0).toUpperCase() + target.slice(1);
  return target;
}
