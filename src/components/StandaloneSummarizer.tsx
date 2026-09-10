import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { logAiFailure } from '@/lib/aiErrors';
import { AlignLeft, Copy, Check, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { callDecoderChat } from '@/lib/decoderChat';

// Matches the chat Edge Function's per-message cap (same limit as the other tools).
const MAX_CHARS = 4000;
const WARN_AT = 3200;

const SYSTEM_PROMPT = `You summarise a reading for a student who wants to revise quickly.

RULES:
- Output a concise plain-language summary: a few sentences up to one short paragraph. Never a full rewrite.
- Keep only the main claims, findings, and terms that matter for studying.
- Plain language, no jargon unless the original term is essential.
- NEVER use LaTeX notation. Write formulas in plain readable text (x^2, sqrt(2), H2SO4, a/b).
- No preamble ("Here is a summary"), no headings, no bullet padding, no motivational filler.`;

/**
 * Quick Summarizer — standalone, document-free, same shape as
 * StandaloneAnswerTool: textarea in, read-only markdown output with a copy
 * button out, routed through the existing chat Edge Function (no new function).
 */
const StandaloneSummarizer: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const charCount = input.length;
  const overLimit = charCount > MAX_CHARS;
  const approaching = charCount >= WARN_AT && !overLimit;

  const counterClass = useMemo(() => {
    if (overLimit) return 'text-destructive';
    if (approaching) return 'text-yellow-500';
    return 'text-muted-foreground';
  }, [overLimit, approaching]);

  const submit = async () => {
    const text = input.trim();
    if (!text) {
      toast.error('Paste the text you want summarised first');
      return;
    }
    if (text.length > MAX_CHARS) {
      toast.error(`Text exceeds ${MAX_CHARS.toLocaleString()} character limit`);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const reply = await callDecoderChat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ]);
      if (!reply.trim()) throw new Error('Empty response');
      setResult(reply.trim());
    } catch (err: any) {
      await logAiFailure('summarizer:tools', err);
      const msg = err?.message || 'Could not summarise';
      if (/rate limit|429/i.test(msg)) {
        toast.error('Rate limit reached — please wait a moment and try again');
      } else if (/402|credit/i.test(msg)) {
        toast.error('AI credits exhausted — please try again later');
      } else {
        toast.error('Could not summarise — try again');
      }
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success('Copied to clipboard');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <AlignLeft className="w-4 h-4 text-primary" />
          <h2 className="t-section">Quick Summary</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Paste a long reading or set of notes and get a short, plain-language summary.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── INPUT ── */}
        <div className="surface-card p-4 flex flex-col">
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Best for articles, chapters, and lecture notes you need the gist of.
          </p>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="summarizer-input" className="text-xs font-medium text-foreground">
              Your text
            </label>
            <span className={`text-[11px] tabular-nums ${counterClass}`}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <textarea
            id="summarizer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste the reading you want summarised…"
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
              Text is {(charCount - MAX_CHARS).toLocaleString()} characters over the limit — please shorten it.
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
                Summarising...
              </>
            ) : (
              <>
                <AlignLeft className="w-4 h-4 mr-1.5" />
                Summarise
              </>
            )}
          </Button>
        </div>

        {/* ── RESULT ── */}
        <div className="surface-card p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground">Summary</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copy}
              disabled={!result}
              aria-label="Copy summary to clipboard"
              className="h-7 px-2 text-[11px]"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Copy
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
              <span className="text-muted-foreground text-xs">Reading it through…</span>
            ) : result ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  skipHtml
                  disallowedElements={['script', 'style', 'iframe']}
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {result}
                </ReactMarkdown>
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">
                Your summary will appear here.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandaloneSummarizer;
