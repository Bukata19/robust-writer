// The coach's inline tip bubble. Deliberately quiet: category icon, one line
// of advice, an optional "why" expander, and Accept / Skip. Streaks, counters,
// and charts live in the Coach panel — not in the writing surface.

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  X, Target, Zap, MessageSquare, Ruler, PenLine, Info, Check, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CoachTip } from '@/lib/coachMemory';
import type { PatternCategory } from '@/lib/coachPatterns';

const CATEGORY_ICON: Record<PatternCategory, LucideIcon> = {
  clarity: Target,
  conciseness: Zap,
  tone: MessageSquare,
  structure: Ruler,
  grammar: PenLine,
};

const AUTO_DISMISS_MS = 15_000;

interface Props {
  editor: Editor | null;
  tip: CoachTip | null;
  onAccept: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}

export default function InlineParagraphTip({ editor, tip, onAccept, onSkip, onDismiss }: Props) {
  const isMobile = useIsMobile();
  const [top, setTop] = useState<number | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  // Auto-dismiss if the writer never reacts.
  useEffect(() => {
    if (!tip) return;
    setWhyOpen(false);
    const t = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [tip, onDismiss]);

  // Track current paragraph position relative to scroll container.
  useEffect(() => {
    if (!editor || isMobile || !tip) return;

    const compute = () => {
      try {
        const { node: domNode } = editor.view.domAtPos(editor.state.selection.anchor);
        const el = (domNode instanceof HTMLElement ? domNode : domNode.parentElement) as HTMLElement | null;
        if (!el) return;
        const para = el.closest('p') as HTMLElement | null;
        const scrollContainer = el.closest('[data-editor-scroll]') as HTMLElement | null;
        if (!para || !scrollContainer) return;
        const paraRect = para.getBoundingClientRect();
        const contRect = scrollContainer.getBoundingClientRect();
        const offsetTop = paraRect.bottom - contRect.top + scrollContainer.scrollTop;
        setTop(offsetTop + 4);
      } catch {
        /* ignore */
      }
    };

    compute();
    editor.on('selectionUpdate', compute);
    editor.on('update', compute);
    return () => {
      editor.off('selectionUpdate', compute);
      editor.off('update', compute);
    };
  }, [editor, tip, isMobile]);

  if (!tip) return null;

  const Icon = CATEGORY_ICON[tip.category] ?? Target;

  const body = (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <Icon className="w-[14px] h-[14px] text-primary shrink-0" aria-hidden="true" />
        <span className="text-xs text-foreground/90 flex-1 leading-snug">{tip.text}</span>
        {tip.why && (
          <button
            onClick={() => setWhyOpen((v) => !v)}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0 focus-ring rounded"
            aria-label="Why this matters"
            aria-expanded={whyOpen}
            title="Why this matters"
          >
            <Info className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={onAccept}
          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors shrink-0 focus-ring rounded px-1"
          aria-label="Accept tip"
        >
          <Check className="w-3 h-3" />
          Accept
        </button>
        <button
          onClick={onSkip}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-ring rounded px-1"
          aria-label="Skip tip"
        >
          Skip
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-ring rounded"
          aria-label="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {whyOpen && (
        <div className="pl-6 pr-2 text-[11px] leading-snug text-muted-foreground">
          {tip.why}
          {tip.suggestion && (
            <span className="block mt-0.5 text-muted-foreground/80">{tip.suggestion}</span>
          )}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed left-2 right-2 bottom-[64px] z-40 bg-card/95 backdrop-blur-sm border border-primary/30 rounded-md shadow-lg px-2 py-1.5 flex items-center gap-2 animate-fade-in">
        {body}
      </div>
    );
  }

  if (top == null) return null;

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-20 max-w-[640px] w-[calc(100%-4rem)] bg-card/95 backdrop-blur-sm border border-primary/30 rounded-md shadow-md px-2 py-1.5 flex items-center gap-2 animate-fade-in pointer-events-auto"
      style={{ top }}
    >
      {body}
    </div>
  );
}
