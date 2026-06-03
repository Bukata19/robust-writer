import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  X,
  Wand2,
  ScanText,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface PolishPanelProps {
  editor: Editor | null;
  onClose: () => void;
}

type IssueType =
  | 'passive_voice'
  | 'wordy_phrase'
  | 'complex_sentence'
  | 'ambiguous_phrasing'
  | 'weak_opener';

interface ClarityIssue {
  flagged: string;
  type: IssueType;
  suggestion: string;
}

interface ClarityResult {
  score: number;
  summary: string;
  issues: ClarityIssue[];
}

interface Alternative {
  label: string;
  text: string;
  wordCount: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const ISSUE_LABELS: Record<IssueType, string> = {
  passive_voice: 'Passive Voice',
  wordy_phrase: 'Wordy Phrase',
  complex_sentence: 'Complex Sentence',
  ambiguous_phrasing: 'Ambiguous Phrasing',
  weak_opener: 'Weak Opener',
};

async function callChatJson(systemPrompt: string, userContent: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!resp.ok) throw new Error('AI request failed');
  const reader = resp.body?.getReader();
  if (!reader) throw new Error('No stream');
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      try {
        const parsed = JSON.parse(line.slice(6));
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) result += content;
      } catch { /* skip */ }
    }
  }
  return result;
}

function extractJson(raw: string): string {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  return trimmed;
}

const scoreColor = (score: number) => {
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
  if (score >= 50) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
  return 'bg-red-500/20 text-red-400 border-red-500/40';
};

const IssueCard: React.FC<{
  issue: ClarityIssue;
  onFix: (issue: ClarityIssue) => void;
}> = ({ issue, onFix }) => {
  const [expanded, setExpanded] = useState(false);
  const showExpand = issue.flagged.length > 80;
  const shown = expanded || !showExpand ? issue.flagged : issue.flagged.slice(0, 80) + '…';

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="outline" className="text-[10px] shrink-0">{ISSUE_LABELS[issue.type]}</Badge>
      </div>
      <p className="text-xs text-foreground leading-relaxed">
        "{shown}"
        {showExpand && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="ml-1 text-primary inline-flex items-center gap-0.5"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </p>
      <p className="text-xs italic text-muted-foreground leading-relaxed">→ {issue.suggestion}</p>
      <Button size="sm" variant="outline" onClick={() => onFix(issue)} className="w-full h-7 text-xs">
        Fix
      </Button>
    </div>
  );
};

const PolishPanel: React.FC<PolishPanelProps> = ({ editor, onClose }) => {
  // Clarity state
  const [analysing, setAnalysing] = useState(false);
  const [clarityResult, setClarityResult] = useState<ClarityResult | null>(null);

  // Rewrite state
  const [generating, setGenerating] = useState(false);
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<{ text: string; from: number; to: number } | null>(null);

  const getSelection = useCallback(() => {
    if (!editor) return null;
    const { from, to } = editor.state.selection;
    if (from === to) return null;
    const text = editor.state.doc.textBetween(from, to, ' ').trim();
    if (!text) return null;
    return { text, from, to };
  }, [editor]);

  const analyseDocument = async () => {
    if (!editor) return;
    const text = editor.getText().trim();
    if (!text) {
      toast.error('Document is empty');
      return;
    }
    setAnalysing(true);
    setClarityResult(null);
    try {
      const raw = await callChatJson(
        "You are a clarity editor. Analyse this academic document and return a JSON object with this exact structure: { score: number (0-100), summary: string (one sentence), issues: [{ flagged: string, type: 'passive_voice'|'wordy_phrase'|'complex_sentence'|'ambiguous_phrasing'|'weak_opener', suggestion: string }] }. Return 5-10 issues maximum. Return ONLY valid JSON, no other text.",
        text.slice(0, 12000),
      );
      const parsed = JSON.parse(extractJson(raw)) as ClarityResult;
      if (typeof parsed.score !== 'number' || !Array.isArray(parsed.issues)) throw new Error('bad shape');
      setClarityResult(parsed);
    } catch {
      toast.error('Analysis failed — try again');
    } finally {
      setAnalysing(false);
    }
  };

  const fixIssue = (issue: ClarityIssue) => {
    if (!editor) return;
    const docText = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ');
    const idx = docText.indexOf(issue.flagged);
    if (idx === -1) {
      toast.error('Could not locate the phrase in the document');
      return;
    }
    // Map plain-text index to doc position by walking the doc
    let posStart = -1;
    let posEnd = -1;
    let acc = 0;
    editor.state.doc.descendants((node, pos) => {
      if (posStart !== -1 && posEnd !== -1) return false;
      if (node.isText) {
        const t = node.text || '';
        const localStart = idx - acc;
        if (posStart === -1 && localStart >= 0 && localStart <= t.length) {
          posStart = pos + localStart;
          const remaining = issue.flagged.length - (t.length - localStart);
          if (remaining <= 0) {
            posEnd = posStart + issue.flagged.length;
          }
        }
        acc += t.length;
        if (posStart !== -1 && posEnd === -1 && acc >= idx + issue.flagged.length) {
          posEnd = pos + (idx + issue.flagged.length - (acc - t.length));
        }
      } else if (node.isBlock && acc > 0) {
        // block separator counts as 1 in textBetween with ' '
        acc += 1;
      }
      return true;
    });
    if (posStart === -1 || posEnd === -1) {
      // Fallback: simple replace via insertContent at selection of found text
      toast.error('Could not locate the phrase in the document');
      return;
    }
    editor.chain().focus().insertContentAt({ from: posStart, to: posEnd }, issue.suggestion).run();
    toast.success('Fix applied');
    setClarityResult(prev =>
      prev ? { ...prev, issues: prev.issues.filter(i => i !== issue) } : prev,
    );
  };

  const getAlternatives = async () => {
    const sel = getSelection();
    if (!sel) {
      toast.error('Select some text first');
      return;
    }
    setSelectionInfo(sel);
    setGenerating(true);
    setAlternatives(null);
    try {
      const raw = await callChatJson(
        "You are a writing editor. Rewrite the following text in exactly 3 different ways. Return a JSON array of exactly 3 objects: [{ label: 'Shorter & Clearer', text: string, wordCount: number }, { label: 'More Authoritative', text: string, wordCount: number }, { label: 'More Engaging', text: string, wordCount: number }]. Preserve the core meaning exactly. Return ONLY valid JSON, no other text.",
        sel.text,
      );
      const parsed = JSON.parse(extractJson(raw)) as Alternative[];
      if (!Array.isArray(parsed) || parsed.length !== 3) throw new Error('bad shape');
      setAlternatives(parsed);
    } catch {
      toast.error('Rewrite failed — try again');
    } finally {
      setGenerating(false);
    }
  };

  const insertAlternative = (alt: Alternative) => {
    if (!editor || !selectionInfo) return;
    editor.chain().focus().insertContentAt({ from: selectionInfo.from, to: selectionInfo.to }, alt.text).run();
    toast.success('Inserted');
    setAlternatives(null);
    setSelectionInfo(null);
  };

  const originalWordCount = selectionInfo ? selectionInfo.text.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Writing Polish</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue="clarity" className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="grid grid-cols-2 mx-3 mt-3 shrink-0">
          <TabsTrigger value="clarity" className="text-xs">
            <ScanText className="w-3.5 h-3.5 mr-1" /> Clarity
          </TabsTrigger>
          <TabsTrigger value="rewrite" className="text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rewrite
          </TabsTrigger>
        </TabsList>

        {/* Clarity Tab */}
        <TabsContent value="clarity" className="flex-1 overflow-hidden mt-2 data-[state=inactive]:hidden">
          <div className="flex flex-col h-full">
            <div className="px-3 pb-2 flex items-center gap-2 shrink-0">
              <ScanText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Clarity Check</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 scrollbar-dark">
              <Button onClick={analyseDocument} disabled={analysing} className="w-full btn-glow">
                <Sparkles className="w-4 h-4 mr-1.5" />
                Analyse Document
              </Button>

              {analysing && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground text-center">Scanning your writing…</p>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              )}

              {clarityResult && !analysing && (
                <>
                  <div className={`rounded-lg border px-3 py-2 ${scoreColor(clarityResult.score)}`}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs uppercase tracking-wide opacity-80">Clarity Score</span>
                      <span className="text-2xl font-bold">{clarityResult.score}</span>
                    </div>
                    <p className="text-xs mt-1 opacity-90">{clarityResult.summary}</p>
                  </div>

                  <div className="space-y-2">
                    {clarityResult.issues.map((issue, i) => (
                      <IssueCard key={i} issue={issue} onFix={fixIssue} />
                    ))}
                    {clarityResult.issues.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No issues remaining ✨</p>
                    )}
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => setClarityResult(null)} className="w-full text-xs">
                    Clear Results
                  </Button>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Rewrite Tab */}
        <TabsContent value="rewrite" className="flex-1 overflow-hidden mt-2 data-[state=inactive]:hidden">
          <div className="flex flex-col h-full">
            <div className="px-3 pb-2 flex items-center gap-2 shrink-0">
              <RefreshCw className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Smart Rewrite</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 scrollbar-dark">
              <p className="text-xs text-muted-foreground">
                Select any text in the editor, then click Get Alternatives
              </p>

              <Button
                onClick={getAlternatives}
                disabled={generating || !getSelection()}
                className="w-full btn-glow"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Get Alternatives
              </Button>

              {selectionInfo && (
                <blockquote className="border-l-2 border-border pl-3 text-xs text-muted-foreground italic line-clamp-3">
                  {selectionInfo.text}
                </blockquote>
              )}

              {generating && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground text-center">Generating alternatives…</p>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              )}

              {alternatives && !generating && (
                <>
                  <div className="space-y-2">
                    {alternatives.map((alt, i) => {
                      const diff = alt.wordCount - originalWordCount;
                      const diffColor = diff < 0 ? 'text-emerald-400' : 'text-muted-foreground';
                      const diffLabel = `${diff > 0 ? '+' : ''}${diff} words`;
                      return (
                        <div key={i} className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="text-[10px]">{alt.label}</Badge>
                            <span className={`text-[10px] ${diffColor}`}>{diffLabel}</span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">{alt.text}</p>
                          <Button size="sm" variant="outline" onClick={() => insertAlternative(alt)} className="w-full h-7 text-xs">
                            Insert
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <Button variant="ghost" size="sm" onClick={getAlternatives} className="w-full text-xs">
                    Try Again
                  </Button>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PolishPanel;
