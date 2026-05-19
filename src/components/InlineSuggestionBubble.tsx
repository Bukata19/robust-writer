import { useEffect } from 'react';
import { Sparkles, X, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  suggestion: string | null;
  onDismiss: () => void;
  onSendToChat: (tip: string) => void;
  loading: boolean;
}

export default function InlineSuggestionBubble({ suggestion, onDismiss, onSendToChat, loading }: Props) {
  useEffect(() => {
    if (!suggestion) return;
    const t = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(t);
  }, [suggestion, onDismiss]);

  if (!suggestion && !loading) return null;

  if (loading && !suggestion) {
    return (
      <div className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur border border-border text-xs text-muted-foreground animate-fade-in">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Coach thinking…</span>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 max-w-[320px] bg-card border border-primary/30 shadow-lg rounded-xl p-3 animate-fade-in"
    >
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground flex-1 leading-snug">{suggestion}</p>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex justify-end mt-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            if (suggestion) onSendToChat(suggestion);
            onDismiss();
          }}
        >
          <Send className="w-3 h-3 mr-1" /> Send to Chat
        </Button>
      </div>
    </div>
  );
}
