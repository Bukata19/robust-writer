import type { Editor } from '@tiptap/react';
import { buildFlatText, mapTextRange } from './editorPositions';
import { AI_WORDS, AI_PHRASES, findOccurrences, alternativeFor } from './aiDetection';
import type { AiHighlightTarget } from '@/extensions/ai-highlight';

export type HighlightCategory = 'word' | 'phrase' | 'passage' | 'structure';

export interface HighlightMeta {
  id: string;
  category: HighlightCategory;
  severity: 'low' | 'medium' | 'high';
  label: string;
  reason: string;
  suggestion?: string;
  confidence?: number;
  text: string;
  swapText?: string; // present for word swaps
  from: number;
  to: number;
}

export interface HighlightFilters {
  word: boolean;
  phrase: boolean;
  passage: boolean;
  structure: boolean;
}

export const DEFAULT_FILTERS: HighlightFilters = {
  word: true,
  phrase: true,
  passage: true,
  structure: true,
};

// Concern types (from the backend) that are structural rather than passage-level.
const STRUCTURE_CONCERNS = new Set([
  'low_burstiness',
  'high_transition_density',
  'formulaic_structure',
  'coherence_uniformity',
]);

interface FlaggedPassage {
  excerpt: string;
  concern_type: string;
  reason: string;
  severity: string;
  confidence?: number;
  suggestion?: string;
}

const CATEGORY_CLASS: Record<HighlightCategory, string> = {
  word: 'ai-hl ai-hl-word',
  phrase: 'ai-hl ai-hl-phrase',
  passage: 'ai-hl ai-hl-passage',
  structure: 'ai-hl ai-hl-structure',
};

const within = (ranges: Array<{ from: number; to: number }>, from: number, to: number) =>
  ranges.some((r) => from >= r.from && to <= r.to);

export interface ComputeResult {
  targets: AiHighlightTarget[];
  metaById: Record<string, HighlightMeta>;
  counts: Record<HighlightCategory, number>;
}

/**
 * Build decoration targets + popover metadata from the live deterministic
 * lexicon and (optionally) the model's flagged passages. Word/phrase highlights
 * inside a flagged passage are skipped to avoid stacked backgrounds.
 */
export function computeAiHighlights(
  editor: Editor,
  flaggedPassages: FlaggedPassage[] | undefined,
  filters: HighlightFilters,
): ComputeResult {
  const { text, posMap } = buildFlatText(editor.state.doc);
  const targets: AiHighlightTarget[] = [];
  const metaById: Record<string, HighlightMeta> = {};
  const counts: Record<HighlightCategory, number> = { word: 0, phrase: 0, passage: 0, structure: 0 };

  const passageRanges: Array<{ from: number; to: number }> = [];

  const push = (
    category: HighlightCategory,
    range: { from: number; to: number },
    meta: Omit<HighlightMeta, 'id' | 'category' | 'from' | 'to'>,
  ) => {
    const id = `${category[0]}${targets.length}`;
    const className =
      category === 'passage'
        ? `${CATEGORY_CLASS.passage} ai-hl-passage-${meta.severity === 'high' ? 'high' : 'medium'}`
        : CATEGORY_CLASS[category];
    targets.push({ from: range.from, to: range.to, className, id });
    metaById[id] = { id, category, from: range.from, to: range.to, ...meta };
    counts[category] += 1;
  };

  // 1) Flagged passages first (so words/phrases inside them can be skipped).
  if (flaggedPassages) {
    for (const p of flaggedPassages) {
      const category: HighlightCategory = STRUCTURE_CONCERNS.has(p.concern_type) ? 'structure' : 'passage';
      if (!filters[category]) continue;
      const severity = (p.severity === 'high' ? 'high' : p.severity === 'low' ? 'low' : 'medium') as HighlightMeta['severity'];
      for (const occ of findOccurrences(text, p.excerpt, { flexible: true })) {
        const range = mapTextRange(posMap, occ.start, occ.end);
        if (!range) continue;
        passageRanges.push(range);
        push(category, range, {
          severity,
          label: p.concern_type.replace(/_/g, ' '),
          reason: p.reason,
          suggestion: p.suggestion,
          confidence: p.confidence,
          text: p.excerpt,
        });
      }
    }
  }

  // 2) Deterministic AI phrases.
  if (filters.phrase) {
    for (const phrase of AI_PHRASES) {
      for (const occ of findOccurrences(text, phrase, { flexible: true })) {
        const range = mapTextRange(posMap, occ.start, occ.end);
        if (!range || within(passageRanges, range.from, range.to)) continue;
        push('phrase', range, {
          severity: 'medium',
          label: 'AI phrase',
          reason: `“${text.slice(occ.start, occ.end)}” is a formulaic phrase common in AI writing.`,
          text: text.slice(occ.start, occ.end),
        });
      }
    }
  }

  // 3) Deterministic AI signature words.
  if (filters.word) {
    for (const word of AI_WORDS) {
      for (const occ of findOccurrences(text, word, { wholeWord: true })) {
        const range = mapTextRange(posMap, occ.start, occ.end);
        if (!range || within(passageRanges, range.from, range.to)) continue;
        const matched = text.slice(occ.start, occ.end);
        const swap = alternativeFor(matched);
        push('word', range, {
          severity: 'low',
          label: 'AI-favoured word',
          reason: `“${matched}” is over-represented in AI-generated text.`,
          suggestion: swap ? `Try “${swap}” instead.` : undefined,
          swapText: swap ?? undefined,
          text: matched,
        });
      }
    }
  }

  return { targets, metaById, counts };
}
