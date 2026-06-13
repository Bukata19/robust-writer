import type { Node as PMNode } from '@tiptap/pm/model';

// Maps a flat-text offset range onto ProseMirror document positions.
//
// The fragile part of the old highlighter was matching the model's excerpt
// against editor.getText() and then guessing positions with a separately-built
// offset map — the two could drift. Here we build the searchable flat text and
// its position map in the SAME walk, so any offset found in `text` maps exactly.

export interface PosMapEntry {
  textStart: number;
  textEnd: number;
  nodePos: number;
}

export interface FlatText {
  text: string;
  posMap: PosMapEntry[];
}

const BLOCK_SEP = '\n';

/**
 * Walk the doc once, concatenating text-node contents and inserting a single
 * separator between blocks. Returns the flat text plus a map from text offsets
 * to ProseMirror node positions.
 */
export function buildFlatText(doc: PMNode): FlatText {
  let offset = 0;
  let text = '';
  const posMap: PosMapEntry[] = [];

  doc.descendants((node, nodePos) => {
    if (node.isText) {
      const len = node.text?.length ?? 0;
      posMap.push({ textStart: offset, textEnd: offset + len, nodePos });
      text += node.text ?? '';
      offset += len;
    } else if (node.isBlock && offset > 0) {
      text += BLOCK_SEP;
      offset += BLOCK_SEP.length;
    }
    return true;
  });

  return { text, posMap };
}

/**
 * Convert a [start, end) range in the flat text into ProseMirror {from, to}.
 * Returns null if the range can't be resolved.
 */
export function mapTextRange(posMap: PosMapEntry[], start: number, end: number): { from: number; to: number } | null {
  let from: number | null = null;
  let to: number | null = null;

  for (const entry of posMap) {
    if (from === null && start >= entry.textStart && start < entry.textEnd) {
      from = entry.nodePos + (start - entry.textStart);
    }
    if (end > entry.textStart && end <= entry.textEnd) {
      to = entry.nodePos + (end - entry.textStart);
    }
  }

  if (from === null || to === null || from >= to) return null;
  return { from, to };
}
