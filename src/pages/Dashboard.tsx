import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { useIntroTour, DASHBOARD_TOUR_KEY } from '@/hooks/useIntroTour';
import { hasUnseenUpdate } from '@/data/whatsNew';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SettingsDrawer from '@/components/SettingsDrawer';
import InstallPrompt from '@/components/InstallPrompt';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import OfflineBadge from '@/components/OfflineBadge';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import ImportDocumentButton from '@/components/ImportDocumentButton';
import { Logo } from '@/components/Logo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  FileText, BookOpen, ClipboardList, PenLine,
  Trash2, Clock, Settings, Bot,
  Search, Calendar, SortAsc,
  ChevronRight, Pencil, Check, X,
  LogOut, Sparkles, FileStack, AlarmClock, Plus,
  Home, FolderOpen, Wrench,
} from 'lucide-react';
import StandaloneHumanizer from '@/components/StandaloneHumanizer';

type DocType = 'essay' | 'research_paper' | 'report' | 'general';

// Static tab chrome config — module scope so it isn't reallocated per render.
const TABS = [
  { id: 'home' as const, label: 'Home', icon: Home },
  { id: 'library' as const, label: 'Library', icon: FolderOpen },
  { id: 'tools' as const, label: 'Tools', icon: Wrench },
];
type SortMode = 'recent' | 'alpha';

interface Document {
  id: string;
  title: string;
  doc_type: DocType;
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
    icon: <ClipboardList className="w-4 h-4" />,
    color: 'text-muted-foreground',
  },
  general: {
    label: 'General',
    description: 'Blank canvas',
    icon: <PenLine className="w-4 h-4" />,
    color: 'text-muted-foreground',
  },
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

  const { user, signOut, profile, profileResolved } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const online = useOnlineStatus();

  // Onboarding: auto-show once per session while incomplete; a dismissible
  // banner offers the way back in afterwards.
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem('rb_onboarding_banner_dismissed') === 'true'
  );

  useEffect(() => {
    if (!profile || profile.onboarding_completed) return;
    if (sessionStorage.getItem('rb_onboarding_autoshown') === 'true') return;
    sessionStorage.setItem('rb_onboarding_autoshown', 'true');
    setOnboardingOpen(true);
  }, [profile]);

  const dismissBanner = () => {
    sessionStorage.setItem('rb_onboarding_banner_dismissed', 'true');
    setBannerDismissed(true);
  };

  const showOnboardingBanner =
    !!profile && !profile.onboarding_completed && !onboardingOpen && !bannerDismissed;

  // Tab view-state only — no routes, no URLs. Home = create/continue,
  // Library = browse/manage. One shared component tree; the inactive tab's
  // content is conditionally unrendered (state lives here, so it survives).
  const [activeTab, setActiveTab] = useState<'home' | 'library' | 'tools'>('home');


  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DocType | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortMode>('recent');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Passive "What's New" dot on the settings gear. Re-checked whenever the
  // drawer closes so viewing the What's New section clears it without a
  // reload; the initial useState read covers cross-page marking too.
  const [unseenUpdate, setUnseenUpdate] = useState(hasUnseenUpdate);
  useEffect(() => {
    if (!settingsOpen) setUnseenUpdate(hasUnseenUpdate());
  }, [settingsOpen]);

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

  // Onboarding tour — sequenced strictly AFTER the personalization modal so
  // the two overlays can never stack. It waits until onboarding is resolved
  // (completed or skipped — Skip also sets onboarding_completed) and the
  // modal is closed. Esc-closing the modal leaves onboarding unresolved,
  // which keeps the tour suppressed until it is finished or skipped.
  // If the profile load settles WITHOUT a profile (fetch failed after
  // retries), fall back to the pre-gate behavior and allow the tour — a
  // broken profiles fetch must not erase every onboarding surface.
  useIntroTour({
    storageKey: DASHBOARD_TOUR_KEY,
    // activeTab gate: the tour's new-doc-grid / import-btn targets are only
    // mounted on the Home tab. Switching to Library mid-tour tears the tour
    // down cleanly (hook cleanup) without writing the done-key, and it
    // re-offers when the user returns to Home.
    enabled:
      profileResolved &&
      !onboardingOpen &&
      activeTab === 'home' &&
      (profile ? !!profile.onboarding_completed : true),
    doneLabel: 'Start Writing',
    steps: [
      { intro: 'Welcome to RobAssister! 👋 A quick 30-second tour of your dashboard.' },
      {
        element: '[data-intro-id="new-doc-grid"]',
        intro: '<strong>Start a new document</strong><br/>Pick a type to begin — <strong>Essay</strong>, <strong>Research Paper</strong>, <strong>Report</strong>, or <strong>General</strong>. Each comes pre-structured with the right sections (the General type is a blank canvas).',
      },
      {
        element: '[data-intro-id="import-btn"]',
        intro: '<strong>Import a file</strong><br/>Bring in a .txt, .md, or .docx file from your device and keep editing it here.',
      },
      {
        element: '[data-intro-id="settings-btn"]',
        intro: '<strong>Settings</strong><br/>Theme (Light / Dark / System), font and canvas defaults, autosave, and accessibility — and you can replay this tour anytime from here.',
      },
    ],
  });

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, doc_type, updated_at')
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
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const isCompact = settings.cardDensity === 'compact';
  const mostRecent = documents[0] ?? null;

  // ── Derived view data (presentation only) ──
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const rawName = user?.email?.split('@')[0] ?? 'there';
  const emailName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const displayName = profile?.display_name?.trim() || emailName;
  const initial = displayName.charAt(0).toUpperCase();

  // Stats glance — reads only existing state. `dueDateTick` keeps due-soon fresh.
  void dueDateTick;
  const dueSoonCount = documents.filter((d) => {
    const date = getDueDate(d.id);
    if (!date) return false;
    const days = Math.ceil(
      (new Date(date).setHours(23, 59, 59, 999) - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days <= 7;
  }).length;
  const totalWords = documents.reduce((sum, d) => sum + (getWordCount(d.id) ?? 0), 0);

  const statChips = [
    { icon: <FileStack className="w-3.5 h-3.5" />, value: documents.length, label: 'Documents' },
    { icon: <AlarmClock className="w-3.5 h-3.5" />, value: dueSoonCount, label: 'Due soon' },
    { icon: <PenLine className="w-3.5 h-3.5" />, value: totalWords >= 1000 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords, label: 'Words written' },
  ];

  return (
    <div className="min-h-screen bg-background page-enter">

      {/* ── HEADER ── */}
      <header className="glass-panel border-b border-border sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-1.5">
            <OfflineBadge />
            <Button
              variant="ghost" size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label={unseenUpdate ? 'Settings — updates available' : 'Settings'}
              data-intro-id="settings-btn"
              className="relative"
            >
              <Settings className="w-4 h-4" />
              {/* Passive what's-new dot — informational (primary, not
                  destructive), ringed with the card color to separate it from
                  the glass header. The ping twin is gated on BOTH motion
                  systems: the in-app toggle unmounts it, motion-reduce hides
                  it (the 0.01ms .reduce-motion rule can't silence an infinite
                  loop). */}
              {unseenUpdate && (
                <span aria-hidden="true" className="absolute top-1 right-1 flex h-2 w-2">
                  {!settings.reduceMotion && (
                    <span className="motion-reduce:hidden absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                  )}
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
                </span>
              )}
            </Button>

            {/* Account menu — gives a sign-out path that was previously missing */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Account menu"
                className="focus-ring rounded-full transition-transform hover:scale-105 active:scale-95"
              >
                <Avatar className="w-8 h-8 border border-primary/40">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground truncate">
                    {user?.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── DESKTOP TAB NAV — same activeTab state as the mobile bottom bar;
             only the chrome differs by breakpoint. Segmented-control styling
             matches the app's existing sort control. ── */}
      <nav
        aria-label="Dashboard sections"
        className="hidden sm:block sticky top-14 z-10 glass-panel border-b border-border"
      >
        <div className="max-w-6xl mx-auto px-4 py-2">
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-secondary/60 border border-border">
            {TABS.map(({ id, label, icon: TabIcon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`focus-ring flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 pt-6 sm:pt-8 pb-24 sm:pb-8">

        {/* ── ONBOARDING RETRIGGER BANNER ── */}
        {showOnboardingBanner && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
            <p className="min-w-0 truncate text-xs sm:text-sm text-foreground">
              <Sparkles className="mr-1.5 inline-block h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Finish setting up your profile to personalize your AI chat.
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                onClick={() => setOnboardingOpen(true)}
                className="h-7 px-2.5 text-xs"
              >
                Finish setup
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismissBanner}
                aria-label="Dismiss profile setup banner"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ══ HOME TAB — create & continue ══ */}
        {activeTab === 'home' && (
        <div className="animate-fade-in">

        {/* ── GREETING ── */}
        <div className="mb-7">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {greeting}
          </p>
          <h1 className="t-page-title">
            <span className="gradient-hero">{displayName}</span>
          </h1>
        </div>

        {/* ── CONTINUE WRITING ── */}
        {mostRecent && !loading && (
          <button
            onClick={() => navigate(`/editor/${mostRecent.id}`)}
            className="focus-ring relative overflow-hidden w-full text-left mb-7 flex items-center justify-between gap-4 rounded-xl p-4 sm:p-5 cursor-pointer transition-all group border border-primary/30 hover:border-primary/60 bg-gradient-to-r from-primary/10 via-primary/[0.04] to-transparent hover:shadow-glow"
          >
            <div className="min-w-0 flex-1 relative z-10">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <PenLine className="w-3 h-3" />
                Continue writing
              </p>
              <p className="font-semibold text-foreground truncate text-base">
                {mostRecent.title}
              </p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {docTypeConfig[mostRecent.doc_type].icon}
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
            <span className="relative z-10 shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary/15 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>
        )}

        {/* ── NEW DOCUMENT ── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-primary" />
            <h2 className="t-section">New document</h2>
          </div>
          <div
            data-intro-id="new-doc-grid"
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {(['essay', 'research_paper', 'report', 'general'] as DocType[]).map((type) => {
              const config = docTypeConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => createDocument(type)}
                  disabled={!online}
                  title={!online ? 'Needs internet' : undefined}
                  className="group surface-card card-hover-glow focus-ring flex flex-col items-start gap-3 p-4 text-left transition-all hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary group-hover:from-primary group-hover:to-primary group-hover:text-primary-foreground transition-all shrink-0 group-hover:scale-105">
                    {config.icon}
                  </div>
                  <div className="min-w-0 w-full">
                    <span className="block t-card-title leading-tight">
                      {config.label}
                    </span>
                    <span className="block text-xs text-muted-foreground leading-tight truncate">
                      {config.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div data-intro-id="import-btn" className="mt-3">
            <ImportDocumentButton onImported={fetchDocuments} disabled={!online} />
          </div>

          {/* Library discovery nudge */}
          <button
            onClick={() => setActiveTab('library')}
            className="focus-ring mt-3 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Your documents live in <span className="font-medium">Library</span> →
          </button>
        </div>

        </div>
        )}

        {/* ══ LIBRARY TAB — browse & manage ══ */}
        {activeTab === 'library' && (
        <div className="animate-fade-in">

        {/* ── STATS GLANCE ── */}
        <div className="mb-5 flex items-center gap-2.5">
          {statChips.map(({ icon, value, label }) => (
            <div
              key={label}
              className="surface-card flex flex-1 sm:flex-initial flex-col items-center justify-center gap-0.5 px-4 py-2.5 min-w-[78px]"
            >
              <span className="flex items-center gap-1 text-primary">
                {icon}
                <span className="text-lg font-display font-bold leading-none">{value}</span>
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── DOCUMENTS SECTION ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileStack className="w-4 h-4 text-primary" />
              <h2 className="t-section">
                Your documents
                {documents.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {documents.length}
                  </span>
                )}
              </h2>
            </div>

            {/* Sort segmented control */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-secondary/60 border border-border">
              {([
                { key: 'recent', icon: <Clock className="w-3 h-3" />, label: 'Recent' },
                { key: 'alpha', icon: <SortAsc className="w-3 h-3" />, label: 'A–Z' },
              ] as const).map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  title={`Sort by ${label}`}
                  aria-pressed={sortBy === key}
                  className={`focus-ring flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    sortBy === key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {icon}
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search + filter — sticky on mobile */}
          <div className="flex gap-2 mb-4 flex-wrap sticky top-14 z-[5] bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4 sm:static sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:mx-0 sm:px-0">
            <div className="relative flex-1 min-w-[160px] focus-glow rounded-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-shadow"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'essay', 'research_paper', 'report', 'general'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`focus-ring px-3 py-2 text-xs font-medium rounded-lg transition-all ${
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
                const dueBadge = getDueBadge(doc.id);
                const wc = getWordCount(doc.id);
                const dueDate = getDueDate(doc.id) ?? '';
                const isRenaming = renamingId === doc.id;

                return (
                  <div
                    key={doc.id}
                    onClick={() => !isRenaming && navigate(`/editor/${doc.id}`)}
                    className={`surface-card ${isCompact ? 'p-3' : 'p-4'} card-hover-glow cursor-pointer group animate-fade-in transition-all hover:border-primary/40`}
                  >
                    {/* Top row: type + actions */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 pl-1.5 pr-2.5 py-1">
                        <span className={config.color}>{config.icon}</span>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {config.label}
                        </span>
                      </span>
                      {/* Always visible on touch; reveal on hover for pointer devices */}
                      <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                        {/* Rename button */}
                        <button
                          onClick={(e) => startRename(doc, e)}
                          aria-label="Rename document"
                          className="focus-ring p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* Due date picker — label triggers input natively on all browsers */}
                        <label
                          htmlFor={`due-${doc.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="relative p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                          aria-label="Set due date"
                          title="Set due date"
                        >
                          <Calendar className="w-3.5 h-3.5 relative z-10 pointer-events-none" />
                          <input
                            id={`due-${doc.id}`}
                            type="date"
                            value={dueDate}
                            min={new Date().toISOString().split('T')[0]}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleDueDateChange(doc.id, e)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            tabIndex={-1}
                          />
                        </label>
                        {/* Delete button */}
                        <button
                          onClick={(e) => deleteDocument(doc.id, e)}
                          aria-label="Delete document"
                          className="focus-ring p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
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
                          aria-label="Confirm rename"
                          onMouseDown={(e) => { e.preventDefault(); submitRename(doc.id); }}
                          className="p-1 text-primary hover:text-primary/80"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          aria-label="Cancel rename"
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
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        </div>
        )}

        {/* ══ TOOLS TAB — standalone AI utilities (no document required) ══ */}
        {activeTab === 'tools' && (
          <div className="animate-fade-in">
            <StandaloneHumanizer />
          </div>
        )}
      </main>

      {/* ── MOBILE BOTTOM TAB BAR — same activeTab state as the desktop nav.
             glass-panel matches the header so the chrome reads as one system;
             safe-area padding clears iOS home indicators. ── */}
      <nav
        aria-label="Dashboard sections"
        className="sm:hidden fixed bottom-0 inset-x-0 z-20 glass-panel border-t border-border safe-area-bottom"
      >
        <div className="flex h-14">
          {TABS.map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`focus-ring relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeTab === id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {/* Active indicator riding the top border */}
              {activeTab === id && (
                <span aria-hidden="true" className="absolute top-0 inset-x-6 h-0.5 rounded-full bg-primary" />
              )}
              <TabIcon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <OnboardingModal open={onboardingOpen} onOpenChange={setOnboardingOpen} />
      <InstallPrompt />
    </div>
  );
};

export default Dashboard;
