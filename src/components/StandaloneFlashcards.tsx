import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { logAiFailure } from '@/lib/aiErrors';
import { Layers, Copy, Check, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { callDecoderChat } from '@/lib/decoderChat';

// Matches the chat Edge Function's per-message cap (same limit as the other tools).
const MAX_CHARS = 4000;
const WARN_AT = 3200;

const SYSTEM_PROMPT = `You turn a student's study notes into revision flashcards.

RULES:
- Produce between 5 and 15 flashcards, covering only the key points actually present in the notes.
- Output format is STRICT and nothing else — no preamble, no numbering, no headings:
Q: <question>
A: <answer>

(blank line between cards)
- Questions must be answerable from the notes. Answers are 1-3 sentences, plain and factual.
- NEVER use LaTeX notation. Write formulas in plain readable text (x^2, sqrt(2), H2SO4, a/b).
- Do not add motivational filler or commentary.`;

interface Card {
  q: string;
  a: string;
}

/** Parses the strict `Q:` / `A:` output into card pairs. */
function parseCards(raw: string): Card[] {
  const cards: Card[] = [];
  let current: Card | null = null;
  for (const line of raw.split('\n')) {
    const t = line.trim();
    const qm = /^(?:\*\*)?Q(?:uestion)?(?:\*\*)?\s*[:.]\s*(.+)$/i.exec(t);
    const am = /^(?:\*\*)?A(?:nswer)?(?:\*\*)?\s*[:.]\s*(.+)$/i.exec(t);
    if (qm) {
      if (current) cards.push(current);
      current = { q: qm[1].trim(), a: '' };
    } else if (am && current) {
      current.a = am[1].trim();
    } else if (t && current && current.a) {
      current.a += ` ${t}`;
    }
  }
  if (current) cards.push(current);
  return cards.filter((c) => c.q && c.a);
}

const md = (text: string) => (
  <div className="prose prose-sm dark:prose-invert max-w-none">
    <ReactMarkdown
      skipHtml
      disallowedElements={['script', 'style', 'iframe']}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {text}
    </ReactMarkdown>
  </div>
);

/**
 * Flashcard Generator — standalone, document-free, same shape as
 * StandaloneAnswerTool: textarea in, read-only output with copy buttons out,
 * routed through the existing chat Edge Function (no new function).
 */
const StandaloneFlashcards: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const charCount = input.length;
  const overLimit = charCount > MAX_CHARS;
  const approaching = charCount >= WARN_AT && !overLimit;

  const counterClass = useMemo(() => {
    if (overLimit) return 'text-destructive';
    if (approaching) return 'text-yellow-500';
    return 'text-muted-foreground';
  }, [overLimit, approaching]);

  const cards = useMemo(() => (result ? parseCards(result) : []), [result]);

  const submit = async () => {
    const notes = input.trim();
    if (!notes) {
      toast.error('Paste your study notes first');
      return;
    }
    if (notes.length > MAX_CHARS) {
      toast.error(`Notes exceed ${MAX_CHARS.toLocaleString()} character limit`);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const reply = await callDecoderChat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: notes },
      ]);
      if (!reply.trim()) throw new Error('Empty response');
      setResult(reply.trim());
    } catch (err: any) {
      await logAiFailure('flashcards:tools', err);
      const msg = err?.message || 'Could not make flashcards';
      if (/rate limit|429/i.test(msg)) {
        toast.error('Rate limit reached — please wait a moment and try again');
      } else if (/402|credit/i.test(msg)) {
        toast.error('AI credits exhausted — please try again later');
      } else {
        toast.error('Could not make flashcards — try again');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text: string, onDone: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  const copyAll = () => {
    const text = cards.length
      ? cards.map((c) => `Q: ${c.q}\nA: ${c.a}`).join('\n\n')
      : result ?? '';
    if (!text) return;
    copyText(text, () => {
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1500);
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <Layers className="w-4 h-4 text-primary" />
          <h2 className="t-section">Flashcards</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Paste your study notes and get question-and-answer flashcards for quick revision.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── INPUT ── */}
        <div className="surface-card p-4 flex flex-col">
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Works with lecture notes, textbook sections, or your own summaries.
          </p>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="flashcard-input" className="text-xs font-medium text-foreground">
              Your notes
            </label>
            <span className={`text-[11px] tabular-nums ${counterClass}`}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <textarea
            id="flashcard-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste the notes you want to revise…"
            spellCheck
            className="min-h-[260px] w-full flex-1 resize-y rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {approaching && (
            <p className="mt-2 text-[11px] text-yellow-500">
              Approaching the {MAX_CHARS.toLocaleString()}-character limit.
            </p>
          )}
          {overLimit && (
            <p className="mt-2 text-[11px] text-destructive">
              Notes are {(charCount - MAX_CHARS).toLocaleString()} characters over the limit — please shorten them.
            </p>
          )}

          <Button
            onClick={submit}
            disabled={loading || overLimit || input.trim().length === 0}
            className="mt-4 w-full btn-glow"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin motion-reduce:animate-none" />
                Making cards...
              </>
            ) : (
              <>
                <Layers className="w-4 h-4 mr-1.5" />
                Make Flashcards
              </>
            )}
          </Button>
        </div>

        {/* ── RESULT ── */}
        <div className="surface-card p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground">
              Flashcards{cards.length ? ` (${cards.length})` : ''}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copyAll}
              disabled={!result}
              aria-label="Copy all flashcards to clipboard"
              className="h-7 px-2 text-[11px]"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Copy all
                </>
              )}
            </Button>
          </div>
          <div
            className="min-h-[260px] flex-1 rounded-lg border border-border bg-background p-3 text-sm text-foreground overflow-y-auto"
            aria-live="polite"
            aria-busy={loading}
          >
            {loading ? (
              <span className="text-muted-foreground text-xs">Reading your notes…</span>
            ) : cards.length ? (
              <ul className="space-y-3">
                {cards.map((card, i) => (
                  <li key={i} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">
                          Question {i + 1}
                        </p>
                        {md(card.q)}
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-2 mb-1">
                          Answer
                        </p>
                        {md(card.a)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label={`Copy flashcard ${i + 1}`}
                        onClick={() =>
                          copyText(`Q: ${card.q}\nA: ${card.a}`, () => {
                            setCopiedIdx(i);
                            window.setTimeout(() => setCopiedIdx(null), 1500);
                          })
                        }
                      >
                        {copiedIdx === i ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : result ? (
              md(result)
            ) : (
              <span className="text-muted-foreground text-xs">
                Your flashcards will appear here.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandaloneFlashcards;
