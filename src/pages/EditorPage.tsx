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
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
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
  Brain,
} from 'lucide-react';
import { useInlineAiSuggestion } from '@/hooks/useInlineAiSuggestion';
import InlineSuggestionBubble from '@/components/InlineSuggestionBubble';
import type { Json } from '@/integrations/supabase/types';

// TipTap
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import PlagiarismHighlight from '@/extensions/plagiarism-highlight';

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

// Placeholder text per doc type, keyed by paragraph index (only paragraphs counted)
const placeholderMaps: Record<DocType, Record<number, string>> = {
  essay: {
    0: 'Write your thesis statement and introduce the topic here...',
    1: 'Present your first main argument with supporting evidence...',
    2: 'Present your second main argument with supporting evidence...',
    3: 'Present your third main argument with supporting evidence...',
    4: 'Summarize your arguments and restate your thesis...',
  },
  research_paper: {
    0: 'Provide a brief summary of the research (150-300 words)...',
    1: 'Introduce the research problem, background, and objectives...',
    2: 'Review relevant existing research and identify gaps...',
    3: 'Describe your research methods, data collection, and analysis approach...',
    4: 'Present your findings with data, tables, or figures...',
    5: 'Interpret results, compare with existing literature, discuss limitations...',
    6: 'Summarize key findings and suggest future research directions...',
    7: 'List all cited sources in proper format...',
  },
  report: {
    0: 'Provide a concise overview of the report...',
    1: 'State the purpose and scope of the report...',
    2: 'Present your research findings and analysis...',
    3: 'Provide actionable recommendations based on findings...',
    4: 'Summarize the report and next steps...',
  },
  general: {
    0: 'Start writing here...',
  },
};

// TipTap JSON templates — paragraphs are intentionally empty;
// placeholder text is supplied by the TipTap Placeholder extension.
const templates: Record<DocType, any> = {
  essay: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Essay Title' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Introduction' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Body Paragraph 1' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Body Paragraph 2' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Body Paragraph 3' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion' }] },
      { type: 'paragraph' },
    ],
  },
  research_paper: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Research Paper Title' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Abstract' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Introduction' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Literature Review' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Methodology' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Results' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Discussion' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'References' }] },
      { type: 'paragraph' },
    ],
  },
  report: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Report Title' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Executive Summary' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Introduction' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Findings' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Recommendations' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion' }] },
      { type: 'paragraph' },
    ],
  },
  general: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Document Title' }] },
      { type: 'paragraph' },
    ],
  },
};

const ToolbarButton: React.FC<{ onClick: () => void; title: string; icon: React.ReactNode; active?: boolean }> = ({ onClick, title, icon, active }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" onClick={onClick} className={`scale-click hover:bg-primary/10 hover:text-primary transition-all ${active ? 'bg-primary/20 text-primary' : ''}`}>
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
  const [wordCountMode, setWordCountMode] = useState<'unchanged' | 'preset' | 'custom'>('unchanged');
  const [presetWordCount, setPresetWordCount] = useState<number>(500);
  const [customWordCount, setCustomWordCount] = useState<string>('');

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
  const [coachEnabled, setCoachEnabled] = useState(() => localStorage.getItem('ra_coach_enabled') !== 'false');
  const [coachSuggestion, setCoachSuggestion] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const docTypeRef = useRef<DocType>('general');

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
        includeChildren: true,
        placeholder: ({ node, pos, editor: ed }) => {
          if (node.type.name === 'heading') {
            const level = (node.attrs as { level?: number })?.level ?? 1;
            if (level === 1) return 'Heading 1';
            if (level === 2) return 'Heading 2';
            return 'Heading';
          }
          if (node.type.name !== 'paragraph') return '';
          const map = placeholderMaps[docTypeRef.current] ?? {};
          let paragraphIndex = -1;
          let matched = -1;
          let isFirst = true;
          let firstParagraphPos = -1;
          ed.state.doc.forEach((child, offset) => {
            if (child.type.name === 'paragraph') {
              paragraphIndex += 1;
              if (isFirst) { firstParagraphPos = offset; isFirst = false; }
              if (offset === pos) matched = paragraphIndex;
            }
          });
          const mapped = map[matched];
          if (mapped) return mapped;
          // Generic fallback so every empty paragraph still gets a hint
          if (pos === firstParagraphPos) return 'Start writing your document…';
          return 'Write something…';
        },
      }),
      CharacterCount,
      PlagiarismHighlight,
    ],
    autofocus: true,
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-full w-full',
        style: 'font-family: Georgia, serif; min-height: 100%; width: 100%; word-break: break-word; overflow-wrap: break-word; caret-color: hsl(var(--primary));',      },
    },
    onUpdate: ({ editor: ed }) => {
      setWordCount(ed.storage.characterCount.words());
      setCoachSuggestion(null);
    },
  });

  useInlineAiSuggestion({
    editor,
    docType: doc?.doc_type,
    enabled: coachEnabled,
    onSuggestion: useCallback((tip: string | null, loading: boolean) => {
      setCoachLoading(loading);
      setCoachSuggestion(tip);
    }, []),
  });

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
  };

  // Load content into editor once both editor and doc are ready
  useEffect(() => {
    if (!editor || !doc) return;
    docTypeRef.current = doc.doc_type;
    
    if (doc.content) {
      // Try as TipTap JSON first, fall back to HTML string
      if (typeof doc.content === 'object' && (doc.content as any).type === 'doc') {
        editor.commands.setContent(doc.content as any);
      } else if (typeof doc.content === 'string') {
        editor.commands.setContent(doc.content);
      }
    } else {
      editor.commands.setContent(templates[doc.doc_type]);
    }
    setWordCount(editor.storage.characterCount.words());
  }, [editor, doc]);

  const saveDocument = useCallback(async () => {
    if (!id || !editor || !user) return;
    setSaving(true);
    const content = editor.getJSON();
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
  }, [id, title, user, editor]);

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
      if (editor && id) {
        saveDocument();
      }
    }, settings.autosaveInterval * 1000);
    return () => clearInterval(interval);
  }, [saveDocument, id, settings.autosaveEnabled, settings.autosaveInterval, editor]);

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

  // ===== EXPORT =====
  const exportToPdf = async () => {
    if (!editor) return;
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = editor.getHTML();
      wrapper.style.background = '#ffffff';
      wrapper.style.padding = '40px';
      wrapper.style.color = '#1a1a1a';
      wrapper.style.fontFamily = 'Georgia, serif';

      const opt = {
        margin: 0.5,
        filename: `${title || 'document'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };

      await html2pdf().set(opt).from(wrapper).save();
      toast.success('PDF exported successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const exportToDocx = async () => {
    if (!editor) return;
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      const { saveAs } = await import('file-saver');

      const children: any[] = [];
      const json = editor.getJSON();

      const processNode = (node: any) => {
        if (!node) return;
        
        if (node.type === 'heading') {
          const level = node.attrs?.level || 1;
          const text = extractText(node);
          const headingLevel = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
          const fontSize = level === 1 ? 32 : level === 2 ? 28 : 24;
          children.push(new Paragraph({ heading: headingLevel, children: [new TextRun({ text, bold: true, size: fontSize, font: 'Arial' })] }));
        } else if (node.type === 'paragraph') {
          const runs = extractRuns(node);
          if (runs.length > 0) {
            children.push(new Paragraph({ children: runs, spacing: { after: 200 } }));
          }
        } else if (node.type === 'bulletList') {
          node.content?.forEach((li: any) => {
            const text = extractText(li);
            children.push(new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 } }));
          });
        } else if (node.type === 'orderedList') {
          node.content?.forEach((li: any) => {
            const text = extractText(li);
            children.push(new Paragraph({ children: [new TextRun(text)], numbering: { reference: 'default-numbering', level: 0 } }));
          });
        }
      };

      const extractText = (node: any): string => {
        if (node.text) return node.text;
        if (node.content) return node.content.map(extractText).join('');
        return '';
      };

      const extractRuns = (node: any): any[] => {
        if (!node.content) return [new TextRun('')];
        const runs: any[] = [];
        for (const child of node.content) {
          if (child.type === 'text') {
            const marks = child.marks || [];
            const bold = marks.some((m: any) => m.type === 'bold');
            const italics = marks.some((m: any) => m.type === 'italic');
            const underline = marks.some((m: any) => m.type === 'underline');
            runs.push(new TextRun({ text: child.text || '', bold, italics, underline: underline ? {} : undefined }));
          } else if (child.content) {
            runs.push(...extractRuns(child));
          }
        }
        return runs.length > 0 ? runs : [new TextRun('')];
      };

      json.content?.forEach(processNode);

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
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  };

  const handleHumanize = async () => {
    const selectedText = getSelectedText();
    if (!selectedText) {
      toast.error('Select text in the editor first');
      return;
    }
    if (selectedText.length > 25000) {
      toast.error('Selected text exceeds 25,000 character limit');
      return;
    }

    setHumanizing(true);
    setHumanizerResult(null);
    setHumanizerOpen(true);

    try {
      const twc = wordCountMode === 'preset' ? presetWordCount : wordCountMode === 'custom' ? (parseInt(customWordCount) || null) : null;
      const { data, error } = await supabase.functions.invoke('humanizer', {
        body: { text: selectedText, intensity: humanizerIntensity, docType: doc?.doc_type || 'general', targetWordCount: twc },
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
    if (!humanizerResult || !editor) return;
    const { from, to } = editor.state.selection;
    // If selection still matches, replace it
    const currentSelection = editor.state.doc.textBetween(from, to, ' ');
    if (currentSelection === humanizerResult.original) {
      editor.chain().focus().insertContentAt({ from, to }, humanizerResult.humanized).run();
    } else {
      // Fallback: search and replace in HTML
      const html = editor.getHTML();
      const escaped = humanizerResult.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      editor.commands.setContent(html.replace(regex, humanizerResult.humanized));
    }
    setHumanizerResult(null);
    toast.success('Humanized text applied!');
  };

  const rejectHumanized = () => {
    setHumanizerResult(null);
  };

  // ===== PLAGIARISM =====
  const runPlagiarismCheck = async () => {
    if (!editor || plagiarismRunning) return;
    const text = editor.getText();
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

      // Apply plagiarism highlight marks
      if (data.flagged_passages && editor) {
        const fullText = editor.getText();
        // Remove old highlights first
        editor.chain().selectAll().unsetMark('plagiarismHighlight').run();
        
        for (const passage of data.flagged_passages) {
          const excerpt = passage.excerpt;
          const idx = fullText.indexOf(excerpt);
          if (idx >= 0) {
            // Build a text-offset-to-prosemirror-position map
            let textOffset = 0;
            const posMap: { textStart: number; textEnd: number; nodePos: number }[] = [];
            editor.state.doc.descendants((node, nodePos) => {
              if (node.isText) {
                const len = node.text?.length || 0;
                posMap.push({ textStart: textOffset, textEnd: textOffset + len, nodePos });
                textOffset += len;
              } else if (node.isBlock && textOffset > 0) {
                // Account for block boundaries that getText() renders as separators
                textOffset += 1;
              }
            });

            const excerptStart = idx;
            const excerptEnd = idx + excerpt.length;
            let from: number | null = null;
            let to: number | null = null;

            for (const entry of posMap) {
              if (from === null && excerptStart >= entry.textStart && excerptStart < entry.textEnd) {
                from = entry.nodePos + (excerptStart - entry.textStart);
              }
              if (excerptEnd > entry.textStart && excerptEnd <= entry.textEnd) {
                to = entry.nodePos + (excerptEnd - entry.textStart);
              }
            }

            if (from !== null && to !== null && from < to) {
              editor.chain()
                .setTextSelection({ from, to })
                .setMark('plagiarismHighlight', { severity: passage.severity === 'high' ? 'high' : 'medium' })
                .run();
            }
          }
        }
        // Deselect - position 1 is the first valid position inside the doc
        const docSize = editor.state.doc.content.size;
        editor.commands.setTextSelection(Math.min(1, docSize));
      }

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
      const documentContent = editor?.getText() || '';

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
            intro: 'This is your writing canvas. Your document sections are pre-structured with smart placeholders — click any section and start typing.',
            position: 'right',
          },
          {
            element: '[data-intro-id="format-toolbar"]',
            intro: 'Format your text here — bold, italic, underline, headings, lists, and alignment. Active formats highlight as you write.',
            position: isMobile ? 'top' : 'right',
          },
          {
            element: '[data-intro-id="ai-tools"]',
            intro: 'Your AI toolkit lives here. Chat with your AI assistant, humanize selected text, or run a plagiarism check — all without leaving the editor.',
            position: isMobile ? 'top' : 'left',
          },
          {
            element: '[data-intro-id="doc-gen-btn"]',
            intro: 'Need a head start? Open the Document Generator, enter your topic and tone, and get a fully written structured draft you can edit before inserting.',
            position: isMobile ? 'top' : 'left',
          },
          {
            element: '[data-intro-id="coach-btn"]',
            intro: 'This is your Writing Coach. While enabled, it watches your writing and gives you one focused tip every time you pause — helping you write stronger assignments.',
            position: 'bottom',
          },
          {
            element: '[data-intro-id="history-btn"]',
            intro: 'Every time you save, a version snapshot is created. Open Version History to browse past versions and restore any of them.',
            position: 'bottom',
          },
          {
            element: '[data-intro-id="focus-btn"]',
            intro: 'Focus Mode hides all panels and toolbars so you can write without distractions. Press Esc or click the button again to return.',
            position: 'bottom',
          },
          {
            element: '[data-intro-id="export-btn"]',
            intro: 'Export your finished document as a PDF or DOCX file with one click.',
            position: 'bottom',
          },
          {
            element: '[data-intro-id="save-btn"]',
            intro: 'Save manually anytime with this button or Ctrl+S. Your document also auto-saves in the background.',
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
            <div>
              <p className="text-xs text-muted-foreground mb-2">Target Word Count</p>
              <div className="flex gap-1 mb-2">
                {(['unchanged', 'preset', 'custom'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setWordCountMode(mode)}
                    className={`flex-1 py-1.5 text-xs rounded-lg capitalize transition-all ${
                      wordCountMode === mode
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {wordCountMode === 'preset' && (
                <select
                  value={presetWordCount}
                  onChange={(e) => setPresetWordCount(Number(e.target.value))}
                  className="w-full text-xs rounded-lg border border-border bg-background text-foreground p-1.5"
                >
                  {[250, 500, 750, 1000, 1500, 2000].map((n) => (
                    <option key={n} value={n}>{n} words</option>
                  ))}
                </select>
              )}
              {wordCountMode === 'custom' && (
                <Input
                  type="number"
                  placeholder="Enter word count"
                  value={customWordCount}
                  onChange={(e) => setCustomWordCount(e.target.value)}
                  className="h-8 text-xs"
                  min={50}
                  max={10000}
                />
              )}
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
            if (editor) {
              // content could be JSON or HTML string
              try {
                const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                if (parsed && parsed.type === 'doc') {
                  editor.commands.setContent(parsed);
                } else {
                  editor.commands.setContent(content);
                }
              } catch {
                editor.commands.setContent(content);
              }
              setTitle(restoredTitle);
              setWordCount(editor.storage.characterCount.words());
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
            if (editor) {
              editor.commands.setContent(html);
              setWordCount(editor.storage.characterCount.words());
            }
          }}
          onClose={() => setShowOutline(false)}
        />
      )}
    </div>
  );

  // ===== AI tool buttons =====
  const openChat = () => { setChatOpen(true); setHumanizerOpen(false); setShowPlagiarism(false); setShowHistory(false); setShowOutline(false); };
  const openHumanizer = () => { setHumanizerOpen(true); setChatOpen(false); setShowPlagiarism(false); setShowHistory(false); setShowOutline(false); };
  const openPlagiarism = () => { setShowPlagiarism(true); setChatOpen(false); setHumanizerOpen(false); setShowHistory(false); setShowOutline(false); };

  const toggleOrOpen = (current: boolean, opener: () => void, closer: () => void) => {
    if (isMobile) { opener(); } else { current ? closer() : opener(); }
  };

  const aiToolButtons = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={chatOpen ? 'default' : 'ghost'}
            size="icon"
            onClick={() => toggleOrOpen(chatOpen, openChat, () => setChatOpen(false))}
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
            onClick={() => toggleOrOpen(humanizerOpen, openHumanizer, () => setHumanizerOpen(false))}
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
            onClick={() => toggleOrOpen(showPlagiarism, openPlagiarism, () => setShowPlagiarism(false))}
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
            data-intro-id="doc-gen-btn"
            className="scale-click"
          >
            <FileText className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Document Generator</TooltipContent>
      </Tooltip>
    </>
  );

  // ===== Formatting toolbar buttons =====
  const formatButtons = editor ? (
    <>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" icon={<Bold className="w-4 h-4" />} active={editor.isActive('bold')} />
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" icon={<Italic className="w-4 h-4" />} active={editor.isActive('italic')} />
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline" icon={<Underline className="w-4 h-4" />} active={editor.isActive('underline')} />
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1" icon={<Heading1 className="w-4 h-4" />} active={editor.isActive('heading', { level: 1 })} />
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2" icon={<Heading2 className="w-4 h-4" />} active={editor.isActive('heading', { level: 2 })} />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List" icon={<List className="w-4 h-4" />} active={editor.isActive('bulletList')} />
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List" icon={<ListOrdered className="w-4 h-4" />} active={editor.isActive('orderedList')} />
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align Left" icon={<AlignLeft className="w-4 h-4" />} active={editor.isActive({ textAlign: 'left' })} />
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align Center" icon={<AlignCenter className="w-4 h-4" />} active={editor.isActive({ textAlign: 'center' })} />
      {!isMobile && (
        <>
          <div className="w-px h-6 bg-border my-1" />
          <ToolbarButton onClick={openOutline} title="Document Generator" icon={<FileText className="w-4 h-4" />} />
        </>
      )}
    </>
  ) : null;

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
          placeholder="Untitled document"
          className="flex-1 min-w-0 bg-transparent text-foreground font-display font-semibold text-lg focus:outline-none truncate placeholder:text-muted-foreground/50 placeholder:italic placeholder:font-normal"
        />

        <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap font-mono">{wordCount} words</span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              data-intro-id="coach-btn"
              onClick={() => {
                const next = !coachEnabled;
                setCoachEnabled(next);
                localStorage.setItem('ra_coach_enabled', String(next));
                if (!next) {
                  setCoachSuggestion(null);
                  setCoachLoading(false);
                }
              }}
              className={`scale-click ${coachEnabled ? 'text-primary' : ''}`}
            >
              <Brain className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{coachEnabled ? 'Writing Coach: On' : 'Writing Coach: Off'}</TooltipContent>
        </Tooltip>

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
            <Button variant="ghost" size="icon" onClick={openHistory} data-intro-id="history-btn" className="scale-click">
              <History className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Version History</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setFocusMode(!focusMode)} data-intro-id="focus-btn" className="scale-click">
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
        <div className={`flex-1 overflow-auto flex justify-center py-4 sm:py-8 lg:py-10 px-2 sm:px-4 lg:px-8 scrollbar-dark transition-colors duration-500 bg-background ${!plagiarismHighlightsVisible ? 'hide-plagiarism-highlights' : ''}`}>
          <EditorContent
            editor={editor}
            data-intro-id="editor-canvas"
            className={`w-full min-w-0 px-4 sm:px-10 py-6 cursor-text text-foreground ${focusMode ? 'max-w-[720px]' : canvasMaxW}`}
            style={{ fontFamily: 'Georgia, serif', wordBreak: 'break-word', overflowWrap: 'break-word', lineHeight, fontSize: 'var(--editor-font-size)' }}
            onClick={() => { if (editor && !editor.isFocused) editor.commands.focus('end'); }}
          />
          <InlineSuggestionBubble
            suggestion={coachSuggestion}
            loading={coachLoading}
            onDismiss={() => { setCoachSuggestion(null); setCoachLoading(false); }}
            onSendToChat={(tip) => {
              setChatInput(tip);
              setChatOpen(true);
              setCoachSuggestion(null);
            }}
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

      {/* Mobile: Bottom toolbar — two rows */}
      {isMobile && !focusMode && (
        <div className="border-t border-border bg-card/90 backdrop-blur-sm shrink-0 safe-area-bottom">
          {/* Row 1: AI tool buttons */}
          <div data-intro-id="ai-tools" className="flex items-center justify-center gap-1 px-2 py-1.5 border-b border-border/50">
            {aiToolButtons}
          </div>
          {/* Row 2: Formatting buttons */}
          <div data-intro-id="format-toolbar" className="flex items-center gap-0.5 px-1.5 py-1.5 overflow-x-auto scrollbar-dark">
            {formatButtons}
          </div>
        </div>
      )}

      {/* Mobile: Sheet overlay for AI sidebar */}
      {isMobile && (
        <Drawer open={!!activeSidebar} onOpenChange={(open) => { if (!open) closeSidebar(); }}>
          <DrawerContent className="h-[75vh] max-h-[75vh] p-0 flex flex-col">
            <VisuallyHidden>
              <DrawerTitle>AI Tools</DrawerTitle>
              <DrawerDescription>AI-powered writing assistance panel</DrawerDescription>
            </VisuallyHidden>
            {sidebarContent}
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
};

export default EditorPage;
