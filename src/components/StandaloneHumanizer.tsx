import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Wand2, Copy, Check, Loader2 } from 'lucide-react';

// Hard cap enforced by the humanizer Edge Function. Keep in lockstep with
// the server so we never round-trip a request that will bounce.
const MAX_CHARS = 25000;
const WARN_AT = 20000;

type Intensity = 'subtle' | 'moderate' | 'full';

const INTENSITY_OPTIONS: { key: Intensity; label: string; help: string }[] = [
  { key: 'subtle', label: 'Subtle', help: 'Light polish' },
  { key: 'moderate', label: 'Moderate', help: 'Balanced rewrite' },
  { key: 'full', label: 'Full', help: 'Deep rewrite' },
];

type WordCountMode = 'auto' | 'preset' | 'custom';
const PRESET_WORDS = [250, 500, 1000, 2000];

/**
 * Standalone humanizer surface for the Dashboard "Tools" tab.
 *
 * Deliberately independent of TipTap and any document context — the
 * Edge Function only needs `{ text, intensity, docType, targetWordCount }`.
 * We hardcode `docType: 'general'` because there is no document type to
 * infer from outside the editor.
 */
const StandaloneHumanizer: React.FC = () => {
  const [input, setInput] = useState('');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [wordCountMode, setWordCountMode] = useState<WordCountMode>('auto');
  const [presetWordCount, setPresetWordCount] = useState<number>(500);
  const [customWordCount, setCustomWordCount] = useState<string>('');
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
      toast.error('Paste or type some text first');
      return;
    }
    if (text.length > MAX_CHARS) {
      toast.error(`Text exceeds ${MAX_CHARS.toLocaleString()} character limit`);
      return;
    }

    const twc =
      wordCountMode === 'preset'
        ? presetWordCount
        : wordCountMode === 'custom'
          ? (parseInt(customWordCount) || null)
          : null;

    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('humanizer', {
        body: { text, intensity, docType: 'general', targetWordCount: twc },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.humanizedText);
    } catch (err: any) {
      const msg = err?.message || 'Humanizer failed';
      if (/rate limit|429/i.test(msg)) {
        toast.error('Rate limit reached — please wait a moment and try again');
      } else if (/402|credit/i.test(msg)) {
        toast.error('AI credits exhausted — please try again later');
      } else {
        toast.error(msg);
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
          <Wand2 className="w-4 h-4 text-primary" />
          <h2 className="t-section">Humanizer</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Paste any text below and rewrite it to sound more natural — no document needed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── INPUT ── */}
        <div className="surface-card p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="humanizer-input" className="text-xs font-medium text-foreground">
              Your text
            </label>
            <span className={`text-[11px] tabular-nums ${counterClass}`}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <textarea
            id="humanizer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste or type text here..."
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

          {/* Intensity */}
          <div className="mt-4">
            <p className="text-xs font-medium text-foreground mb-2">Intensity</p>
            <div className="grid grid-cols-3 gap-1.5">
              {INTENSITY_OPTIONS.map(({ key, label, help }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIntensity(key)}
                  aria-pressed={intensity === key}
                  title={help}
                  className={`focus-ring rounded-md px-2 py-2 text-xs font-medium transition-all ${
                    intensity === key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-secondary/60 border border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Target word count */}
          <div className="mt-4">
            <p className="text-xs font-medium text-foreground mb-2">Target length</p>
            <div className="flex gap-1.5 mb-2">
              {(['auto', 'preset', 'custom'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWordCountMode(m)}
                  aria-pressed={wordCountMode === m}
                  className={`focus-ring flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium capitalize transition-all ${
                    wordCountMode === m
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-secondary/60 border border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {wordCountMode === 'preset' && (
              <select
                value={presetWordCount}
                onChange={(e) => setPresetWordCount(parseInt(e.target.value))}
                className="w-full rounded-md border border-border bg-background p-1.5 text-xs text-foreground"
              >
                {PRESET_WORDS.map((n) => (
                  <option key={n} value={n}>{n} words</option>
                ))}
              </select>
            )}
            {wordCountMode === 'custom' && (
              <input
                type="number"
                inputMode="numeric"
                min={50}
                max={5000}
                value={customWordCount}
                onChange={(e) => setCustomWordCount(e.target.value)}
                placeholder="e.g. 750"
                className="w-full rounded-md border border-border bg-background p-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
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
                Humanizing...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-1.5" />
                Humanize
              </>
            )}
          </Button>
        </div>

        {/* ── RESULT ── */}
        <div className="surface-card p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground">Humanized result</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copy}
              disabled={!result}
              aria-label="Copy result to clipboard"
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
            className="min-h-[260px] flex-1 rounded-lg border border-border bg-background p-3 text-sm text-foreground whitespace-pre-wrap overflow-y-auto"
            aria-live="polite"
            aria-busy={loading}
          >
            {loading ? (
              <span className="text-muted-foreground text-xs">Rewriting your text…</span>
            ) : result ? (
              result
            ) : (
              <span className="text-muted-foreground text-xs">
                The humanized version will appear here.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandaloneHumanizer;
