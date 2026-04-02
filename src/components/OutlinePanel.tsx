import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  X,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ListTree,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

type DocType = 'essay' | 'research_paper' | 'report' | 'general';
type Tone = 'academic' | 'persuasive' | 'analytical' | 'descriptive';

interface OutlineSection {
  id: string;
  heading: string;
  argument: string;
}

interface OutlinePanelProps {
  docType: DocType;
  onInsert: (html: string) => void;
  onClose: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const genId = () => Math.random().toString(36).slice(2, 10);

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'academic', label: 'Academic' },
  { value: 'persuasive', label: 'Persuasive' },
  { value: 'analytical', label: 'Analytical' },
  { value: 'descriptive', label: 'Descriptive' },
];

const DOC_LABELS: Record<DocType, string> = {
  essay: 'Essay',
  research_paper: 'Research Paper',
  report: 'Report',
  general: 'General',
};

const parseOutline = (text: string): OutlineSection[] => {
  const sections: OutlineSection[] = [];
  // Try to parse JSON array first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((s: any) => ({
        id: genId(),
        heading: s.heading || s.title || '',
        argument: s.argument || s.key_argument || s.description || '',
      }));
    }
  } catch {
    // fallback: parse markdown-style lines
  }

  const lines = text.split('\n').filter((l) => l.trim());
  let current: { heading: string; argument: string } | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/) || line.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*$/);
    if (headingMatch) {
      if (current) sections.push({ id: genId(), ...current });
      current = { heading: headingMatch[1].replace(/\*\*/g, '').trim(), argument: '' };
    } else if (current) {
      const cleaned = line.replace(/^[-•*]\s*/, '').trim();
      if (cleaned && !current.argument) current.argument = cleaned;
    }
  }
  if (current) sections.push({ id: genId(), ...current });

  // If nothing parsed, create a single section from the whole text
  if (sections.length === 0 && text.trim()) {
    sections.push({ id: genId(), heading: 'Section 1', argument: text.trim().slice(0, 120) });
  }

  return sections;
};

const OutlinePanel: React.FC<OutlinePanelProps> = ({ docType, onInsert, onClose }) => {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<Tone>('academic');
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState<OutlineSection[]>([]);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const buildPrompt = useCallback(
    (customTopic?: string) =>
      `Generate a detailed outline for a ${DOC_LABELS[docType]} about: "${customTopic || topic}".
Tone: ${tone}.

Return a JSON array of objects with "heading" and "argument" fields. Each object is one section. The "argument" is a one-line key argument or purpose for that section. Return 5-8 sections. Only return the JSON array, no other text.`,
    [topic, tone, docType],
  );

  const callAI = async (prompt: string): Promise<string> => {
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
        messages: [{ role: 'user', content: prompt }],
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
  };

  const generateOutline = async () => {
    if (!topic.trim()) {
      toast.error('Enter a topic first');
      return;
    }
    setGenerating(true);
    setStep('review');
    setSections([]);
    try {
      const text = await callAI(buildPrompt());
      const parsed = parseOutline(text);
      if (parsed.length === 0) throw new Error('Could not parse outline');
      setSections(parsed);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate outline');
      setStep('input');
    } finally {
      setGenerating(false);
    }
  };

  const regenerateAll = async () => {
    setGenerating(true);
    setSections([]);
    try {
      const text = await callAI(buildPrompt());
      setSections(parseOutline(text));
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate');
    } finally {
      setGenerating(false);
    }
  };

  const regenerateSection = async (section: OutlineSection) => {
    setRegeneratingId(section.id);
    try {
      const prompt = `For a ${DOC_LABELS[docType]} about "${topic}" (tone: ${tone}), regenerate just this one section.
Current heading: "${section.heading}"
Return a single JSON object with "heading" and "argument" fields. Only return the JSON, no other text.`;
      const text = await callAI(prompt);
      let newData: { heading: string; argument: string };
      try {
        newData = JSON.parse(text);
      } catch {
        newData = { heading: section.heading, argument: text.trim().slice(0, 120) };
      }
      setSections((prev) =>
        prev.map((s) => (s.id === section.id ? { ...s, heading: newData.heading || s.heading, argument: newData.argument || s.argument } : s)),
      );
    } catch {
      toast.error('Failed to regenerate section');
    } finally {
      setRegeneratingId(null);
    }
  };

  const moveSection = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= sections.length) return;
    setSections((prev) => {
      const copy = [...prev];
      [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
      return copy;
    });
  };

  const addSection = () => {
    setSections((prev) => [...prev, { id: genId(), heading: 'New Section', argument: '' }]);
  };

  const deleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSection = (id: string, field: 'heading' | 'argument', value: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const insertOutline = () => {
    const html = sections
      .map((s) => `<h2>${s.heading}</h2>\n<p><em>${s.argument || 'Write your content here...'}</em></p>`)
      .join('\n');
    onInsert(html);
    toast.success('Outline inserted into editor');
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ListTree className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">AI Outline</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Input Step */}
      {step === 'input' && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1 scrollbar-dark">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Topic</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The impact of AI on modern education"
              className="text-sm focus-glow"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tone</label>
            <div className="grid grid-cols-2 gap-1.5">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`py-1.5 text-xs rounded-lg capitalize transition-all ${
                    tone === t.value
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Document Type</label>
            <div className="px-3 py-2 bg-muted rounded-lg text-sm text-foreground">{DOC_LABELS[docType]}</div>
          </div>

          <Button onClick={generateOutline} disabled={generating} className="w-full btn-glow">
            <Sparkles className="w-4 h-4 mr-1.5" />
            Generate Outline
          </Button>
        </div>
      )}

      {/* Review Step */}
      {step === 'review' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-dark">
            {generating ? (
              <div className="space-y-3 pt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              sections.map((section, index) => (
                <div
                  key={section.id}
                  className="border border-border rounded-lg p-2.5 space-y-1.5 bg-card/50 animate-fade-in"
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">{index + 1}.</span>
                    <input
                      value={section.heading}
                      onChange={(e) => updateSection(section.id, 'heading', e.target.value)}
                      className="flex-1 text-sm font-semibold bg-transparent text-foreground focus:outline-none border-b border-transparent focus:border-primary/40 transition-colors"
                    />
                    <div className="flex items-center shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSection(index, -1)} disabled={index === 0}>
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1}>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => regenerateSection(section)}
                        disabled={regeneratingId === section.id}
                      >
                        <RefreshCw className={`w-3 h-3 ${regeneratingId === section.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteSection(section.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <input
                    value={section.argument}
                    onChange={(e) => updateSection(section.id, 'argument', e.target.value)}
                    placeholder="Key argument..."
                    className="w-full text-xs text-muted-foreground bg-transparent focus:outline-none focus:text-foreground transition-colors"
                  />
                </div>
              ))
            )}
          </div>

          {!generating && sections.length > 0 && (
            <div className="p-3 border-t border-border space-y-2 shrink-0">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addSection} className="flex-1">
                  <Plus className="w-3 h-3 mr-1" /> Add Section
                </Button>
                <Button variant="outline" size="sm" onClick={regenerateAll} className="flex-1">
                  <RefreshCw className="w-3 h-3 mr-1" /> Regenerate All
                </Button>
              </div>
              <Button onClick={insertOutline} className="w-full btn-glow">
                <ArrowRight className="w-4 h-4 mr-1.5" /> Insert Outline
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep('input')} className="w-full text-xs">
                ← Back to inputs
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OutlinePanel;
