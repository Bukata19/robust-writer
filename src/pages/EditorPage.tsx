import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import PlagiarismPanel from '@/components/PlagiarismPanel';
import VersionHistoryPanel from '@/components/VersionHistoryPanel';
import OutlinePanel from '@/components/OutlinePanel';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import introJs from 'intro.js';
import 'intro.js/introjs.css';
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
  XCircle,
  FileText,
  FileDown,
  ChevronDown,
  History,
  Maximize,
  Minimize,
  ListTree,
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
  essay: `<h1 data-placeholder="true">Essay Title</h1>
<h2 data-placeholder="true">Introduction</h2>
<p><em data-placeholder="true">Write your thesis statement and introduce the topic here...</em></p>
<h2 data-placeholder="true">Body Paragraph 1</h2>
<p><em data-placeholder="true">Present your first main argument with supporting evidence...</em></p>
<h2 data-placeholder="true">Body Paragraph 2</h2>
<p><em data-placeholder="true">Present your second main argument with supporting evidence...</em></p>
<h2 data-placeholder="true">Body Paragraph 3</h2>
<p><em data-placeholder="true">Present your third main argument with supporting evidence...</em></p>
<h2 data-placeholder="true">Conclusion</h2>
<p><em data-placeholder="true">Summarize your arguments and restate your thesis...</em></p>`,
  research_paper: `<h1 data-placeholder="true">Research Paper Title</h1>
<h2 data-placeholder="true">Abstract</h2>
<p><em data-placeholder="true">Provide a brief summary of the research (150-300 words)...</em></p>
<h2 data-placeholder="true">Introduction</h2>
<p><em data-placeholder="true">Introduce the research problem, background, and objectives...</em></p>
<h2 data-placeholder="true">Literature Review</h2>
<p><em data-placeholder="true">Review relevant existing research and identify gaps...</em></p>
<h2 data-placeholder="true">Methodology</h2>
<p><em data-placeholder="true">Describe your research methods, data collection, and analysis approach...</em></p>
<h2 data-placeholder="true">Results</h2>
<p><em data-placeholder="true">Present your findings with data, tables, or figures...</em></p>
<h2 data-placeholder="true">Discussion</h2>
<p><em data-placeholder="true">Interpret results, compare with existing literature, discuss limitations...</em></p>
<h2 data-placeholder="true">Conclusion</h2>
<p><em data-placeholder="true">Summarize key findings and suggest future research directions...</em></p>
<h2 data-placeholder="true">References</h2>
<p><em data-placeholder="true">List all cited sources in proper format...</em></p>`,
  report: `<h1 data-placeholder="true">Report Title</h1>
<h2 data-placeholder="true">Executive Summary</h2>
<p><em data-placeholder="true">Provide a concise overview of the report...</em></p>
<h2 data-placeholder="true">Introduction</h2>
<p><em data-placeholder="true">State the purpose and scope of the report...</em></p>
<h2 data-placeholder="true">Findings</h2>
<p><em data-placeholder="true">Present your research findings and analysis...</em></p>
<h2 data-placeholder="true">Recommendations</h2>
<p><em data-placeholder="true">Provide actionable recommendations based on findings...</em></p>
<h2 data-placeholder="true">Conclusion</h2>
<p><em data-placeholder="true">Summarize the report and next steps...</em></p>`,
  general: `<h1 data-placeholder="true">Document Title</h1>
<p><em data-placeholder="true">Start writing here...</em></p>`,
};

const ToolbarButton: React.FC<{ onClick: () => void; title: string; icon: React.ReactNode }> = ({ onClick, title, icon }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" onClick={onClick} className="scale-click hover:bg-primary/10 hover:text-primary transition-all">
        {icon}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="right" className="text-xs">{title}</TooltipContent>
  </Tooltip>
);

const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  const isMobile = useIsMobile();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Sidebars
  const [chatOpen, setChatOpen] = useState(false);
  const [humanizerOpen, setHumanizerOpen] = useState(false);
  const [showPlagiarism, setShowPlagiarism] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showOutline, setShowOutline] = useState(false);

  // Focus mode
  const [focusMode, setFocusMode] = useState(false);

  // Humanizer
  const [humanizerIntensity, setHumanizerIntensity] = useState(settings.defaultHumanizerIntensity);
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
      suggestion?: string;
    }>;
    originality_strengths?: string[];
  } | null>(null);
  const [plagiarismHighlightsVisible, setPlagiarismHighlightsVisible] = useState(true);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const [hasPlaceholders, setHasPlaceholders] = useState(false);

  // Apply chat default state from settings
  useEffect(() => {
    if (settings.chatDefaultState === 'open') {
      setChatOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchDocument();
  }, [id]);

  const clearPlaceholders = useCallback(() => {
    if (!hasPlaceholders || !editorRef.current) return;
    const allPlaceholders = editorRef.current.querySelectorAll('[data-placeholder="true"]');
    allPlaceholders.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'em') {
        const parent = el.parentElement;
        el.remove();
        if (parent && !parent.textContent?.trim() && parent.tagName === 'P') {
          parent.innerHTML = '<br>';
        }
      } else {
        el.innerHTML = '<br>';
        el.removeAttribute('data-placeholder');
      }
    });
    setHasPlaceholders(false);
  }, [hasPlaceholders]);

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
          setHasPlaceholders(editorRef.current.querySelectorAll('[data-placeholder="true"]').length > 0);
        } else if (!data.content) {
          editorRef.current.innerHTML = templates[data.doc_type];
          setHasPlaceholders(true);
        }
        const text = editorRef.current.innerText.trim();
        setWordCount(text ? text.split(/\s+/).filter(Boolean).length : 0);
      }
    }, 100);
  };

  const saveDocument = useCallback(async () => {
    if (!id || !editorRef.current || !user) return;
    setSaving(true);
    const content = editorRef.current.innerHTML;
    const { error } = await supabase
      .from('documents')
      .update({ title, content: content as unknown as Json })
      .eq('id', id);
    if (error) {
      toast.error('Failed to save');
    } else {
      // Snapshot version
      await supabase.from('document_versions').insert({
        document_id: id,
        user_id: user.id,
        title,
        content: content as unknown as Json,
      });
      toast.success('Document saved!');
    }
    setSaving(false);
  }, [id, title, user]);

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
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveDocument, humanizerIntensity, focusMode]);

  // Autosave
  useEffect(() => {
    if (!settings.autosaveEnabled) return;
    const interval = setInterval(() => {
      if (editorRef.current && id) {
        saveDocument();
      }
    }, settings.autosaveInterval * 1000);
    return () => clearInterval(interval);
  }, [saveDocument, id, settings.autosaveEnabled, settings.autosaveInterval]);

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportMenuOpen]);

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
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
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

  // Intro.js onboarding tour
  useEffect(() => {
    if (loading) return;
    const TOUR_KEY = 'rb_editor_tour_done';
    if (localStorage.getItem(TOUR_KEY)) return;

    const timer = setTimeout(() => {
      const intro = introJs();
      intro.setOptions({
        steps: [
          {
            element: '[data-intro-id="editor-canvas"]',
            intro: 'This is your writing canvas. Type your content here — it uses a clean A4-style layout.',
            position: 'right',
          },
          {
            element: '[data-intro-id="format-toolbar"]',
            intro: 'Use these formatting tools to bold, italicize, add headings, lists, and align your text.',
            position: isMobile ? 'top' : 'right',
          },
          {
            element: '[data-intro-id="ai-tools"]',
            intro: 'Access your AI tools here: Chat with an AI assistant, humanize text, or run a plagiarism check.',
            position: isMobile ? 'top' : 'left',
          },
          {
            element: '[data-intro-id="export-btn"]',
            intro: 'Export your finished document as a PDF or DOCX file.',
            position: 'bottom',
          },
          {
            element: '[data-intro-id="save-btn"]',
            intro: 'Save your work anytime. Documents also auto-save. Shortcut: Ctrl+S.',
            position: 'bottom',
          },
        ],
        showProgress: true,
        showBullets: false,
        exitOnOverlayClick: true,
        doneLabel: 'Got it!',
        nextLabel: 'Next →',
        prevLabel: '← Back',
      });
      intro.oncomplete(() => localStorage.setItem(TOUR_KEY, 'true'));
      intro.onexit(() => localStorage.setItem(TOUR_KEY, 'true'));
      intro.start();
    }, 800);

    return () => clearTimeout(timer);
  }, [loading, isMobile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeSidebar = chatOpen ? 'chat' : humanizerOpen ? 'humanizer' : showPlagiarism ? 'plagiarism' : showHistory ? 'history' : showOutline ? 'outline' : null;

  const closeSidebar = () => {
    setChatOpen(false);
    setHumanizerOpen(false);
    setShowPlagiarism(false);
    setShowHistory(false);
    setShowOutline(false);
  };

  const openHistory = () => {
    setShowHistory(true);
    setChatOpen(false);
    setHumanizerOpen(false);
    setShowPlagiarism(false);
    setShowOutline(false);
  };

  const openOutline = () => {
    setShowOutline(true);
    setChatOpen(false);
    setHumanizerOpen(false);
    setShowPlagiarism(false);
    setShowHistory(false);
  };

  const lineHeight = settings.lineSpacing === 'relaxed' ? 2.2 : 1.8;
  const canvasMaxW = settings.canvasWidth === 'full' ? 'max-w-none' : 'max-w-[816px]';

  // ===== Sidebar content =====
  const sidebarContent = (
    <div className="flex flex-col h-full glass-panel">
      {/* Chat Sidebar */}
      {chatOpen && (
        <>
          <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">AI Chat</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-dark">
            {chatMessages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-8">Ask me anything about your document…</p>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : 'text-left'} animate-fade-in`}>
                <div className={`inline-block max-w-[90%] rounded-xl px-3 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
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
          <div className="p-3 border-t border-border flex gap-2 shrink-0">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
              placeholder="Type a message…"
              className="flex-1 text-sm focus-glow"
            />
            <Button size="icon" onClick={sendChatMessage} disabled={chatLoading} className="btn-glow">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}

      {/* Humanizer Sidebar */}
      {humanizerOpen && (
        <>
          <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Humanizer</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setHumanizerOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-3 space-y-4 overflow-y-auto flex-1 scrollbar-dark">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Intensity</p>
              <div className="flex gap-1">
                {(['subtle', 'moderate', 'full'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setHumanizerIntensity(level)}
                    className={`flex-1 py-1.5 text-xs rounded-lg capitalize transition-all ${
                      humanizerIntensity === level
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleHumanize} disabled={humanizing} className="w-full btn-glow" size="sm">
              {humanizing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
              {humanizing ? 'Humanizing…' : 'Humanize Selection'}
            </Button>
            <p className="text-xs text-muted-foreground">Select text in the editor, then click above. Shortcut: Ctrl+H</p>

            {humanizerResult && (
              <div className="space-y-3 border-t border-border pt-3 animate-fade-in">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Original</p>
                  <p className="text-xs bg-muted p-2 rounded-lg line-through text-muted-foreground">{humanizerResult.original}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-primary mb-1">Humanized</p>
                  <p className="text-xs bg-primary/10 p-2 rounded-lg text-foreground border border-primary/20">{humanizerResult.humanized}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={acceptHumanized} className="flex-1 btn-glow">
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
        <PlagiarismPanel
          report={plagiarismReport}
          running={plagiarismRunning}
          highlightsVisible={plagiarismHighlightsVisible}
          onRun={runPlagiarismCheck}
          onToggleHighlights={() => setPlagiarismHighlightsVisible(!plagiarismHighlightsVisible)}
          onClose={() => setShowPlagiarism(false)}
        />
      )}

      {/* Version History Sidebar */}
      {showHistory && id && (
        <VersionHistoryPanel
          documentId={id}
          onRestore={(content, restoredTitle) => {
            if (editorRef.current) {
              editorRef.current.innerHTML = content;
              setTitle(restoredTitle);
              updateWordCount();
            }
          }}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Outline Sidebar */}
      {showOutline && doc && (
        <OutlinePanel
          docType={doc.doc_type}
          onInsert={(html) => {
            if (editorRef.current) {
              editorRef.current.innerHTML = html;
              updateWordCount();
            }
          }}
          onClose={() => setShowOutline(false)}
        />
      )}
    </div>
  );

  // ===== AI tool buttons =====
  const aiToolButtons = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={chatOpen ? 'default' : 'ghost'}
            size="icon"
            onClick={() => { setChatOpen(!chatOpen); setHumanizerOpen(false); setShowPlagiarism(false); }}
            className="scale-click"
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">AI Chat</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={humanizerOpen ? 'default' : 'ghost'}
            size="icon"
            onClick={() => { setHumanizerOpen(!humanizerOpen); setChatOpen(false); setShowPlagiarism(false); }}
            className="scale-click"
          >
            <Sparkles className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Humanizer</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={showPlagiarism ? 'default' : 'ghost'}
            size="icon"
            onClick={() => { setShowPlagiarism(!showPlagiarism); setChatOpen(false); setHumanizerOpen(false); setShowOutline(false); }}
            className="scale-click"
          >
            <ShieldCheck className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Plagiarism Check</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={showOutline ? 'default' : 'ghost'}
            size="icon"
            onClick={openOutline}
            className="scale-click"
          >
            <ListTree className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">AI Outline</TooltipContent>
      </Tooltip>
    </>
  );

  // ===== Formatting toolbar buttons =====
  const formatButtons = (
    <>
      <ToolbarButton onClick={() => execCommand('bold')} title="Bold" icon={<Bold className="w-4 h-4" />} />
      <ToolbarButton onClick={() => execCommand('italic')} title="Italic" icon={<Italic className="w-4 h-4" />} />
      <ToolbarButton onClick={() => execCommand('underline')} title="Underline" icon={<Underline className="w-4 h-4" />} />
      <ToolbarButton onClick={() => execCommand('formatBlock', 'H1')} title="Heading 1" icon={<Heading1 className="w-4 h-4" />} />
      <ToolbarButton onClick={() => execCommand('formatBlock', 'H2')} title="Heading 2" icon={<Heading2 className="w-4 h-4" />} />
      <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Bullet List" icon={<List className="w-4 h-4" />} />
      <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Numbered List" icon={<ListOrdered className="w-4 h-4" />} />
      <ToolbarButton onClick={() => execCommand('justifyLeft')} title="Align Left" icon={<AlignLeft className="w-4 h-4" />} />
      <ToolbarButton onClick={() => execCommand('justifyCenter')} title="Align Center" icon={<AlignCenter className="w-4 h-4" />} />
    </>
  );

  return (
    <div className={`h-screen bg-background flex flex-col overflow-hidden page-enter ${focusMode ? 'focus-mode' : ''}`}>
      {/* Top Bar */}
      <header className={`h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-3 gap-2 shrink-0 transition-opacity duration-500 ${focusMode ? 'opacity-0 hover:opacity-100 fixed top-0 left-0 right-0 z-50' : ''}`}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="scale-click">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-foreground font-display font-semibold text-lg focus:outline-none truncate"
        />

        <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap font-mono">{wordCount} words</span>

        {/* Export dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <Button variant="outline" size="sm" onClick={() => setExportMenuOpen(!exportMenuOpen)} disabled={exporting} data-intro-id="export-btn" className="btn-glow">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline ml-1">Export</span>
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
          {exportMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-50 min-w-[160px] animate-scale-in overflow-hidden">
              <button
                onClick={exportToPdf}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <FileText className="w-4 h-4" /> Export as PDF
              </button>
              <button
                onClick={exportToDocx}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <FileDown className="w-4 h-4" /> Export as DOCX
              </button>
            </div>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={openHistory} className="scale-click">
              <History className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Version History</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setFocusMode(!focusMode)} className="scale-click">
              {focusMode ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{focusMode ? 'Exit Focus Mode' : 'Focus Mode'}</TooltipContent>
        </Tooltip>

        <Button onClick={saveDocument} disabled={saving} size="sm" data-intro-id="save-btn" className="btn-glow">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="hidden sm:inline ml-1">Save</span>
        </Button>
      </header>

      {/* Main content area */}
      <div className={`flex flex-1 overflow-hidden ${focusMode ? 'pt-14' : ''}`}>
        {/* Desktop: Left formatting toolbar */}
        {!isMobile && !focusMode && (
          <div data-intro-id="format-toolbar" className="w-12 border-r border-border bg-card/50 toolbar-glow flex flex-col items-center py-3 gap-1 shrink-0 overflow-y-auto scrollbar-dark">
            {formatButtons}
          </div>
        )}

        {/* Editor Canvas */}
        <div className={`flex-1 overflow-auto flex justify-center py-6 sm:py-10 px-3 sm:px-6 scrollbar-dark transition-colors duration-500 ${focusMode ? 'bg-background' : 'bg-muted/30'}`}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={updateWordCount}
            onKeyDown={clearPlaceholders}
            className={`bg-card w-full ${focusMode ? 'max-w-[720px] border-transparent shadow-none' : canvasMaxW + ' shadow-lg border border-border'} min-h-[600px] sm:min-h-[1056px] p-6 sm:p-16 rounded-lg text-foreground prose prose-invert prose-sm max-w-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-500`}
            data-intro-id="editor-canvas"
            style={{ fontFamily: 'Georgia, serif', lineHeight, fontSize: 'var(--editor-font-size)' }}
          />
        </div>

        {/* Desktop: Right AI tab bar + inline sidebar */}
        {!isMobile && !focusMode && (
          <>
            <div data-intro-id="ai-tools" className="w-10 border-l border-border bg-card/50 toolbar-glow flex flex-col items-center py-3 gap-2 shrink-0">
              {aiToolButtons}
            </div>

            {activeSidebar && (
              <div className="w-80 border-l border-border bg-card flex flex-col shrink-0 overflow-hidden animate-slide-in-right">
                {sidebarContent}
              </div>
            )}
          </>
        )}
      </div>

      {/* Focus mode: floating exit button */}
      {focusMode && (
        <div className="fixed bottom-6 right-6 z-50 opacity-30 hover:opacity-100 transition-opacity duration-300">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setFocusMode(false)} className="rounded-full shadow-lg bg-card/80 backdrop-blur-sm">
                <Minimize className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Exit Focus Mode</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Mobile: Bottom toolbar */}
      {isMobile && !focusMode && (
        <div className="border-t border-border bg-card/80 backdrop-blur-sm flex items-center px-1 py-1.5 gap-0.5 shrink-0 overflow-x-auto scrollbar-dark">
          <div data-intro-id="format-toolbar" className="flex items-center gap-0.5 shrink-0">
            {formatButtons}
          </div>
          <div className="w-px h-6 bg-border mx-1 shrink-0" />
          <div data-intro-id="ai-tools" className="flex items-center gap-0.5 shrink-0">
            {aiToolButtons}
          </div>
        </div>
      )}

      {/* Mobile: Sheet overlay for AI sidebar */}
      {isMobile && (
        <Drawer open={!!activeSidebar} onOpenChange={(open) => { if (!open) closeSidebar(); }}>
          <DrawerContent className="h-[75vh] max-h-[75vh] p-0 flex flex-col">
            {sidebarContent}
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
};

export default EditorPage;
