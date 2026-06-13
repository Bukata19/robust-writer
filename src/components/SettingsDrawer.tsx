import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  FileText,
  Timer,
  Eye,
  User,
  LogOut,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  useSettings,
  type ColorTheme,
  type FontSize,
  type CardDensity,
  type DocType,
  type HumanizerIntensity,
  type CanvasWidth,
  type LineSpacing,
  type AutosaveInterval,
  type ExportFormat,
  type ChatDefault,
  type ThemeMode,
} from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  OptionGroup,
  SectionHeader,
  ThemeChip,
  DARK_CHIPS,
  LIGHT_CHIPS,
} from '@/components/settings/parts';

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SectionId = 'appearance' | 'editor' | 'behaviour' | 'accessibility' | 'account';

interface SectionMeta {
  id: SectionId;
  title: string;
  icon: React.ReactNode;
}

const SECTIONS: SectionMeta[] = [
  { id: 'appearance', title: 'Appearance', icon: <Palette className="h-4 w-4" /> },
  { id: 'editor', title: 'Editor', icon: <FileText className="h-4 w-4" /> },
  { id: 'behaviour', title: 'Behaviour', icon: <Timer className="h-4 w-4" /> },
  { id: 'accessibility', title: 'Accessibility', icon: <Eye className="h-4 w-4" /> },
  { id: 'account', title: 'Account', icon: <User className="h-4 w-4" /> },
];

// A single labelled setting. `label` is shown and used for search matching.
interface Field {
  label: string;
  keywords?: string;
  render: () => React.ReactNode;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, onOpenChange }) => {
  const { settings, resolvedMode, updateSetting, resetSettings, setThemeMode } = useSettings();
  const { signOut, user } = useAuth();

  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState<SectionId>('appearance');

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    appearance: null,
    editor: null,
    behaviour: null,
    accessibility: null,
    account: null,
  });

  // Reset transient UI state each time the drawer is opened.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveSection('appearance');
    }
  }, [open]);

  const chips = resolvedMode === 'dark' ? DARK_CHIPS : LIGHT_CHIPS;

  const resetTour = useCallback(() => {
    localStorage.removeItem('rb_editor_tour_done');
    localStorage.removeItem('rb_editor_tour_v2_done');
    localStorage.removeItem('rb_editor_tour_v3_done');
    localStorage.removeItem('rb_editor_tour_v4_done');
    localStorage.removeItem('rb_dashboard_tour_done');
    localStorage.removeItem('rb_dashboard_tour_v2_done');
    localStorage.removeItem('rb_dashboard_tour_v3_done');
    onOpenChange(false);
    toast.success('Onboarding tour reset. Visit the dashboard to restart.');
  }, [onOpenChange]);

  const handleReset = () => {
    resetSettings();
    toast.success('Settings restored to defaults.');
  };

  const scrollToSection = useCallback((id: SectionId) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Highlight the section currently in view.
  useEffect(() => {
    if (!open || query) return;
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.getAttribute('data-section') as SectionId);
      },
      { root, rootMargin: '0px 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    SECTIONS.forEach((s) => {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [open, query]);

  // ── FIELD DEFINITIONS PER SECTION ──────────────────────────────────────────
  const fieldsBySection = useMemo<Record<SectionId, Field[]>>(() => ({
    appearance: [
      {
        label: 'Theme',
        keywords: 'mode dark light system colour color',
        render: () => (
          <OptionGroup label="Theme">
            <SegmentedControl<ThemeMode>
              aria-label="Theme mode"
              value={settings.themeMode}
              onChange={(v) => setThemeMode(v)}
              options={[
                { value: 'light', label: <span className="flex items-center justify-center gap-1"><Sun className="h-3.5 w-3.5" /> Light</span> },
                { value: 'dark', label: <span className="flex items-center justify-center gap-1"><Moon className="h-3.5 w-3.5" /> Dark</span> },
                { value: 'system', label: <span className="flex items-center justify-center gap-1"><Monitor className="h-3.5 w-3.5" /> System</span> },
              ]}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {chips.map((chip) => (
                <ThemeChip
                  key={chip.id}
                  config={chip}
                  isActive={settings.colorTheme === chip.id}
                  onSelect={() => updateSetting('colorTheme', chip.id as ColorTheme)}
                />
              ))}
            </div>
          </OptionGroup>
        ),
      },
      {
        label: 'Font Size',
        render: () => (
          <OptionGroup label="Font Size">
            <SegmentedControl<FontSize>
              value={settings.fontSize}
              onChange={(v) => updateSetting('fontSize', v)}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
            />
          </OptionGroup>
        ),
      },
      {
        label: 'Card Density',
        render: () => (
          <OptionGroup label="Card Density">
            <SegmentedControl<CardDensity>
              value={settings.cardDensity}
              onChange={(v) => updateSetting('cardDensity', v)}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Comfortable' },
              ]}
            />
          </OptionGroup>
        ),
      },
    ],
    editor: [
      {
        label: 'Default Document Type',
        render: () => (
          <OptionGroup label="Default Document Type">
            <SegmentedControl<DocType>
              value={settings.defaultDocType}
              onChange={(v) => updateSetting('defaultDocType', v)}
              options={[
                { value: 'essay', label: 'Essay' },
                { value: 'research_paper', label: 'Research' },
                { value: 'report', label: 'Report' },
                { value: 'general', label: 'General' },
              ]}
            />
          </OptionGroup>
        ),
      },
      {
        label: 'Humanizer Intensity',
        render: () => (
          <OptionGroup label="Humanizer Intensity">
            <SegmentedControl<HumanizerIntensity>
              value={settings.defaultHumanizerIntensity}
              onChange={(v) => updateSetting('defaultHumanizerIntensity', v)}
              options={[
                { value: 'subtle', label: 'Subtle' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'full', label: 'Full' },
              ]}
            />
          </OptionGroup>
        ),
      },
      {
        label: 'Canvas Width',
        render: () => (
          <OptionGroup label="Canvas Width">
            <SegmentedControl<CanvasWidth>
              value={settings.canvasWidth}
              onChange={(v) => updateSetting('canvasWidth', v)}
              options={[
                { value: 'a4', label: 'A4' },
                { value: 'full', label: 'Full Width' },
              ]}
            />
          </OptionGroup>
        ),
      },
      {
        label: 'Line Spacing',
        render: () => (
          <OptionGroup label="Line Spacing">
            <SegmentedControl<LineSpacing>
              value={settings.lineSpacing}
              onChange={(v) => updateSetting('lineSpacing', v)}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'relaxed', label: 'Relaxed' },
              ]}
            />
          </OptionGroup>
        ),
      },
    ],
    behaviour: [
      {
        label: 'Autosave',
        keywords: 'save interval',
        render: () => (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Autosave</span>
              <Switch
                checked={settings.autosaveEnabled}
                onCheckedChange={(v) => updateSetting('autosaveEnabled', v)}
              />
            </div>
            {settings.autosaveEnabled && (
              <OptionGroup label="Autosave Interval">
                <SegmentedControl<string>
                  value={String(settings.autosaveInterval)}
                  onChange={(v) => updateSetting('autosaveInterval', Number(v) as AutosaveInterval)}
                  options={[
                    { value: '30', label: '30s' },
                    { value: '60', label: '1 min' },
                    { value: '120', label: '2 min' },
                  ]}
                />
              </OptionGroup>
            )}
          </div>
        ),
      },
      {
        label: 'Default Export Format',
        render: () => (
          <OptionGroup label="Default Export Format">
            <SegmentedControl<ExportFormat>
              value={settings.defaultExportFormat}
              onChange={(v) => updateSetting('defaultExportFormat', v)}
              options={[
                { value: 'pdf', label: 'PDF' },
                { value: 'docx', label: 'DOCX' },
              ]}
            />
          </OptionGroup>
        ),
      },
      {
        label: 'Chat Panel Default',
        render: () => (
          <OptionGroup label="Chat Panel Default">
            <SegmentedControl<ChatDefault>
              value={settings.chatDefaultState}
              onChange={(v) => updateSetting('chatDefaultState', v)}
              options={[
                { value: 'closed', label: 'Closed' },
                { value: 'open', label: 'Open' },
              ]}
            />
          </OptionGroup>
        ),
      },
    ],
    accessibility: [
      {
        label: 'Reduce Motion',
        keywords: 'animation',
        render: () => (
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Reduce Motion</span>
            <Switch
              checked={settings.reduceMotion}
              onCheckedChange={(v) => updateSetting('reduceMotion', v)}
            />
          </div>
        ),
      },
      {
        label: 'High Contrast',
        render: () => (
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">High Contrast</span>
            <Switch
              checked={settings.highContrast}
              onCheckedChange={(v) => updateSetting('highContrast', v)}
            />
          </div>
        ),
      },
    ],
    account: [
      {
        label: 'Account',
        keywords: 'email sign out logout onboarding tour reset',
        render: () => (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Signed in as</p>
              <p className="truncate text-sm text-foreground">{user?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetTour} className="w-full">
              <RotateCcw className="mr-2 h-3 w-3" /> Reset Onboarding Tour
            </Button>
            <Button variant="destructive" size="sm" onClick={signOut} className="w-full">
              <LogOut className="mr-2 h-3 w-3" /> Sign Out
            </Button>
          </div>
        ),
      },
    ],
  }), [settings, resolvedMode, chips, updateSetting, setThemeMode, user, resetTour, signOut]);

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const matches = (field: Field) =>
    !isSearching ||
    field.label.toLowerCase().includes(normalizedQuery) ||
    (field.keywords?.toLowerCase().includes(normalizedQuery) ?? false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex w-[340px] flex-col p-0 sm:w-[420px]"
      >
        {/* ── STICKY HEADER ── */}
        <div className="shrink-0 border-b border-border p-4">
          <SheetTitle className="mb-3 font-display text-lg font-semibold text-foreground">
            Settings
          </SheetTitle>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings…"
                className="h-9 pl-8"
                aria-label="Search settings"
              />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This restores all appearance, editor, behaviour and accessibility settings to
                    their defaults. Your documents are not affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* ── SECTION RAIL ── */}
          {!isSearching && (
            <div className="mt-3 flex flex-wrap gap-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeSection === s.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {s.icon}
                  {s.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div ref={scrollRef} className="scrollbar-dark flex-1 overflow-y-auto p-4">
          {(() => {
            const visibleSections = SECTIONS.map((s) => ({
              ...s,
              fields: fieldsBySection[s.id].filter(matches),
            })).filter((s) => s.fields.length > 0);

            if (visibleSections.length === 0) {
              return (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No settings match “{query}”.
                </p>
              );
            }

            return visibleSections.map((s, idx) => (
              <div
                key={s.id}
                data-section={s.id}
                ref={(el) => (sectionRefs.current[s.id] = el)}
                className={idx > 0 ? 'mt-6' : ''}
              >
                {idx > 0 && <Separator className="mb-6" />}
                <SectionHeader icon={s.icon} title={s.title} />
                <div className="space-y-4">
                  {s.fields.map((f) => (
                    <React.Fragment key={f.label}>{f.render()}</React.Fragment>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SettingsDrawer;
