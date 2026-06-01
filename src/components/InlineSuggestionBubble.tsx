import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Lightbulb, X, Loader2, Send, Clock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  editor: Editor | null;
  suggestion: string | null;
  loading: boolean;
  onDismiss: () => void;
  onSendToChat: (tip: string) => void;
  tipHistory: string[];
}

export default function InlineParagraphTip({
  editor,
  suggestion,
  loading,
  onDismiss,
  onSendToChat,
  tipHistory,
}: Props) {
  const isMobile = useIsMobile();
  const [top, setTop] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-dismiss after 12s
  useEffect(() => {
    if (!suggestion) return;
    const t = window.setTimeout(onDismiss, 12000);
    return () => window.clearTimeout(t);
  }, [suggestion, onDismiss]);

  // Track current paragraph position relative to scroll container
  useEffect(() => {
    if (!editor || isMobile) return;
    if (!suggestion && !loading) return;

    const compute = () => {
      try {
        const { node: domNode } = editor.view.domAtPos(editor.state.selection.anchor);
        const el = (domNode instanceof HTMLElement ? domNode : domNode.parentElement) as HTMLElement | null;
        if (!el) return;
        const para = el.closest('p') as HTMLElement | null;
        const scrollContainer = el.closest('[data-editor-scroll]') as HTMLElement | null;
        if (!para || !scrollContainer) return;
        containerRef.current = scrollContainer;
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
  }, [editor, suggestion, loading, isMobile]);

  if (!suggestion && !loading) return null;

  const tipContent = (
    <>
      {loading && !suggestion ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
          <span className="text-xs text-muted-foreground italic flex-1">Coach thinking…</span>
        </>
      ) : (
        <>
          <Lightbulb className="w-[14px] h-[14px] text-primary shrink-0" />
          <span className="text-xs text-muted-foreground italic flex-1 leading-snug">{suggestion}</span>
          <button
            onClick={() => suggestion && onSendToChat(suggestion)}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
            aria-label="Send to chat"
            title="Send to chat"
          >
            <Send className="w-3 h-3" />
          </button>
          {tipHistory.length > 0 && (
            <div className="relative shrink-0">
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Previous tips"
                title="Previous tips"
              >
                <Clock className="w-3 h-3" />
              </button>
              {historyOpen && (
                <div className="absolute right-0 bottom-full mb-1 w-64 max-w-[80vw] bg-card border border-border rounded-md shadow-lg p-1 z-50">
                  {tipHistory.slice().reverse().map((t, i) => (
                    <div key={i} className="px-2 py-1 text-xs text-muted-foreground italic border-b border-border/40 last:border-b-0">
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed left-2 right-2 bottom-[64px] z-40 bg-card/95 backdrop-blur-sm border border-primary/30 rounded-md shadow-lg px-2 py-1.5 flex items-center gap-2 animate-fade-in">
        {tipContent}
      </div>
    );
  }

  if (top == null) return null;

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-20 max-w-[640px] w-[calc(100%-4rem)] bg-card/95 backdrop-blur-sm border border-primary/30 rounded-md shadow-md px-2 py-1.5 flex items-center gap-2 animate-fade-in pointer-events-auto"
      style={{ top }}
    >
      {tipContent}
    </div>
  );
}
