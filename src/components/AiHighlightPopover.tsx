import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Wand2, RefreshCw, X } from 'lucide-react';
import type { HighlightMeta, HighlightCategory } from '@/lib/aiHighlightCompute';

interface AiHighlightPopoverProps {
  meta: HighlightMeta | null;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onSwap: (meta: HighlightMeta) => void;
  onHumanize: (meta: HighlightMeta) => void;
}

const CATEGORY_LABEL: Record<HighlightCategory, string> = {
  word: 'AI word',
  phrase: 'AI phrase',
  passage: 'AI passage',
  structure: 'Structure signal',
};

const CATEGORY_DOT: Record<HighlightCategory, string> = {
  word: 'bg-amber-400',
  phrase: 'bg-violet-400',
  passage: 'bg-red-400',
  structure: 'bg-sky-400',
};

const WIDTH = 288;

/**
 * Floating card anchored to a clicked AI highlight. Shows why the text was
 * flagged and offers in-place fixes (swap a word / humanize a passage).
 */
const AiHighlightPopover: React.FC<AiHighlightPopoverProps> = ({
  meta, anchorRect, onClose, onSwap, onHumanize,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position below the highlight, flipping above if there's no room; clamp to viewport.
  useLayoutEffect(() => {
    if (!anchorRect) return;
    const margin = 8;
    const height = ref.current?.offsetHeight ?? 160;
    let top = anchorRect.bottom + 6;
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, anchorRect.top - height - 6);
    }
    let left = anchorRect.left;
    left = Math.min(left, window.innerWidth - WIDTH - margin);
    left = Math.max(margin, left);
    setPos({ top, left });
  }, [anchorRect, meta]);

  // Dismiss on outside click or Escape.
  useEffect(() => {
    if (!meta) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [meta, onClose]);

  if (!meta || !anchorRect) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: WIDTH }}
      className="z-[100] rounded-lg border border-border bg-card p-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)] animate-fade-in"
      role="dialog"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          <span className={`w-2 h-2 rounded-full ${CATEGORY_DOT[meta.category]}`} />
          {CATEGORY_LABEL[meta.category]}
          {typeof meta.confidence === 'number' && (
            <span className="text-muted-foreground">· {meta.confidence}% conf.</span>
          )}
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{meta.reason}</p>

      {meta.suggestion && meta.category !== 'word' && (
        <p className="text-xs text-foreground bg-primary/5 border border-primary/10 rounded px-2 py-1.5 mb-2">
          {meta.suggestion}
        </p>
      )}

      <div className="flex gap-2">
        {meta.swapText && (
          <button
            onClick={() => onSwap(meta)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium py-1.5 hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Use “{meta.swapText}”
          </button>
        )}
        {(meta.category === 'passage' || meta.category === 'structure') && (
          <button
            onClick={() => onHumanize(meta)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium py-1.5 text-foreground hover:bg-secondary transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5" /> Humanize
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default AiHighlightPopover;
