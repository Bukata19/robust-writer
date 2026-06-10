import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import introJs from 'intro.js';
import 'intro.js/introjs.css';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SettingsDrawer from '@/components/SettingsDrawer';
import InstallPrompt from '@/components/InstallPrompt';
import ImportDocumentButton from '@/components/ImportDocumentButton';
import {
  Plus, FileText, BookOpen, File, Terminal,
  Trash2, Clock, ShieldCheck, Settings, Bot,
  Search, Calendar, ArrowUpDown, SortAsc,
  ChevronRight, Pencil, Check, X,
} from 'lucide-react';

type DocType = 'essay' | 'research_paper' | 'report' | 'general';
type SortMode = 'recent' | 'alpha' | 'risk';

interface Document {
  id: string;
  title: string;
  doc_type: DocType;
  plagiarism_score: number | null;
  updated_at: string;
}

// ── HELPERS ────────────────────────────────────────────────────────────────

const docTypeConfig: Record<DocType, {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}> = {
  essay: {
    label: 'Essay',
    description: 'Arguments & analysis',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-primary',
  },
  research_paper: {
    label: 'Research Paper',
    description: 'Academic investigation',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'text-primary',
  },
  report: {
    label: 'Report',
    description: 'Findings & recommendations',
    icon: <File className="w-4 h-4" />,
    color: 'text-muted-foreground',
  },
  general: {
    label: 'General',
    description: 'Blank canvas',
    icon: <File className="w-4 h-4" />,
    color: 'text-muted-foreground',
  },
};

const getPlagiarismBadge = (score: number | null) => {
  if (score === null || score === 0) return null;
  if (score <= 15) return { label: `${score}% Clean`, className: 'bg-primary/20 text-primary' };
  if (score <= 40) return { label: `${score}% Warning`, className: 'bg-yellow-500/20 text-yellow-400' };
  return { label: `${score}% Risk`, className: 'bg-destructive/20 text-destructive' };
};

// Word count stored in localStorage by saveDocument in EditorPage
const getWordCount = (id: string): number | null => {
  const raw = localStorage.getItem(`rb_wc_${id}`);
  return raw ? parseInt(raw, 10) : null;
};

const formatWordCount = (count: number): string => {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k words`;
  return `${count} words`;
};

// Due date stored in localStorage
const getDueDate = (id: string): string | null =>
  localStorage.getItem(`rb_due_${id}`);

const saveDueDate = (id: string, date: string) => {
  if (date) {
    localStorage.setItem(`rb_due_${id}`, date);
  } else {
    localStorage.removeItem(`rb_due_${id}`);
  }
};

const getDueBadge = (id: string) => {
  const date = getDueDate(id);
  if (!date) return null;
  const days = Math.ceil(
    (new Date(date).setHours(23, 59, 59, 999) - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return { label: 'Overdue', className: 'bg-destructive/20 text-destructive border-destructive/30' };
  if (days === 0) return { label: 'Due today', className: 'bg-destructive/20 text-destructive border-destructive/30' };
  if (days <= 3) return { label: `Due in ${days}d`, className: 'bg-destructive/15 text-destructive border-destructive/20' };
  if (days <= 7) return { label: `Due in ${days}d`, className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' };
  return { label: `${days} days`, className: 'bg-primary/10 text-primary border-primary/20' };
};

const timeAgo = (dateStr: string): string => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

// ── COMPONENT ──────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  usePageTitle(
    'Dashboard',
    'Manage your documents on RobAssister — create essays, research papers, reports and more with AI assistance.'
  );

  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DocType | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortMode>('recent');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);


  // Force re-render when due dates change
  const [dueDateTick, setDueDateTick] = useState(0);

  useEffect(() => { fetchDocuments(); }, []);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Onboarding tour
  useEffect(() => {
    const TOUR_KEY = 'rb_dashboard_tour_v2_done';
    if (localStorage.getItem(TOUR_KEY)) return;
    const timer = setTimeout(() => {
      const intro = introJs();
      intro.setOptions({
        steps: [
          { intro: 'Welcome to RobAssister! 👋 This quick tour shows you around.' },
          {
            element: '[data-intro-id="new-doc-grid"]',
            intro: '<strong>📝 Essay</strong><br/>For arguments, analysis, and reflective writing. Comes with Introduction, Body Paragraphs, and Conclusion sections already set up.',
          },
          {
            element: '[data-intro-id="new-doc-grid"]',
            intro: '<strong>🔬 Research Paper</strong><br/>For academic research. Includes Abstract, Introduction, Literature Review, Methodology, Results, Discussion, Conclusion, and References.',
          },
          {
            element: '[data-intro-id="new-doc-grid"]',
            intro: '<strong>📊 Report</strong><br/>For professional and academic reports. Structured around Executive Summary, Findings, and Recommendations.',
          },
          {
            element: '[data-intro-id="new-doc-grid"]',
            intro: '<strong>📄 General</strong><br/>A blank canvas. Use this for notes, letters, or anything that does not fit the other types.',
          },
          {
            element: '[data-intro-id="import-btn"]',
            intro: '<strong>Import a File</strong><br/>Import a .txt, .md, or .docx file directly from your device and continue editing here.',
          },
          {
            element: '[data-intro-id="settings-btn"]',
            intro: '<strong>Settings</strong><br/>Change your theme, font size, autosave interval, and accessibility options here.',
          },
        ],
        showBullets: false,
        showProgress: true,
        exitOnOverlayClick: true,
        nextLabel: 'Next →',
        prevLabel: '← Back',
        doneLabel: 'Start Writing',
      });
      intro.oncomplete(() => localStorage.setItem(TOUR_KEY, 'true'));
      intro.onexit(() => localStorage.setItem(TOUR_KEY, 'true'));
      intro.start();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, doc_type, plagiarism_score, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      toast.error('Failed to load documents');
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  const createDocument = async (docType: DocType) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('documents')
      .insert({ user_id: user.id, doc_type: docType, title: 'Untitled Document' })
      .select('id')
      .single();

    if (error) {
      toast.error('Failed to create document');
    } else if (data) {
      navigate(`/editor/${data.id}`);
    }
  };

  const deleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      localStorage.removeItem(`rb_wc_${id}`);
      localStorage.removeItem(`rb_due_${id}`);
      toast.success('Document deleted');
    }
  };

  const startRename = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(doc.id);
    setRenameValue(doc.title);
  };

  const submitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    const { error } = await supabase
      .from('documents')
      .update({ title: trimmed })
      .eq('id', id);
    if (error) {
      toast.error('Failed to rename');
    } else {
      setDocuments((prev) =>
        prev.map((d) => d.id === id ? { ...d, title: trimmed } : d)
      );
    }
    setRenamingId(null);
  };

  const cancelRename = () => setRenamingId(null);

  const handleDueDateChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
  e.stopPropagation();
  saveDueDate(id, e.target.value);
  setDueDateTick((t) => t + 1);
};

  // Sort + filter
  const filteredDocuments = documents
    .filter((doc) => {
      const matchSearch = doc.title.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === 'all' || doc.doc_type === filterType;
      return matchSearch && matchType;
    })
    .sort((a, b) => {
      if (sortBy === 'alpha') return a.title.localeCompare(b.title);
      if (sortBy === 'risk') return (b.plagiarism_score ?? 0) - (a.plagiarism_score ?? 0);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const isCompact = settings.cardDensity === 'compact';
  const mostRecent = documents[0] ?? null;

  return (
    <div className="min-h-screen bg-background page-enter">

      {/* ── HEADER ── */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md">
              <Terminal className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground text-lg tracking-tight">
              RobAssister
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              data-intro-id="settings-btn"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* ── HERO ── */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-hero mb-1">
            Your Assignment Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Create, edit, and polish your documents with AI
          </p>
        </div>

        {/* ── CONTINUE WRITING ── */}
        {mostRecent && !loading && (
          <div
            onClick={() => navigate(`/editor/${mostRecent.id}`)}
            className="mb-6 flex items-center justify-between gap-4 bg-card border border-primary/30 rounded-xl p-4 cursor-pointer hover:border-primary/60 transition-all group shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-primary uppercase tracking-widest mb-1">
                Continue Writing
              </p>
              <p className="font-semibold text-foreground truncate text-sm">
                {mostRecent.title}
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[11px] text-muted-foreground">
                  {docTypeConfig[mostRecent.doc_type].label}
                </span>
                {getWordCount(mostRecent.id) !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    {formatWordCount(getWordCount(mostRecent.id)!)}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(mostRecent.updated_at)}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}

        {/* ── NEW DOCUMENT ── */}
        <div className="mb-6">
          <h2 className="text-base font-display font-semibold text-foreground mb-3">
            New Document
          </h2>
          <div
            data-intro-id="new-doc-grid"
            className="grid grid-cols-2 md:grid-cols-4 gap-2.5"
          >
            {(['essay', 'research_paper', 'report', 'general'] as DocType[]).map((type) => {
              const config = docTypeConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => createDocument(type)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-all group card-hover-glow btn-glow text-center"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-foreground leading-tight">
                    {config.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
                    {config.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div data-intro-id="import-btn" className="mt-2.5">
            <ImportDocumentButton onImported={fetchDocuments} />
          </div>
        </div>

        {/* ── DOCUMENTS SECTION ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-display font-semibold text-foreground">
              Your Documents
              {documents.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({documents.length})
                </span>
              )}
            </h2>

            {/* Sort buttons */}
            <div className="flex items-center gap-1">
              {([
                { key: 'recent', icon: <Clock className="w-3 h-3" />, label: 'Recent' },
                { key: 'alpha', icon: <SortAsc className="w-3 h-3" />, label: 'A–Z' },
                { key: 'risk', icon: <ShieldCheck className="w-3 h-3" />, label: 'Risk' },
              ] as const).map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  title={`Sort by ${label}`}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    sortBy === key
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-border'
                  }`}
                >
                  {icon}
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search + filter — sticky on mobile */}
          <div className="flex gap-2 mb-4 flex-wrap sticky top-14 z-[5] bg-background py-2 -mx-4 px-4 sm:static sm:bg-transparent sm:py-0 sm:mx-0 sm:px-0">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'essay', 'research_paper', 'report', 'general'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    filterType === type
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                  }`}
                >
                  {type === 'all' ? 'All'
                    : type === 'research_paper' ? 'Research'
                    : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Document grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-xl skeleton-shimmer" />
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="bounce-gentle inline-block mb-4">
                <Bot className="w-16 h-16 mx-auto text-primary/40" />
              </div>
              <p className="text-lg font-medium text-foreground mb-1">
                {search || filterType !== 'all' ? 'No matches found' : 'No documents yet'}
              </p>
              <p className="text-sm text-muted-foreground">
                {search || filterType !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Create your first document above to get started!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc) => {
                const config = docTypeConfig[doc.doc_type];
                const plagBadge = getPlagiarismBadge(doc.plagiarism_score);
                const dueBadge = getDueBadge(doc.id);
                const wc = getWordCount(doc.id);
                const dueDate = getDueDate(doc.id) ?? '';
                const isRenaming = renamingId === doc.id;

                return (
                  <div
                    key={doc.id}
                    onClick={() => !isRenaming && navigate(`/editor/${doc.id}`)}
                    className={`bg-card border border-border rounded-xl ${isCompact ? 'p-3' : 'p-4'} card-hover-glow cursor-pointer group animate-fade-in transition-all`}
                  >
                    {/* Top row: type + actions */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className={config.color}>{config.icon}</span>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Rename button */}
                        <button
                          onClick={(e) => startRename(doc, e)}
                          aria-label="Rename document"
                          className="p-1 hover:text-primary rounded transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* Due date picker — label triggers input natively on all browsers */}
                        <label
                          htmlFor={`due-${doc.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:text-primary rounded transition-colors cursor-pointer"
                          aria-label="Set due date"
                          title="Set due date"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <input
                            id={`due-${doc.id}`}
                            type="date"
                            value={dueDate}
                            min={new Date().toISOString().split('T')[0]}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleDueDateChange(doc.id, e)}
                            className="sr-only"
                            tabIndex={-1}
                          />
                        </label>
                        {/* Delete button */}
                        <button
                          onClick={(e) => deleteDocument(doc.id, e)}
                          aria-label="Delete document"
                          className="p-1 hover:text-destructive rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title — inline rename */}
                    {isRenaming ? (
                      <div
                        className="flex items-center gap-1 mb-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename(doc.id);
                            if (e.key === 'Escape') cancelRename();
                          }}
                          onBlur={() => submitRename(doc.id)}
                          className="flex-1 min-w-0 bg-background border border-primary/40 rounded-md px-2 py-1 text-sm text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          onMouseDown={(e) => { e.preventDefault(); submitRename(doc.id); }}
                          className="p-1 text-primary hover:text-primary/80"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h3
                        className="font-medium text-foreground mb-2 truncate text-sm"
                        onDoubleClick={(e) => startRename(doc, e)}
                        title="Double-click to rename"
                      >
                        {doc.title}
                      </h3>
                    )}

                    {/* Bottom row: date + word count + badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(doc.updated_at)}
                        </span>
                        {wc !== null && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatWordCount(wc)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {dueBadge && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${dueBadge.className}`}>
                            {dueBadge.label}
                          </span>
                        )}
                        {plagBadge && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${plagBadge.className}`}>
                            <ShieldCheck className="w-2.5 h-2.5" />
                            {plagBadge.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <InstallPrompt />
    </div>
  );
};

export default Dashboard;
