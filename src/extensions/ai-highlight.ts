import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// A highlight *target*: a resolved document range plus presentation/metadata.
export interface AiHighlightTarget {
  from: number;
  to: number;
  className: string;
  id: string;
}

export type AiHighlightOptions = Record<string, never>;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiHighlight: {
      /** Replace all AI highlight decorations with the given targets. */
      setAiHighlights: (targets: AiHighlightTarget[]) => ReturnType;
      /** Remove all AI highlight decorations. */
      clearAiHighlights: () => ReturnType;
    };
  }
}

const aiHighlightKey = new PluginKey<DecorationSet>('aiHighlight');

const META = 'aiHighlight:set';

/**
 * Renders AI-detection highlights as ProseMirror Decorations — an ephemeral
 * overlay that is NOT part of the document. So highlights never get saved by
 * getJSON(), never enter undo history, and can be toggled/cleared instantly.
 */
const AiHighlight = Extension.create<AiHighlightOptions>({
  name: 'aiHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: aiHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const targets = tr.getMeta(META) as AiHighlightTarget[] | undefined;
            if (targets) {
              const decos = targets
                .filter((t) => t.from < t.to)
                .map((t) =>
                  Decoration.inline(t.from, t.to, {
                    class: t.className,
                    'data-ai-id': t.id,
                  }),
                );
              return DecorationSet.create(tr.doc, decos);
            }
            // No new targets: keep existing decorations, mapped through edits.
            return tr.docChanged ? old.map(tr.mapping, tr.doc) : old;
          },
        },
        props: {
          decorations(state) {
            return aiHighlightKey.getState(state);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setAiHighlights:
        (targets) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(META, targets));
          return true;
        },
      clearAiHighlights:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(META, []));
          return true;
        },
    };
  },
});

export default AiHighlight;
