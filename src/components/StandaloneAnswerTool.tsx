import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BookOpenCheck, Copy, Check, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { callDecoderChat, buildAnswerSystemPrompt, type AnswerLevel } from '@/lib/decoderChat';
import { supabase } from '@/integrations/supabase/client';

// Matches the chat Edge Function's per-message cap.
const MAX_CHARS = 4000;
const WARN_AT = 3200;

const LEVELS: { key: NonNullable<AnswerLevel>; label: string }[] = [
  { key: 'high_school', label: 'High School' },
  { key: 'undergraduate', label: 'Undergraduate' },
  { key: 'postgraduate', label: 'Postgraduate' },
];

/**
 * Standalone Assignment Decoder — Direct Answer path only.
 *
 * Deliberately document-free, exactly like StandaloneHumanizer: paste a
 * problem-based question in, get a worked step-by-step answer out, copy it.
 * The system prompt is the SHARED Answer Mode prompt from `@/lib/decoderChat`
 * (no third copy of that logic) and the request goes through the same
 * decoder-tuned model preset as the in-editor Answer Mode.
 */
const StandaloneAnswerTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [level, setLevel] = useState<AnswerLevel>(null);
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
    const question = input.trim();
    if (!question) {
      toast.error('Paste or type a question first');
      return;
    }
    if (question.length > MAX_CHARS) {
      toast.error(`Question exceeds ${MAX_CHARS.toLocaleString()} character limit`);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      // Field of study, when the profile has one, so notation and conventions match.
      let field: string | null = null;
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes?.user?.id;
        if (uid) {
          const { data } = await supabase
            .from('profiles')
            .select('field_of_study')
            .eq('user_id', uid)
            .maybeSingle();
          const f = (data?.field_of_study ?? '').trim();
          field = f && f.toLowerCase() !== 'other' ? f : null;
        }
      } catch { /* ignore — field is optional */ }

      const system = buildAnswerSystemPrompt({ question, academicLevel: level, field });
      const reply = await callDecoderChat([
        { role: 'system', content: system },
        { role: 'user', content: question },
      ]);
      if (!reply.trim()) throw new Error('Empty response');
      setResult(reply.trim());
    } catch (err: any) {
      const msg = err?.message || 'Could not get an answer';
      if (/rate limit|429/i.test(msg)) {
        toast.error('Rate limit reached — please wait a moment and try again');
      } else if (/402|credit/i.test(msg)) {
        toast.error('AI credits exhausted — please try again later');
      } else {
        toast.error('Could not get an answer — try again');
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
          <BookOpenCheck className="w-4 h-4 text-primary" />
          <h2 className="t-section">Answer a Question</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Paste a problem-based question and get a worked, step-by-step answer — no document needed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── INPUT ── */}
        <div className="surface-card p-4 flex flex-col">
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Works for maths, physics, chemistry, engineering, or any solve/calculate/derive question.
            You can paste several sub-questions at once (e.g. 1a, 1b, 2).
          </p>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="answer-input" className="text-xs font-medium text-foreground">
              Your question
            </label>
            <span className={`text-[11px] tabular-nums ${counterClass}`}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <textarea
            id="answer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. A ball is thrown vertically upward at 20 m/s. Calculate the maximum height reached."
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
              Question is {(charCount - MAX_CHARS).toLocaleString()} characters over the limit — please shorten it.
            </p>
          )}

          {/* Academic level — same picker treatment as the Humanizer's Intensity */}
          <div className="mt-4">
            <p className="text-xs font-medium text-foreground mb-2">Academic level</p>
            <div className="grid grid-cols-3 gap-1.5">
              {LEVELS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLevel(level === key ? null : key)}
                  aria-pressed={level === key}
                  className={`rounded-md border px-2 py-1.5 text-[11px] transition-colors duration-200 motion-reduce:transition-none ${
                    level === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={loading || overLimit || input.trim().length === 0}
            className="mt-4 w-full btn-glow"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin motion-reduce:animate-none" />
                Solving...
              </>
            ) : (
              <>
                <BookOpenCheck className="w-4 h-4 mr-1.5" />
                Get Answer
              </>
            )}
          </Button>
        </div>

        {/* ── RESULT ── */}
        <div className="surface-card p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground">Worked answer</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copy}
              disabled={!result}
              aria-label="Copy answer to clipboard"
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
              <span className="text-muted-foreground text-xs">Working through it…</span>
            ) : result ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown skipHtml disallowedElements={['script', 'style', 'iframe']}>
                  {result}
                </ReactMarkdown>
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">
                Your step-by-step answer will appear here.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandaloneAnswerTool;
