import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const [exporting, setExporting] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

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
        // Initialise word count after content loads
        const text = editorRef.current.innerText.trim();
        setWordCount(text ? text.split(/\s+/).filter(Boolean).length : 0);
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

  // Autosave every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (editorRef.current && id) {
        saveDocument();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [saveDocument, id]);

  // Update word count on every keystroke
  const updateWordCount = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText.trim();
      setWordCount(text ? text.split(/\s+/).filter(Boolean).length : 0);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  // ===== EXPORT =====
  const exportToPdf = async () => {
    if (!editorRef.current) return;
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = editorRef.current.cloneNode(true) as HTMLElement;
      // Apply white background for PDF
      element.style.background = '#ffffff';
      element.style.padding = '40px';
      element.style.color = '#1a1a1a';

      const opt = {
        margin: 0.5,
        filename: `${title || 'document'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };

      await html2pdf().set(opt).from(element).save();
      toast.success('PDF exported successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const exportToDocx = async () => {
    if (!editorRef.current) return;
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType: DocAlign } = await import('docx');
      const { saveAs } = await import('file-saver');

      const children: any[] = [];
      const nodes = editorRef.current.childNodes;

      type RunInfo = { text: string; bold?: boolean; italics?: boolean; underline?: boolean };

      const extractRuns = (node: Node, parentBold = false, parentItalic = false, parentUnderline = false): RunInfo[] => {
        const runs: RunInfo[] = [];
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (text) runs.push({ text, bold: parentBold, italics: parentItalic, underline: parentUnderline });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (tag === 'br') {
            runs.push({ text: '\n' });
          } else {
            const isBold = parentBold || tag === 'b' || tag === 'strong';
            const isItalic = parentItalic || tag === 'i' || tag === 'em';
            const isUnderline = parentUnderline || tag === 'u';
            el.childNodes.forEach((child) => {
              runs.push(...extractRuns(child, isBold, isItalic, isUnderline));
            });
          }
        }
        return runs;
      };

      const toTextRuns = (el: Element): any[] => {
        const infos = extractRuns(el);
        return infos.map(r =>
          r.text === '\n'
            ? new TextRun({ text: '', break: 1 })
            : new TextRun({ text: r.text, bold: r.bold, italics: r.italics, underline: r.underline ? {} : undefined })
        );
      };

      const processElement = (el: Element) => {
        const tag = el.tagName.toLowerCase();
        const text = el.textContent?.trim() || '';

        if (tag === 'h1') {
          children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, bold: true, size: 32, font: 'Arial' })] }));
        } else if (tag === 'h2') {
          children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, bold: true, size: 28, font: 'Arial' })] }));
        } else if (tag === 'h3') {
          children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text, bold: true, size: 24, font: 'Arial' })] }));
        } else if (tag === 'ul' || tag === 'ol') {
          el.querySelectorAll(':scope > li').forEach((li) => {
            const liRuns = toTextRuns(li);
            children.push(new Paragraph({
              children: liRuns.length > 0 ? liRuns : [new TextRun(li.textContent || '')],
              bullet: tag === 'ul' ? { level: 0 } : undefined,
              numbering: tag === 'ol' ? { reference: 'default-numbering', level: 0 } : undefined,
            }));
          });
        } else if (tag === 'p' || tag === 'div') {
          const runs = toTextRuns(el);
          if (runs.length > 0) {
            children.push(new Paragraph({ children: runs, spacing: { after: 200 } }));
          } else if (text) {
            children.push(new Paragraph({ children: [new TextRun(text)], spacing: { after: 200 } }));
          }
        } else if (text) {
          children.push(new Paragraph({ children: [new TextRun(text)], spacing: { after: 200 } }));
        }
      };

      nodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processElement(node as Element);
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          children.push(new Paragraph({ children: [new TextRun(node.textContent.trim())] }));
        }
      });

      if (children.length === 0) {
        children.push(new Paragraph({ children: [new TextRun('')] }));
      }

      const docFile = new Document({
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children,
        }],
      });

      const buffer = await Packer.toBlob(docFile);
      saveAs(buffer, `${title || 'document'}.docx`);
      toast.success('DOCX exported successfully!');
    } catch (err) {
      console.error('DOCX export error:', err);
      toast.error('Failed to export DOCX');
    } finally {
      setExporting(false);
    }
  };

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

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token || '';

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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

  // Scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeSidebar = chatOpen ? 'chat' : humanizerOpen ? 'humanizer' : showPlagiarism ? 'plagiarism' : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-transparent text-foreground font-medium text-lg focus:outline-none truncate"
        />

        <span className="text-xs text-muted-foreground hidden sm:inline">{wordCount} words</span>

        {/* Export dropdown */}
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setExportMenuOpen(!exportMenuOpen)} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
            Export
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
          {exportMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[160px]">
              <button
                onClick={exportToPdf}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors rounded-t-lg"
              >
                <FileText className="w-4 h-4" /> Export as PDF
              </button>
              <button
                onClick={exportToDocx}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors rounded-b-lg"
              >
                <FileDown className="w-4 h-4" /> Export as DOCX
              </button>
            </div>
          )}
        </div>

        <Button onClick={saveDocument} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="w-12 border-r border-border bg-card flex flex-col items-center py-3 gap-2 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => execCommand('bold')} title="Bold">
            <Bold className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => execCommand('italic')} title="Italic">
            <Italic className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => execCommand('underline')} title="Underline">
            <Underline className="w-4 h-4" />
          </Button>
          <div className="w-6 border-t border-border my-1" />
          <Button variant="ghost" size="icon" onClick={() => execCommand('formatBlock', 'H1')} title="Heading 1">
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => execCommand('formatBlock', 'H2')} title="Heading 2">
            <Heading2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
            <List className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => execCommand('insertOrderedList')} title="Numbered List">
            <ListOrdered className="w-4 h-4" />
          </Button>
          <div className="w-6 border-t border-border my-1" />
          <Button variant="ghost" size="icon" onClick={() => execCommand('justifyLeft')} title="Align Left">
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => execCommand('justifyCenter')} title="Align Center">
            <AlignCenter className="w-4 h-4" />
          </Button>
        </div>

        {/* Editor Canvas */}
        <div className="flex-1 overflow-auto bg-muted/30 flex justify-center py-8 px-4">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={updateWordCount}
            className="bg-card w-full max-w-[816px] min-h-[1056px] p-16 shadow-lg rounded-sm border border-border text-foreground prose prose-sm max-w-none focus:outline-none"
            style={{ fontFamily: 'Georgia, serif', lineHeight: 1.8, fontSize: '14px' }}
          />
        </div>

        {/* Right AI Panel Tabs */}
        <div className="w-10 border-l border-border bg-card flex flex-col items-center py-3 gap-2 shrink-0">
          <Button
            variant={chatOpen ? 'default' : 'ghost'}
            size="icon"
            onClick={() => { setChatOpen(!chatOpen); setHumanizerOpen(false); setShowPlagiarism(false); }}
            title="AI Chat"
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
          <Button
            variant={humanizerOpen ? 'default' : 'ghost'}
            size="icon"
            onClick={() => { setHumanizerOpen(!humanizerOpen); setChatOpen(false); setShowPlagiarism(false); }}
            title="Humanizer"
          >
            <Sparkles className="w-4 h-4" />
          </Button>
          <Button
            variant={showPlagiarism ? 'default' : 'ghost'}
            size="icon"
            onClick={() => { setShowPlagiarism(!showPlagiarism); setChatOpen(false); setHumanizerOpen(false); }}
            title="Plagiarism Check"
          >
            <ShieldCheck className="w-4 h-4" />
          </Button>
        </div>

        {/* Sidebar Content */}
        {activeSidebar && (
          <div className="w-80 border-l border-border bg-card flex flex-col shrink-0 overflow-hidden">
            {/* Chat Sidebar */}
            {chatOpen && (
              <>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">AI Chat</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMessages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-8">Ask me anything about your document…</p>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <div className={`inline-block max-w-[90%] rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                        {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                    placeholder="Type a message…"
                    className="flex-1 text-sm"
                  />
                  <Button size="icon" onClick={sendChatMessage} disabled={chatLoading}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}

            {/* Humanizer Sidebar */}
            {humanizerOpen && (
              <>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Humanizer</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setHumanizerOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-3 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Intensity</p>
                    <div className="flex gap-1">
                      {(['subtle', 'moderate', 'full'] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => setHumanizerIntensity(level)}
                          className={`flex-1 py-1.5 text-xs rounded-md capitalize transition-colors ${
                            humanizerIntensity === level
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleHumanize} disabled={humanizing} className="w-full" size="sm">
                    {humanizing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    {humanizing ? 'Humanizing…' : 'Humanize Selection'}
                  </Button>
                  <p className="text-xs text-muted-foreground">Select text in the editor, then click above. Shortcut: Ctrl+H</p>

                  {humanizerResult && (
                    <div className="space-y-3 border-t border-border pt-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Original</p>
                        <p className="text-xs bg-muted p-2 rounded line-through text-muted-foreground">{humanizerResult.original}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-primary mb-1">Humanized</p>
                        <p className="text-xs bg-primary/10 p-2 rounded text-foreground">{humanizerResult.humanized}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={acceptHumanized} className="flex-1">
                          <Check className="w-3 h-3 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={rejectHumanized} className="flex-1">
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Plagiarism Sidebar */}
            {showPlagiarism && (
              <>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Plagiarism Check</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {plagiarismReport && (
                      <Button variant="ghost" size="icon" onClick={() => setPlagiarismHighlightsVisible(!plagiarismHighlightsVisible)} title="Toggle highlights">
                        {plagiarismHighlightsVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setShowPlagiarism(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-3 space-y-4 overflow-y-auto flex-1">
                  <Button onClick={runPlagiarismCheck} disabled={plagiarismRunning} className="w-full" size="sm">
                    {plagiarismRunning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                    {plagiarismRunning ? 'Analyzing…' : 'Run Plagiarism Check'}
                  </Button>

                  {plagiarismReport && (
                    <div className="space-y-4">
                      {/* Score */}
                      <div className={`rounded-lg p-4 text-center ${getScoreBg(plagiarismReport.overall_score)}`}>
                        <p className={`text-3xl font-bold ${getScoreColor(plagiarismReport.overall_score)}`}>{plagiarismReport.overall_score}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Risk Score</p>
                      </div>

                      {/* Summary */}
                      <p className="text-xs text-muted-foreground">{plagiarismReport.summary}</p>

                      {/* Flagged Passages */}
                      {plagiarismReport.flagged_passages.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-foreground">Flagged Passages ({plagiarismReport.flagged_passages.length})</p>
                          {plagiarismReport.flagged_passages.map((fp, i) => (
                            <div key={i} className={`border rounded-lg p-2 space-y-1 ${getSeverityColor(fp.severity)}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-medium uppercase text-muted-foreground">{fp.concern_type.replace('_', ' ')}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  fp.severity === 'high' ? 'bg-destructive/20 text-destructive' :
                                  fp.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-600' :
                                  'bg-muted text-muted-foreground'
                                }`}>{fp.severity}</span>
                              </div>
                              <p className="text-xs text-foreground italic">"{fp.excerpt}"</p>
                              <p className="text-[11px] text-muted-foreground">{fp.reason}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorPage;
