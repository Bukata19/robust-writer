import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  Save,
  Download,
  Bot,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  X,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  Heading1,
  Heading2,
  Send,
  Loader2,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  XCircle,
  FileText,
  FileDown,
  ChevronDown,
} from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

type DocType = 'essay' | 'research_paper' | 'report' | 'general';

interface DocumentData {
  id: string;
  title: string;
  content: Json | null;
  doc_type: DocType;
  plagiarism_score: number | null;
  plagiarism_data: Json | null;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const templates: Record<DocType, string> = {
  essay: `<h1>Essay Title</h1>
<h2>Introduction</h2>
<p><em>Write your thesis statement and introduce the topic here...</em></p>
<h2>Body Paragraph 1</h2>
<p><em>Present your first main argument with supporting evidence...</em></p>
<h2>Body Paragraph 2</h2>
<p><em>Present your second main argument with supporting evidence...</em></p>
<h2>Body Paragraph 3</h2>
<p><em>Present your third main argument with supporting evidence...</em></p>
<h2>Conclusion</h2>
<p><em>Summarize your arguments and restate your thesis...</em></p>`,
  research_paper: `<h1>Research Paper Title</h1>
<h2>Abstract</h2>
<p><em>Provide a brief summary of the research (150-300 words)...</em></p>
<h2>Introduction</h2>
<p><em>Introduce the research problem, background, and objectives...</em></p>
<h2>Literature Review</h2>
<p><em>Review relevant existing research and identify gaps...</em></p>
<h2>Methodology</h2>
<p><em>Describe your research methods, data collection, and analysis approach...</em></p>
<h2>Results</h2>
<p><em>Present your findings with data, tables, or figures...</em></p>
<h2>Discussion</h2>
<p><em>Interpret results, compare with existing literature, discuss limitations...</em></p>
<h2>Conclusion</h2>
<p><em>Summarize key findings and suggest future research directions...</em></p>
<h2>References</h2>
<p><em>List all cited sources in proper format...</em></p>`,
  report: `<h1>Report Title</h1>
<h2>Executive Summary</h2>
<p><em>Provide a concise overview of the report...</em></p>
<h2>Introduction</h2>
<p><em>State the purpose and scope of the report...</em></p>
<h2>Findings</h2>
<p><em>Present your research findings and analysis...</em></p>
<h2>Recommendations</h2>
<p><em>Provide actionable recommendations based on findings...</em></p>
<h2>Conclusion</h2>
<p><em>Summarize the report and next steps...</em></p>`,
  general: `<h1>Document Title</h1>
<p><em>Start writing here...</em></p>`,
};

const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Sidebars
  const [chatOpen, setChatOpen] = useState(false);
  const [humanizerOpen, setHumanizerOpen] = useState(false);
  const [showPlagiarism, setShowPlagiarism] = useState(false);

  // Humanizer
  const [humanizerIntensity, setHumanizerIntensity] = useState<'subtle' | 'moderate' | 'full'>('moderate');
  const [humanizing, setHumanizing] = useState(false);
  const [humanizerResult, setHumanizerResult] = useState<{ original: string; humanized: string } | null>(null);

  // Plagiarism
  const [plagiarismRunning, setPlagiarismRunning] = useState(false);
  const [plagiarismReport, setPlagiarismReport] = useState<{
    overall_score: number;
    summary: string;
    flagged_passages: Array<{
      excerpt: string;
      concern_type: string;
      reason: string;
      severity: string;
    }>;
  } | null>(null);
  const [plagiarismHighlightsVisible, setPlagiarismHighlightsVisible] = useState(true);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, content, doc_type, plagiarism_score, plagiarism_data')
      .eq('id', id!)
      .single();

    if (error || !data) {
      toast.error('Document not found');
      navigate('/dashboard');
      return;
    }

    setDoc(data);
    setTitle(data.title);
    setLoading(false);

    setTimeout(() => {
      if (editorRef.current) {
        if (data.content && typeof data.content === 'string') {
          editorRef.current.innerHTML = data.content;
        } else if (!data.content) {
          editorRef.current.innerHTML = templates[data.doc_type];
        }
      }
    }, 100);
  };

  const saveDocument = useCallback(async () => {
    if (!id || !editorRef.current) return;
    setSaving(true);
    const content = editorRef.current.innerHTML;
    const { error } = await supabase
      .from('documents')
      .update({ title, content: content as unknown as Json })
      .eq('id', id);
    if (error) toast.error('Failed to save');
    else toast.success('Document saved!');
    setSaving(false);
  }, [id, title]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDocument();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        handleHumanize();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveDocument, humanizerIntensity]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  // ===== HUMANIZER =====
  const getSelectedText = (): string => {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : '';
  };

  const handleHumanize = async () => {
    const selectedText = getSelectedText();
    if (!selectedText) {
      toast.error('Select text in the editor first');
      return;
    }
    if (selectedText.length > 10000) {
      toast.error('Selected text exceeds 10,000 character limit');
      return;
    }

    setHumanizing(true);
    setHumanizerResult(null);
    setHumanizerOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke('humanizer', {
        body: { text: selectedText, intensity: humanizerIntensity },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setHumanizerResult({ original: selectedText, humanized: data.humanizedText });
    } catch (err: any) {
      toast.error(err.message || 'Humanizer failed');
    } finally {
      setHumanizing(false);
    }
  };

  const acceptHumanized = () => {
    if (!humanizerResult || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    // Simple replace of the original text
    const escaped = humanizerResult.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    editorRef.current.innerHTML = html.replace(regex, humanizerResult.humanized);
    setHumanizerResult(null);
    toast.success('Humanized text applied!');
  };

  const rejectHumanized = () => {
    setHumanizerResult(null);
  };

  // ===== PLAGIARISM =====
  const runPlagiarismCheck = async () => {
    if (!editorRef.current || plagiarismRunning) return;
    const text = editorRef.current.innerText.trim();
    if (text.length < 50) {
      toast.error('Write at least 50 characters before running plagiarism check');
      return;
    }

    setPlagiarismRunning(true);
    setPlagiarismReport(null);
    setShowPlagiarism(true);

    try {
      const { data, error } = await supabase.functions.invoke('plagiarism', {
        body: { text, documentId: id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPlagiarismReport(data);
      setPlagiarismHighlightsVisible(true);

      // Save score to DB
      if (id) {
        await supabase
          .from('documents')
          .update({
            plagiarism_score: data.overall_score,
            plagiarism_data: data as unknown as Json,
          })
          .eq('id', id);
        setDoc((prev) => prev ? { ...prev, plagiarism_score: data.overall_score, plagiarism_data: data as unknown as Json } : prev);
      }

      toast.success(`Plagiarism check complete: ${data.overall_score}% risk`);
    } catch (err: any) {
      toast.error(err.message || 'Plagiarism check failed');
    } finally {
      setPlagiarismRunning(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 15) return 'text-teal';
    if (score <= 40) return 'text-yellow-400';
    return 'text-destructive';
  };

  const getScoreBg = (score: number) => {
    if (score <= 15) return 'bg-teal/20';
    if (score <= 40) return 'bg-yellow-500/20';
    return 'bg-destructive/20';
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'high') return 'border-destructive/60 bg-destructive/10';
    if (severity === 'medium') return 'border-yellow-500/60 bg-yellow-500/10';
    return 'border-muted-foreground/30 bg-muted/50';
  };

  // ===== CHAT =====
  const sendChatMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: msg };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    let assistantSoFar = '';

    try {
      const documentContent = editorRef.current?.innerText || '';

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          documentContent,
          plagiarismData: doc?.plagiarism_data,
        }),
      });

      if (resp.status === 429) {
        toast.error('Rate limit exceeded. Please wait and try again.');
        setChatLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error('AI credits exhausted. Please add funds.');
        setChatLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error('Failed to start stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setChatMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Chat failed');
    } finally {
      setChatLoading(false);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none text-foreground font-display font-semibold text-sm h-8 w-48 md:w-72 focus-visible:ring-0 px-0"
            />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={saveDocument} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              <span className="hidden md:inline">{saving ? 'Saving...' : 'Save'}</span>
            </Button>
            <Button variant="ghost" size="sm">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Editor Area */}
        <div className="flex-1 overflow-auto bg-slate/20 scrollbar-dark">
          {/* Toolbar */}
          <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-sm border-b border-border px-4 py-1.5 flex items-center gap-1 flex-wrap md:static md:flex-nowrap">
            <button onClick={() => execCommand('bold')} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <Bold className="w-4 h-4" />
            </button>
            <button onClick={() => execCommand('italic')} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <Italic className="w-4 h-4" />
            </button>
            <button onClick={() => execCommand('underline')} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <Underline className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={() => execCommand('formatBlock', 'h1')} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <Heading1 className="w-4 h-4" />
            </button>
            <button onClick={() => execCommand('formatBlock', 'h2')} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <Heading2 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => execCommand('insertOrderedList')} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <ListOrdered className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={() => execCommand('justifyLeft')} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <AlignLeft className="w-4 h-4" />
            </button>
            <button onClick={() => execCommand('justifyCenter')} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <AlignCenter className="w-4 h-4" />
            </button>

            <div className="flex-1" />

            <Button variant="ghost" size="sm" onClick={() => { setHumanizerOpen(!humanizerOpen); }} className={humanizerOpen ? 'text-teal' : ''}>
              <Sparkles className="w-4 h-4 mr-1" /> <span className="hidden md:inline">Humanizer</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowPlagiarism(!showPlagiarism)} className={showPlagiarism ? 'text-destructive' : ''}>
              <ShieldCheck className="w-4 h-4 mr-1" /> <span className="hidden md:inline">Plagiarism</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setChatOpen(!chatOpen)} className={chatOpen ? 'text-teal' : ''}>
              <MessageCircle className="w-4 h-4 mr-1" /> <span className="hidden md:inline">Chat</span>
            </Button>
          </div>

          {/* A4 Canvas */}
          <div className="p-4 md:p-8">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="a4-canvas rounded-sm outline-none prose prose-sm max-w-none
                [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-gray-900
                [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-gray-800
                [&_p]:mb-3 [&_p]:leading-relaxed [&_p]:text-gray-700
                [&_em]:text-gray-400
                [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3
                [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3
                [&_li]:mb-1"
              spellCheck
            />
          </div>
        </div>

        {/* Humanizer Sidebar */}
        {humanizerOpen && (
          <div className="w-72 border-l border-border bg-card p-4 animate-slide-in-right overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal" /> Humanizer
              </h3>
              <button onClick={() => setHumanizerOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Intensity</label>
                <div className="flex gap-1">
                  {(['subtle', 'moderate', 'full'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setHumanizerIntensity(level)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                        humanizerIntensity === level
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full" size="sm" onClick={handleHumanize} disabled={humanizing}>
                {humanizing ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processing...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-1" /> Humanize Selected Text</>
                )}
              </Button>

              {/* Humanizer Result */}
              {humanizerResult && (
                <div className="space-y-3 border-t border-border pt-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Original</label>
                    <div className="text-xs text-foreground/70 bg-muted rounded-md p-2 max-h-24 overflow-auto">
                      {humanizerResult.original}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-teal mb-1 block">Humanized</label>
                    <div className="text-xs text-foreground bg-teal/10 border border-teal/30 rounded-md p-2 max-h-32 overflow-auto">
                      {humanizerResult.humanized}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={acceptHumanized}>
                      <Check className="w-3 h-3 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={rejectHumanized}>
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              )}

              {!humanizerResult && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Select text in the editor, then click humanize. Review the result and accept or reject.
                  </p>
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Tip:</strong> Use Ctrl+H to quickly trigger humanization.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Plagiarism Sidebar */}
        {showPlagiarism && (
          <div className="w-80 border-l border-border bg-card flex flex-col animate-slide-in-right overflow-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-destructive" /> Plagiarism Check
              </h3>
              <button onClick={() => setShowPlagiarism(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <Button
                className="w-full"
                size="sm"
                onClick={runPlagiarismCheck}
                disabled={plagiarismRunning}
                variant={plagiarismRunning ? 'secondary' : 'default'}
              >
                {plagiarismRunning ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing...</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-1" /> Run Plagiarism Check</>
                )}
              </Button>

              {plagiarismReport && (
                <>
                  {/* Score */}
                  <div className={`rounded-lg p-4 text-center ${getScoreBg(plagiarismReport.overall_score)}`}>
                    <div className={`text-3xl font-display font-bold ${getScoreColor(plagiarismReport.overall_score)}`}>
                      {plagiarismReport.overall_score}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {plagiarismReport.overall_score <= 15 ? 'Clean' :
                       plagiarismReport.overall_score <= 40 ? 'Low Risk' :
                       plagiarismReport.overall_score <= 70 ? 'Moderate Risk' : 'High Risk'}
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {plagiarismReport.summary}
                  </p>

                  {/* Toggle highlights */}
                  <button
                    onClick={() => setPlagiarismHighlightsVisible(!plagiarismHighlightsVisible)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                  >
                    {plagiarismHighlightsVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {plagiarismHighlightsVisible ? 'Hide' : 'Show'} flagged passages
                  </button>

                  {/* Flagged passages */}
                  {plagiarismHighlightsVisible && plagiarismReport.flagged_passages.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-foreground">
                        Flagged Passages ({plagiarismReport.flagged_passages.length})
                      </h4>
                      {plagiarismReport.flagged_passages.map((passage, i) => (
                        <div
                          key={i}
                          className={`rounded-lg border p-3 space-y-2 ${getSeverityColor(passage.severity)}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                              {passage.concern_type.replace('_', ' ')}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${
                              passage.severity === 'high' ? 'bg-destructive/20 text-destructive' :
                              passage.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {passage.severity}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/80 italic leading-relaxed">
                            "{passage.excerpt}"
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {passage.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {plagiarismReport.flagged_passages.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                      <Check className="w-6 h-6 mx-auto mb-1 text-teal" />
                      No flagged passages found.
                    </div>
                  )}
                </>
              )}

              {!plagiarismReport && !plagiarismRunning && (
                <p className="text-xs text-muted-foreground">
                  Click "Run Plagiarism Check" to analyze your document for originality concerns, AI-generated patterns, and uncited claims.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Chat Sidebar */}
        {chatOpen && (
          <div className="w-80 border-l border-border bg-card flex flex-col animate-slide-in-right">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                <Bot className="w-4 h-4 text-teal" /> AI Assistant
              </h3>
              <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div ref={chatScrollRef} className="flex-1 p-4 overflow-auto scrollbar-dark space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Ask me about your document. I have full context of your content.</p>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-secondary text-secondary-foreground rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-1 [&_p]:last:mb-0 [&_ul]:mb-1 [&_ol]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-xl px-3 py-2 rounded-bl-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChatMessage();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about your document..."
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  disabled={chatLoading}
                />
                <Button size="sm" type="submit" disabled={chatLoading || !chatInput.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom toolbar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border px-2 py-1.5 flex items-center justify-around z-20">
        <button onClick={() => execCommand('bold')} className="p-2 text-muted-foreground">
          <Bold className="w-5 h-5" />
        </button>
        <button onClick={() => execCommand('italic')} className="p-2 text-muted-foreground">
          <Italic className="w-5 h-5" />
        </button>
        <button onClick={() => setHumanizerOpen(!humanizerOpen)} className="p-2 text-teal">
          <Sparkles className="w-5 h-5" />
        </button>
        <button onClick={() => setChatOpen(!chatOpen)} className="p-2 text-teal">
          <MessageCircle className="w-5 h-5" />
        </button>
        <button onClick={saveDocument} className="p-2 text-primary">
          <Save className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default EditorPage;
