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
import OfflineBadge from '@/components/OfflineBadge';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cacheDocument, getCachedDocument, getLastCachedDocument, type CachedDoc } from '@/lib/offlineDocCache';
import { saveLocalDraft, getLocalDraft, clearLocalDraft, hasNewerDraft } from '@/lib/localDraft';
import PlagiarismPanel from '@/components/PlagiarismPanel';
import VersionHistoryPanel from '@/components/VersionHistoryPanel';
import PolishPanel from '@/components/PolishPanel';
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
  BookOpenCheck,
  Wand2,
  Settings,
} from 'lucide-react';
import { useInlineAiSuggestion } from '@/hooks/useInlineAiSuggestion';
import InlineParagraphTip from '@/components/InlineSuggestionBubble';
import AssignmentDecoderPanel from '@/components/AssignmentDecoder/AssignmentDecoderPanel';
import SectionTip from '@/components/AssignmentDecoder/SectionTip';
import { useAssignmentDecoder } from '@/hooks/useAssignmentDecoder';
import PagedCanvas from '@/components/PagedCanvas';
import SettingsDrawer from '@/components/SettingsDrawer';
import type { Json } from '@/integrations/supabase/types';

// TipTap
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import AiHighlight from '@/extensions/ai-highlight';
import AiHighlightPopover from '@/components/AiHighlightPopover';
import {
  computeAiHighlights,
  DEFAULT_FILTERS,
  type HighlightFilters,
  type HighlightCategory,
  type HighlightMeta,
} from '@/lib/aiHighlightCompute';
import { usePageTitle } from '@/hooks/usePageTitle';

const TextStyleWithFontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.fontSize || null,
        renderHTML: (attrs: { fontSize?: string | null }) =>
          attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
      },
    };
  },
});

const FONT_FAMILY_OPTIONS = [
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
];
const FONT_SIZE_OPTIONS = ['12px', '14px', '16px', '18px', '20px', '24px'];

type DocType = 'essay' | 'research_paper' | 'report' | 'general';

interface DocumentData {
  id: string;
  title: string;
  content: Json | null;
  doc_type: DocType;
  plagiarism_score: number | null;
  plagiarism_data: Json | null;
  updated_at: string;
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
      <Button variant="ghost" size="icon" onClick={onClick} aria-label={title} className={`scale-click hover:bg-primary/10 hover:text-primary transition-all ${active ? 'bg-primary/20 text-primary' : ''}`}>
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
  const online = useOnlineStatus();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Offline read-only state + the last-opened doc offered when booting offline
  // on a route we have no cache for.
  const [readOnlyOffline, setReadOnlyOffline] = useState(false);
  const [offlineLastDoc, setOfflineLastDoc] = useState<CachedDoc | null>(null);
  // A newer local backup than the last server save, awaiting user decision.
  const [draftPrompt, setDraftPrompt] = useState<{ backedUpAt: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [lineSpacingOverride, setLineSpacingOverride] = useState<number | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Sidebars
  const [chatOpen, setChatOpen] = useState(false);
  const [humanizerOpen, setHumanizerOpen] = useState(false);
  const [showPlagiarism, setShowPlagiarism] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPolish, setShowPolish] = useState(false);
  const [showDecoder, setShowDecoder] = useState(false);

  // Focus mode
  const [focusMode, setFocusMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  risk_level?: 'clean' | 'low_risk' | 'moderate' | 'high_risk';
  summary: string;
  flagged_passages: Array<{
    excerpt: string;
    concern_type: string;
    reason: string;
    severity: string;
    confidence?: number;
    suggestion?: string;
  }>;
  originality_strengths?: string[];
  source_indicators?: Record<string, unknown>;
  raw_signals?: Record<string, unknown>;
} | null>(null);
  const [plagiarismHighlightsVisible, setPlagiarismHighlightsVisible] = useState(true);
  // AI Detector highlight controls
  const [highlightFilters, setHighlightFilters] = useState<HighlightFilters>(DEFAULT_FILTERS);
  const [liveDetect, setLiveDetect] = useState(true);
  const [aiHighlightCounts, setAiHighlightCounts] = useState<Record<HighlightCategory, number>>({
    word: 0, phrase: 0, passage: 0, structure: 0,
  });
  const [popoverMeta, setPopoverMeta] = useState<HighlightMeta | null>(null);
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null);
  const highlightMetaRef = useRef<Record<string, HighlightMeta>>({});

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [coachEnabled, setCoachEnabled] = useState(() => localStorage.getItem('ra_coach_enabled') !== 'false');
  const [coachSuggestion, setCoachSuggestion] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const docTypeRef = useRef<DocType>('general');

  // Autosave bookkeeping: skip no-op saves (so identical version snapshots don't
  // pile up), detect concurrent edits via updated_at, and let the autosave
  // interval call the latest save fn without being torn down on every keystroke.
  const lastSavedContentRef = useRef<string | null>(null);
  const lastSavedTitleRef = useRef<string>('');
  const lastUpdatedAtRef = useRef<string | null>(null);
  const conflictWarnedRef = useRef(false);
  const saveDocumentRef = useRef<((opts?: { manual?: boolean }) => void) | null>(null);
  // Local-draft bookkeeping (read inside the stable onUpdate closure).
  const readOnlyOfflineRef = useRef(false);
  const initialContentLoadedRef = useRef(false);

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
      TextStyleWithFontSize,
      FontFamily,
      AiHighlight,
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
  setCoachLoading(false);
  // Local backup safety net: mirror genuine user edits to localStorage so
  // in-progress writing survives a crash / connection drop. Never during the
  // initial content load or while viewing a read-only offline copy.
  if (!initialContentLoadedRef.current || readOnlyOfflineRef.current) return;
  const json = ed.getJSON();
  if (JSON.stringify(json) === lastSavedContentRef.current) return;
  if (id) saveLocalDraft(id, json, Date.now());
},
  });

  // ===== AI DETECTOR HIGHLIGHTS (ephemeral ProseMirror decorations) =====
  // Recompute highlight targets from the live lexicon + any flagged passages,
  // then push them to the decoration plugin. Never mutates the document.
  const refreshAiHighlights = useCallback(() => {
    if (!editor) return;
    if (!plagiarismHighlightsVisible) {
      editor.commands.clearAiHighlights();
      highlightMetaRef.current = {};
      setAiHighlightCounts({ word: 0, phrase: 0, passage: 0, structure: 0 });
      return;
    }
    const { targets, metaById, counts } = computeAiHighlights(
      editor,
      plagiarismReport?.flagged_passages,
      highlightFilters,
    );
    editor.commands.setAiHighlights(targets);
    highlightMetaRef.current = metaById;
    setAiHighlightCounts(counts);
  }, [editor, plagiarismReport, highlightFilters, plagiarismHighlightsVisible]);

  // Refresh when the report, filters, or visibility change.
  useEffect(() => { refreshAiHighlights(); }, [refreshAiHighlights]);

  // Live (debounced) re-detection of AI words/phrases as the user types.
  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      if (!liveDetect || !plagiarismHighlightsVisible) return;
      clearTimeout(timer);
      timer = setTimeout(() => refreshAiHighlights(), 300);
    };
    editor.on('update', handler);
    return () => { clearTimeout(timer); editor.off('update', handler); };
  }, [editor, liveDetect, plagiarismHighlightsVisible, refreshAiHighlights]);

  // Click a highlight → open the action popover.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('[data-ai-id]') as HTMLElement | null;
      if (!el) return;
      const id = el.getAttribute('data-ai-id');
      const meta = id ? highlightMetaRef.current[id] : null;
      if (meta) {
        setPopoverMeta(meta);
        setPopoverRect(el.getBoundingClientRect());
      }
    };
    dom.addEventListener('click', onClick);
    return () => dom.removeEventListener('click', onClick);
  }, [editor]);

  const toggleHighlightFilter = useCallback((cat: HighlightCategory) => {
    setHighlightFilters((f) => ({ ...f, [cat]: !f[cat] }));
  }, []);

  const handleSwapWord = useCallback((meta: HighlightMeta) => {
    if (!editor || !meta.swapText) return;
    editor.chain().focus().insertContentAt({ from: meta.from, to: meta.to }, meta.swapText).run();
    setPopoverMeta(null);
    setTimeout(() => refreshAiHighlights(), 50);
  }, [editor, refreshAiHighlights]);

  const handleHumanizeMeta = useCallback((meta: HighlightMeta) => {
    navigator.clipboard.writeText(meta.text).catch(() => {});
    setHumanizerOpen(true);
    setPopoverMeta(null);
    toast.success('Passage copied — select it in the editor then click Humanize');
  }, []);

  const decoder = useAssignmentDecoder({
    editor,
    documentId: id,
    onConfirmReplace: async () =>
      window.confirm('This will replace your current document content. Continue?'),
  });
// Clear decoder state when navigating to a different document
useEffect(() => {
  decoder.reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [id]);
  
  const { tipHistory } = useInlineAiSuggestion({
    editor,
    docType: doc?.doc_type,
    enabled: coachEnabled,
    assignmentContext: decoder.sessionContext || undefined,
    onLoadingStart: useCallback(() => { setCoachLoading(true); setCoachSuggestion(null); }, []),
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


// Inside the component, after the title state is declared:
usePageTitle(
  title || 'Untitled Document',
  `Editing "${title || 'Untitled Document'}" on RobAssister — AI writing assistant.`
);
  useEffect(() => {
    if (!id) return;
    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, content, doc_type, plagiarism_score, plagiarism_data, updated_at')
        .eq('id', id!)
        .single();

      if (error || !data) throw error ?? new Error('not found');

      // Online load succeeded — leave read-only offline mode and cache a copy
      // for offline reading/export later.
      setReadOnlyOffline(false);
      setOfflineLastDoc(null);
      editor?.setEditable(true);
      cacheDocument({
        id: data.id,
        title: data.title,
        content: data.content,
        doc_type: data.doc_type,
      });

      // Safety net: if a local backup is newer than the server's copy, offer to
      // restore it instead of silently overwriting either way.
      const serverMs = Date.parse(data.updated_at);
      if (!Number.isNaN(serverMs) && hasNewerDraft(id!, serverMs)) {
        const draft = getLocalDraft(id!);
        if (draft) setDraftPrompt({ backedUpAt: draft.backedUpAt });
      }

      setDoc(data);
      setTitle(data.title);
      lastUpdatedAtRef.current = data.updated_at;
      setLoading(false);
    } catch (err) {
      // Offline fallback: read from the local cache, in read-only mode.
      if (!navigator.onLine) {
        const cached = getCachedDocument(id!);
        if (cached) {
          setDoc({
            id: cached.id,
            title: cached.title,
            content: cached.content as Json,
            doc_type: cached.doc_type as DocType,
            plagiarism_score: null,
            plagiarism_data: null,
            updated_at: '',
          });
          setTitle(cached.title);
          setReadOnlyOffline(true);
          setLoading(false);
          return;
        }
        // No cache for this route, but we have a last-opened doc to offer.
        const last = getLastCachedDocument();
        if (last) {
          setOfflineLastDoc(last);
          setLoading(false);
          return;
        }
      }
      toast.error('Document not found');
      navigate('/dashboard');
    }
  };

  // Load content into editor once both editor and doc are ready
  useEffect(() => {
    if (!editor || !doc) return;
    docTypeRef.current = doc.doc_type;
    readOnlyOfflineRef.current = readOnlyOffline;
    // Suppress draft backups while we programmatically load the initial content.
    initialContentLoadedRef.current = false;

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
    // Offline copies are read-only; online copies are editable.
    editor.setEditable(!readOnlyOffline);
    // Baseline the just-loaded content so the first autosave doesn't snapshot
    // an unchanged document.
    lastSavedContentRef.current = JSON.stringify(editor.getJSON());
    lastSavedTitleRef.current = doc.title;
    conflictWarnedRef.current = false;
    // Baseline is set — genuine edits from here on may be backed up.
    initialContentLoadedRef.current = true;
  }, [editor, doc, readOnlyOffline]);

  const saveDocument = useCallback(async ({ manual = false }: { manual?: boolean } = {}) => {
    if (!id || !editor || !user) return;

    const content = editor.getJSON();
    const contentStr = JSON.stringify(content);

    // Skip no-op saves so the autosave timer doesn't pile up identical version
    // snapshots on an idle-but-open document.
    if (contentStr === lastSavedContentRef.current && title === lastSavedTitleRef.current) {
      if (manual) toast('Already up to date');
      return;
    }

    // Records a successful write: advance bookkeeping and snapshot a version.
    const finalizeSave = async (newUpdatedAt: string) => {
      lastUpdatedAtRef.current = newUpdatedAt;
      lastSavedContentRef.current = contentStr;
      lastSavedTitleRef.current = title;
      conflictWarnedRef.current = false;
      await supabase.from('document_versions').insert({
        document_id: id,
        user_id: user.id,
        title,
        content: content as unknown as Json,
      });
      localStorage.setItem(`rb_wc_${id}`, String(editor.storage.characterCount.words()));
      // Server now has the latest — the local backup is no longer needed.
      clearLocalDraft(id);
      // Also refresh the offline read cache with the just-saved content.
      cacheDocument({ id, title, content, doc_type: docTypeRef.current });
    };

    setSaving(true);

    // If we haven't loaded a timestamp yet the document is brand-new in this
    // session — skip optimistic-concurrency and do an unconditional first save.
    if (lastUpdatedAtRef.current === null) {
      const { data: fresh, error: freshErr } = await supabase
        .from('documents')
        .update({ title, content: content as unknown as Json })
        .eq('id', id)
        .select('updated_at')
        .maybeSingle();
      if (freshErr || !fresh) {
        toast.error('Failed to save');
        setSaving(false);
        return;
      }
      await finalizeSave(fresh.updated_at);
      if (manual) toast.success('Document saved!');
      setSaving(false);
      return;
    }

    // Optimistic concurrency: only overwrite if the row still matches the
    // version we last loaded/saved, so a copy open in another tab or device
    // isn't silently clobbered.
    const { data, error } = await supabase
      .from('documents')
      .update({ title, content: content as unknown as Json })
      .eq('id', id)
      .eq('updated_at', lastUpdatedAtRef.current)
      .select('updated_at')
      .maybeSingle();

    if (error) {
      toast.error('Failed to save');
      setSaving(false);
      return;
    }

    if (!data) {
      // No row matched our updated_at → the document changed elsewhere since we
      // loaded it.
      if (manual) {
        const overwrite = window.confirm(
          'This document was changed in another tab or device. Overwrite it with your current version?'
        );
        if (!overwrite) {
          toast('Save canceled — reload to get the latest version.');
          setSaving(false);
          return;
        }
        const { data: forced, error: forceErr } = await supabase
          .from('documents')
          .update({ title, content: content as unknown as Json })
          .eq('id', id)
          .select('updated_at')
          .maybeSingle();
        if (forceErr || !forced) {
          toast.error('Failed to save');
          setSaving(false);
          return;
        }
        await finalizeSave(forced.updated_at);
        toast.success('Document saved!');
        setSaving(false);
        return;
      }
      // Autosave must never silently clobber: warn once, then leave the text in
      // the editor untouched until the user saves manually or reloads.
      if (!conflictWarnedRef.current) {
        conflictWarnedRef.current = true;
        toast.error('This document changed elsewhere. Autosave paused — use Save to overwrite, or reload.');
      }
      setSaving(false);
      return;
    }

    await finalizeSave(data.updated_at);
    if (manual) toast.success('Document saved!');
    setSaving(false);
  }, [id, title, user, editor]);

  // Keep the latest save fn in a ref so the autosave interval can call it
  // without being recreated (and reset) every time the title changes.
  useEffect(() => {
    saveDocumentRef.current = saveDocument;
  }, [saveDocument]);

  const getSelectedText = useCallback((): string => {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  }, [editor]);

  const handleHumanize = useCallback(async () => {
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
  }, [getSelectedText, wordCountMode, presetWordCount, customWordCount, humanizerIntensity, doc]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDocumentRef.current?.({ manual: true });
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
  }, [handleHumanize, focusMode]);

  // Autosave — calls the latest save fn via ref so editing the title doesn't
  // restart the countdown.
  useEffect(() => {
    if (!settings.autosaveEnabled) return;
    const interval = setInterval(() => {
      if (editor && id) {
        saveDocumentRef.current?.({ manual: false });
      }
    }, settings.autosaveInterval * 1000);
    return () => clearInterval(interval);
  }, [id, settings.autosaveEnabled, settings.autosaveInterval, editor]);

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
      if (import.meta.env.DEV) console.error('PDF export error:', err);
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
      if (import.meta.env.DEV) console.error('DOCX export error:', err);
      toast.error('Failed to export DOCX');
    } finally {
      setExporting(false);
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

      if (error) {
        // supabase-js wraps non-2xx responses in a FunctionsHttpError whose
        // .message is generic; pull the function's own friendly message out of
        // the response body when it's there.
        let message = error.message;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.clone().json();
            if (body?.error) message = body.error;
          } catch { /* fall back to the generic message */ }
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      setPlagiarismReport(data);
      setPlagiarismHighlightsVisible(true);
      // Highlights are recomputed automatically by the refreshAiHighlights
      // effect when plagiarismReport changes (decoration overlay, not marks).

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

      toast.success(`AI analysis complete: ${data.overall_score}% AI-likelihood`);
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
          // Chat assistant only: opts into profile personalization server-side.
          // Decoder / coach / polish call the same function without this flag.
          personalize: true,
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
      const textDecoder = new TextDecoder();
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
        textBuffer += textDecoder.decode(value, { stream: true });

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
    const TOUR_KEY = 'rb_editor_tour_v4_done';
    if (localStorage.getItem(TOUR_KEY)) return;

    const timer = setTimeout(() => {
      const intro = introJs();
      intro.setOptions({
        steps: [
  {
    intro: "<strong>Welcome to your workspace 👋</strong><br/>Here's a 60-second tour of the editor and your AI writing tools. You can replay it anytime from Settings.",
  },
  {
    element: '[data-intro-id="editor-canvas"]',
    intro: '<strong>Writing Canvas</strong><br/>Click anywhere and start writing — placeholders disappear as you go. As you type, the <strong>AI Detector</strong> live-highlights AI-sounding words and phrases right here so you can spot them instantly.',
  },
  {
    element: '[data-intro-id="format-toolbar"]',
    intro: '<strong>Formatting & Fonts</strong><br/>Bold, italic, underline, headings, lists, and alignment — each lights up when your cursor is inside matching text. The font family and size dropdowns let you switch typeface and scale from 12 to 24.',
  },
  {
    element: '[data-intro-id="chat-btn"]',
    intro: '<strong>AI Chat</strong><br/>Ask your assistant anything. It already knows your document type and content — request rewrites, outlines, suggestions, or feedback.',
  },
  {
    element: '[data-intro-id="humanizer-btn"]',
    intro: '<strong>Humanizer</strong><br/>Select text, then humanize it at Subtle, Moderate, or Full intensity to make AI-generated writing sound naturally human.',
  },
  {
    element: '[data-intro-id="ai-detector-btn"]',
    intro: "<strong>AI Detector 🛰️</strong><br/>Get an AI-likelihood score and see AI words, phrases, and passages highlighted in your text. <strong>Click any highlight</strong> to see why it was flagged and fix it in place — swap a buzzword or humanize a passage. Filter by category in the panel.",
  },
  {
    element: '[data-intro-id="decoder-btn"]',
    intro: '<strong>Assignment Decoder</strong><br/>Paste your assignment question. The AI breaks it into a structured outline with per-section tips, and can draft each section for you to approve.',
  },
  {
    element: '[data-intro-id="polish-btn"]',
    intro: '<strong>Writing Polish</strong><br/>Clarity Check scans for weak sentences, passive voice, and wordy phrases. Smart Rewrite offers 3 alternatives for any selected text.',
  },
  {
    element: '[data-intro-id="coach-btn"]',
    intro: '<strong>Writing Coach</strong><br/>When on, a live tip appears below the paragraph you are writing whenever you pause. Toggle it on or off here.',
  },
  {
    element: '[data-intro-id="history-btn"]',
    intro: '<strong>Version History</strong><br/>Every save creates a restore point. Browse past versions and restore any of them with one click.',
  },
  {
    element: '[data-intro-id="focus-btn"]',
    intro: '<strong>Focus Mode</strong><br/>Hides every toolbar and panel — just you and the page. Press Esc or click again to return.',
  },
  {
    element: '[data-intro-id="settings-btn"]',
    intro: '<strong>Settings</strong><br/>Theme (Light / Dark / System), canvas width (A4 or full), line spacing, font defaults, and accessibility — plus a button to replay this tour anytime.',
  },
  {
    element: '[data-intro-id="export-btn"]',
    intro: '<strong>Export</strong><br/>Download your finished document as PDF or DOCX. Your default format is configurable in Settings.',
  },
  {
    element: '[data-intro-id="save-btn"]',
    intro: '<strong>Save</strong><br/>Click here or press Ctrl+S — every save also snapshots Version History, and autosave runs in the background. You are all set! 🎓',
  },
],
        showBullets: false,
        showProgress: true,
        exitOnOverlayClick: true,
        nextLabel: 'Next →',
        prevLabel: '← Back',
        doneLabel: "Let's Write! ✓",
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

  const activeSidebar = chatOpen ? 'chat' : humanizerOpen ? 'humanizer' : showPlagiarism ? 'plagiarism' : showHistory ? 'history' : showPolish ? 'polish' : showDecoder ? 'decoder' : null;

  const closeSidebar = () => {
    setChatOpen(false);
    setHumanizerOpen(false);
    setShowPlagiarism(false);
    setShowHistory(false);
    setShowPolish(false);
    setShowDecoder(false);
  };

  const openHistory = () => {
    setShowHistory(true);
    setChatOpen(false);
    setHumanizerOpen(false);
    setShowPlagiarism(false);
    setShowPolish(false);
    setShowDecoder(false);
  };

  const openPolish = () => {
    setShowPolish(true);
    setChatOpen(false);
    setHumanizerOpen(false);
    setShowPlagiarism(false);
    setShowHistory(false);
    setShowDecoder(false);
  };

  const openDecoder = () => {
    setShowDecoder(true);
    setChatOpen(false);
    setHumanizerOpen(false);
    setShowPlagiarism(false);
    setShowHistory(false);
    setShowPolish(false);
  };

  const lineHeight = lineSpacingOverride ?? (settings.lineSpacing === 'relaxed' ? 2.2 : 1.8);
  const canvasMaxW = settings.canvasWidth === 'full' ? 'max-w-none' : 'max-w-[816px] xl:max-w-[920px]';
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
            <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)} aria-label="Close sidebar">
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
                  {m.role === 'assistant' ? <ReactMarkdown skipHtml disallowedElements={['script', 'style', 'iframe']}>{m.content}</ReactMarkdown> : m.content}
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
            <Button variant="ghost" size="icon" onClick={() => setHumanizerOpen(false)} aria-label="Close sidebar">
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

      {/* AI Detector Sidebar */}
      {showPlagiarism && (
        <PlagiarismPanel
          report={plagiarismReport as any}
          running={plagiarismRunning}
          highlightsVisible={plagiarismHighlightsVisible}
          onRun={runPlagiarismCheck}
          onToggleHighlights={() => setPlagiarismHighlightsVisible(v => !v)}
          onClose={() => setShowPlagiarism(false)}
          filters={highlightFilters}
          counts={aiHighlightCounts}
          onToggleFilter={toggleHighlightFilter}
          liveDetect={liveDetect}
          onToggleLiveDetect={() => setLiveDetect(v => !v)}
         onHumanizePassage={(passage) => {
  setHumanizerOpen(true);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(passage).then(
      () => toast.success('Passage copied — select it in the editor then click Humanize'),
      () => toast('Open the Humanizer, then select this passage in the editor to humanize it'),
    );
  } else {
    toast('Open the Humanizer, then select this passage in the editor to humanize it');
  }
}}
/>
      )}

      {/* Click-to-act popover for AI highlights */}
      <AiHighlightPopover
        meta={popoverMeta}
        anchorRect={popoverRect}
        onClose={() => setPopoverMeta(null)}
        onSwap={handleSwapWord}
        onHumanize={handleHumanizeMeta}
      />

      {/* Version History Sidebar */}
      {showHistory && id && (
        <VersionHistoryPanel
          documentId={id}
          onRestore={(content, restoredTitle) => {
            if (editor) {
              if (content == null) {
                // Nothing to restore — leave the editor unchanged
                toast.error('This version has no content to restore.');
                return;
              }
              // content is stored as TipTap JSON object; fall back to HTML string
              try {
                const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                if (parsed && parsed.type === 'doc') {
                  editor.commands.setContent(parsed);
                } else {
                  editor.commands.setContent(content as string);
                }
              } catch {
                editor.commands.setContent(content as string);
              }
              setTitle(restoredTitle);
              setWordCount(editor.storage.characterCount.words());
            }
          }}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Polish Sidebar */}
      {showPolish && (
        <PolishPanel editor={editor} onClose={() => setShowPolish(false)} />
      )}

      {/* Assignment Decoder Sidebar */}
      {showDecoder && (
        <AssignmentDecoderPanel decoder={decoder} onClose={() => setShowDecoder(false)} />
      )}
    </div>
  );

  // ===== AI tool buttons =====
  const openChat = () => { setChatOpen(true); setHumanizerOpen(false); setShowPlagiarism(false); setShowHistory(false); setShowPolish(false); setShowDecoder(false); };
  const openHumanizer = () => { setHumanizerOpen(true); setChatOpen(false); setShowPlagiarism(false); setShowHistory(false); setShowPolish(false); setShowDecoder(false); };
  const openPlagiarism = () => { setShowPlagiarism(true); setChatOpen(false); setHumanizerOpen(false); setShowHistory(false); setShowPolish(false); setShowDecoder(false); };

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
            aria-label="AI Chat"
            data-intro-id="chat-btn"
            disabled={!online}
            title={!online ? 'Needs internet' : undefined}
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
            aria-label="Humanizer"
            data-intro-id="humanizer-btn"
            disabled={!online}
            title={!online ? 'Needs internet' : undefined}
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
            aria-label="AI Detector"
            data-intro-id="ai-detector-btn"
            disabled={!online}
            title={!online ? 'Needs internet' : undefined}
            className="scale-click"
          >
            <ShieldCheck className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">AI Detector</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={showPolish ? 'default' : 'ghost'}
            size="icon"
            onClick={() => toggleOrOpen(showPolish, openPolish, () => setShowPolish(false))}
            aria-label="Writing Polish"
            data-intro-id="polish-btn"
            disabled={!online}
            title={!online ? 'Needs internet' : undefined}
            className="scale-click"
          >
            <Wand2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Writing Polish</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-intro-id="decoder-btn"
            variant={showDecoder ? 'default' : 'ghost'}
            size="icon"
            onClick={() => toggleOrOpen(showDecoder, openDecoder, () => setShowDecoder(false))}
            aria-label="Assignment Decoder"
            disabled={!online}
            title={!online ? 'Needs internet' : undefined}
            className="scale-click"
          >
            <BookOpenCheck className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Assignment Decoder</TooltipContent>
      </Tooltip>
    </>
  );

  // ===== Formatting toolbar buttons =====
  const currentFontFamily = editor?.getAttributes('textStyle').fontFamily as string | undefined;
  const currentFontSize = editor?.getAttributes('textStyle').fontSize as string | undefined;
  const fontFamilyValue = FONT_FAMILY_OPTIONS.find(o => o.value === currentFontFamily)?.value ?? FONT_FAMILY_OPTIONS[0].value;
  const fontSizeValue = currentFontSize && FONT_SIZE_OPTIONS.includes(currentFontSize) ? currentFontSize : '16px';

  const selectClass = `h-7 bg-card border border-border rounded-md text-xs text-foreground px-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors ${isMobile ? 'max-w-[100px]' : 'max-w-[120px] w-[110px]'}`;

  // Font selects — rendered in horizontal bar on desktop, inline on mobile
const fontControls = editor ? (
  <>
    <select
      aria-label="Font family"
      title="Font family"
      value={fontFamilyValue}
      onChange={(e) => {
        if (!editor) return;
        editor.chain().focus().setFontFamily(e.target.value).run();
      }}
      className="h-10 bg-background border border-input rounded-md text-xs text-foreground px-2 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors w-[130px]"
    >
      {FONT_FAMILY_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>
          {opt.label}
        </option>
      ))}
    </select>
    <select
      aria-label="Font size"
      title="Font size"
      value={fontSizeValue}
      onChange={(e) => {
        if (!editor) return;
        editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run();
      }}
      className="h-10 bg-background border border-input rounded-md text-xs text-foreground px-2 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors w-[72px]"
    >
      {FONT_SIZE_OPTIONS.map(sz => (
        <option key={sz} value={sz}>{sz.replace('px', '')}</option>
      ))}
    </select>
    <select
      aria-label="Line spacing"
      title="Line spacing"
      value={String(lineHeight)}
      onChange={(e) => setLineSpacingOverride(parseFloat(e.target.value))}
      className="h-10 bg-background border border-input rounded-md text-xs text-foreground px-2 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors w-[88px]"
    >
      <option value="1.5">1.5 ×</option>
      <option value="1.8">1.8 ×</option>
      <option value="2">2.0 ×</option>
      <option value="2.2">2.2 ×</option>
    </select>
  </>
) : null;

// Icon buttons only — no selects here
const formatButtons = editor ? (
  <>
    {/* Vertical separator between the font dropdowns and the format icons —
        always a horizontal-layout context now (top bar on desktop, bottom bar
        on mobile), so the gap is horizontal. */}
    <div className="w-px h-6 bg-border mx-1 shrink-0" />
    <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" icon={<Bold className="w-4 h-4" />} active={editor.isActive('bold')} />
    <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" icon={<Italic className="w-4 h-4" />} active={editor.isActive('italic')} />
    <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline" icon={<Underline className="w-4 h-4" />} active={editor.isActive('underline')} />
    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1" icon={<Heading1 className="w-4 h-4" />} active={editor.isActive('heading', { level: 1 })} />
    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2" icon={<Heading2 className="w-4 h-4" />} active={editor.isActive('heading', { level: 2 })} />
    <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List" icon={<List className="w-4 h-4" />} active={editor.isActive('bulletList')} />
    <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List" icon={<ListOrdered className="w-4 h-4" />} active={editor.isActive('orderedList')} />
    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align Left" icon={<AlignLeft className="w-4 h-4" />} active={editor.isActive({ textAlign: 'left' })} />
    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align Center" icon={<AlignCenter className="w-4 h-4" />} active={editor.isActive({ textAlign: 'center' })} />
  </>
) : null;

  return (
    <div className={`h-screen bg-background flex flex-col overflow-hidden page-enter ${focusMode ? 'focus-mode' : ''}`}>
      {/* Top Bar */}
      <header className={`h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-3 gap-2 shrink-0 transition-opacity duration-500 ${focusMode ? 'opacity-0 hover:opacity-100 fixed top-0 left-0 right-0 z-50' : 'relative z-10'}`}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard" className="scale-click">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled document"
          aria-label="Document title"
          className="shrink-0 max-w-[160px] lg:max-w-[220px] bg-transparent text-foreground font-display font-semibold text-lg focus:outline-none truncate placeholder:text-muted-foreground/50 placeholder:italic placeholder:font-normal"
        />

        {/* Desktop: single consolidated format cluster — font dropdowns + format
            buttons live here in the one top bar (no separate left strip). Scrolls
            gracefully if the bar gets tight. */}
        {!isMobile && !focusMode ? (
          <div
            data-intro-id="format-toolbar"
            className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-dark px-1"
          >
            {fontControls}
            {formatButtons}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap font-mono">{wordCount} words</span>

        <OfflineBadge />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              data-intro-id="coach-btn"
              aria-label="Writing Coach"
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
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-[9999] min-w-[160px] animate-scale-in overflow-hidden">
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
            <Button variant="ghost" size="icon" onClick={openHistory} aria-label="Version history" data-intro-id="history-btn" className="scale-click">
              <History className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Version History</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setFocusMode(!focusMode)} aria-label={focusMode ? 'Exit focus mode' : 'Focus mode'} data-intro-id="focus-btn" className="scale-click">
              {focusMode ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{focusMode ? 'Exit Focus Mode' : 'Focus Mode'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Settings" data-intro-id="settings-btn" className="scale-click">
              <Settings className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>

        <Button onClick={() => saveDocument({ manual: true })} disabled={saving} size="sm" data-intro-id="save-btn" className="btn-glow" aria-label={saving ? 'Saving document' : 'Save document'}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="hidden sm:inline ml-1">Save</span>
        </Button>
      </header>

      {/* ── OFFLINE READ-ONLY NOTICE ── */}
      {readOnlyOffline && (
        <div className="shrink-0 border-b border-border bg-muted px-4 py-2 text-center text-xs text-muted-foreground">
          Viewing offline copy — reconnect to edit.
        </div>
      )}

      {/* ── OFFLINE LAST-DOCUMENT OFFER ── */}
      {offlineLastDoc && (
        <div className="shrink-0 border-b border-border bg-muted px-4 py-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="truncate">
            You're offline. Open your last document “{offlineLastDoc.title}”?
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs shrink-0"
            onClick={() => {
              const last = offlineLastDoc;
              setOfflineLastDoc(null);
              setReadOnlyOffline(true);
              setDoc({
                id: last.id,
                title: last.title,
                content: last.content as Json,
                doc_type: last.doc_type as DocType,
                plagiarism_score: null,
                plagiarism_data: null,
                updated_at: '',
              });
              setTitle(last.title);
            }}
          >
            Open
          </Button>
        </div>
      )}

      {/* ── UNSAVED LOCAL CHANGES (restore prompt) ── */}
      {draftPrompt && (
        <div className="shrink-0 border-b border-border bg-muted px-4 py-2 flex items-center justify-center gap-3 text-xs text-foreground">
          <span className="truncate">We found unsaved changes on this device — restore them?</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                const draft = id ? getLocalDraft(id) : null;
                if (draft && editor) editor.commands.setContent(draft.content as never);
                setDraftPrompt(null);
              }}
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                if (id) clearLocalDraft(id);
                setDraftPrompt(null);
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Main content area */}
      <div className={`flex flex-1 overflow-hidden ${focusMode ? 'pt-14' : ''}`}>
        {/* Editor Canvas */}
        <div data-editor-scroll className="relative flex-1 overflow-auto flex justify-center py-10 sm:py-14 lg:py-20 px-6 sm:px-12 lg:px-16 scrollbar-dark transition-colors duration-500 bg-editor-desk">
          <SectionTip activeSection={decoder.activeSection} outline={decoder.outline} />
            {loading ? (
  <div className="relative w-full max-w-[816px]">
    <div className="bg-editor-page shadow-page rounded-sm px-16 py-20">
      <div className="h-7 bg-muted rounded-md animate-pulse mb-10 w-1/2" />
      <div className="space-y-4">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="h-4 bg-muted rounded animate-pulse"
            style={{ width: `${90 - (i % 4) * 8}%`, animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
      <div className="h-6 bg-muted rounded-md animate-pulse mt-12 mb-6 w-1/3" />
      <div className="space-y-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-4 bg-muted rounded animate-pulse"
            style={{ width: `${88 - (i % 3) * 10}%`, animationDelay: `${(i + 12) * 60}ms` }}
          />
        ))}
      </div>
    </div>
  </div>
) : (
  <PagedCanvas
    maxWidth={focusMode ? 'max-w-[780px]' : canvasMaxW}
    data-intro-id="editor-canvas"
    style={{
      fontFamily: 'Georgia, serif',
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      lineHeight,
      fontSize: 'var(--editor-font-size)',
    }}
    onClick={() => { if (editor && !editor.isFocused) editor.commands.focus('end'); }}
  >
    <EditorContent
  editor={editor}
  className="w-full min-w-0 cursor-text"
  role="textbox"
  aria-label="Document editor"
  aria-multiline={true}
/>
  </PagedCanvas>
)}
          <InlineParagraphTip
            editor={editor}
            suggestion={coachSuggestion}
            loading={coachLoading}
            tipHistory={tipHistory}
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
            <div data-intro-id="ai-tools" className="w-12 border-l border-border bg-card/50 toolbar-glow flex flex-col items-center py-3 gap-1.5 shrink-0">
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
              <Button variant="outline" size="icon" onClick={() => setFocusMode(false)} aria-label="Exit focus mode" className="rounded-full shadow-lg bg-card/80 backdrop-blur-sm">
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
          {/* Row 2: Font dropdowns and format buttons — grouped separately so
              they breathe; the row scrolls horizontally rather than squishing. */}
          <div data-intro-id="format-toolbar" className="flex items-center gap-2 px-2 py-2 overflow-x-auto scrollbar-dark">
            <div className="flex items-center gap-1.5 shrink-0">
              {fontControls}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {formatButtons}
            </div>
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
