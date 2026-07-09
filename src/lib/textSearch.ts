// Plain-text occurrence search used to re-locate model-quoted passages in the
// live document (humanizer accept flow). Extracted from the former AI-detection
// module when the detector was removed.

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
