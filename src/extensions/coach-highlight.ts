// Coach highlight: decoration-only (never touches document content) marking of
// the text the currently-active Writing Coach tip refers to. Ranges are set
// imperatively via a transaction meta; they map through edits and are cleared
// whenever the tip is resolved.

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface DocRange {
  from: number;
  to: number;
}

export const coachHighlightKey = new PluginKey<DecorationSet>('coachHighlight');

const META = 'coachHighlight:set';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    coachHighlight: {
      setCoachHighlights: (ranges: DocRange[]) => ReturnType;
      clearCoachHighlights: () => ReturnType;
    };
  }
}

export const CoachHighlight = Extension.create({
  name: 'coachHighlight',

  addCommands() {
    return {
      setCoachHighlights:
        (ranges: DocRange[]) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(META, ranges));
          return true;
        },
      clearCoachHighlights:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(META, []));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: coachHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(META) as DocRange[] | undefined;
            if (meta) {
              const decos = meta
                .filter((r) => r.from < r.to && r.to <= tr.doc.content.size)
                .map((r) => Decoration.inline(r.from, r.to, { class: 'coach-highlight' }));
              return DecorationSet.create(tr.doc, decos);
            }
            return tr.docChanged ? old.map(tr.mapping, tr.doc) : old;
          },
        },
        props: {
          decorations(state) {
            return coachHighlightKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export default CoachHighlight;
