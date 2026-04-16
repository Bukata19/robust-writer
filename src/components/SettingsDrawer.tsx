import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Sun, Moon, Palette, Type, FileText, Timer, Eye, User, LogOut, RotateCcw } from 'lucide-react';
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
} from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── SHARED SUB-COMPONENTS (unchanged from original) ────────────────────────
const OptionGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
    {children}
  </div>
);

const OptionButtons: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: any) => void;
}> = ({ value, options, onChange }) => (
  <div className="flex gap-1 flex-wrap">
    {options.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
          value === opt.value
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-primary">{icon}</span>
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
  </div>
);

// ── THEME CHIP CONFIG ──────────────────────────────────────────────────────
// Crimson Dark red is used as the active selection ring per spec
const ACTIVE_RING = '#e05252';

interface ChipConfig {
  id: ColorTheme;
  label: string;
  bg: string;
  accent: string;
  surface: string;
}

const DARK_CHIPS: ChipConfig[] = [
  { id: 'deep-dark',      label: 'Deep Dark',     bg: '#080a0c', accent: '#00d4b8', surface: '#131b22' },
  { id: 'midnight-blue',  label: 'Midnight Blue',  bg: '#080e1e', accent: '#4da6ff', surface: '#10182e' },
  { id: 'forest-dark',    label: 'Forest Dark',    bg: '#070f08', accent: '#3dba6e', surface: '#0e1c10' },
  { id: 'crimson-dark',   label: 'Crimson Dark',   bg: '#0f0809', accent: '#e05252', surface: '#1e1012' },
];

const LIGHT_CHIPS: ChipConfig[] = [
  { id: 'ivory-mist',   label: 'Ivory Mist',   bg: '#f5f1e8', accent: '#1a8c7a', surface: '#ffffff' },
  { id: 'arctic-blue',  label: 'Arctic Blue',  bg: '#eaf2f8', accent: '#2563b0', surface: '#ffffff' },
  { id: 'sage-breeze',  label: 'Sage Breeze',  bg: '#eaf3ea', accent: '#2e7d4f', surface: '#ffffff' },
  { id: 'rose-petal',   label: 'Rose Petal',   bg: '#f8edf0', accent: '#c0385a', surface: '#ffffff' },
];

const ThemeChip: React.FC<{
  config: ChipConfig;
  isActive: boolean;
  onSelect: () => void;
}> = ({ config, isActive, onSelect }) => (
  <button
    onClick={onSelect}
    title={config.label}
    aria-pressed={isActive}
    className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 hover:scale-105 focus:outline-none w-full"
    style={{
      background: 'hsl(var(--muted))',
      border: `1px solid ${isActive ? ACTIVE_RING : 'hsl(var(--border))'}`,
      boxShadow: isActive ? `0 0 0 2px ${ACTIVE_RING}` : 'none',
    }}
  >
    {/* Colour preview swatch */}
    <div
      className="w-full h-5 rounded-md overflow-hidden flex"
      style={{ border: '1px solid rgba(128,128,128,0.15)' }}
    >
      <div style={{ background: config.bg, flex: 2 }} />
      <div style={{ background: config.accent, flex: 1 }} />
      <div style={{ background: config.surface, flex: 1 }} />
    </div>
    <span className="text-[10px] font-semibold leading-tight text-center text-muted-foreground">
      {config.label}
    </span>
  </button>
);

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, onOpenChange }) => {
  const { settings, updateSetting, toggleThemeMode } = useSettings();
  const { signOut, user } = useAuth();

  const isDark = settings.themeMode === 'dark';
  const chips = isDark ? DARK_CHIPS : LIGHT_CHIPS;

  const resetTour = () => {
    localStorage.removeItem('rb_editor_tour_done');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:w-[400px] overflow-y-auto scrollbar-dark p-0">
        <SheetHeader className="p-5 pb-3 border-b border-border">
          <SheetTitle className="text-foreground font-display">Settings</SheetTitle>
        </SheetHeader>

        <div className="p-5 space-y-6">

          {/* ── APPEARANCE ── */}
          <div>
            <SectionHeader icon={<Palette className="w-4 h-4" />} title="Appearance" />
            <div className="space-y-4">

              {/* Sun / Moon mode toggle */}
              <OptionGroup label="Mode">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleThemeMode}
                    aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring w-full justify-center"
                    style={{
                      background: 'hsl(var(--secondary))',
                      border: '1px solid hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    {isDark ? (
                      <>
                        <Moon className="w-3.5 h-3.5 text-primary" />
                        Dark Mode — click for Light
                      </>
                    ) : (
                      <>
                        <Sun className="w-3.5 h-3.5 text-primary" />
                        Light Mode — click for Dark
                      </>
                    )}
                  </button>
                </div>
              </OptionGroup>

              {/* Theme chips — 2 per row */}
              <OptionGroup label="Colour Theme">
                <div className="grid grid-cols-2 gap-2">
                  {chips.map(chip => (
                    <ThemeChip
                      key={chip.id}
                      config={chip}
                      isActive={settings.colorTheme === chip.id}
                      onSelect={() => updateSetting('colorTheme', chip.id)}
                    />
                  ))}
                </div>
              </OptionGroup>

              <OptionGroup label="Font Size">
                <OptionButtons
                  value={settings.fontSize}
                  options={[
                    { value: 'small', label: 'Small' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'large', label: 'Large' },
                  ]}
                  onChange={(v: FontSize) => updateSetting('fontSize', v)}
                />
              </OptionGroup>

              <OptionGroup label="Card Density">
                <OptionButtons
                  value={settings.cardDensity}
                  options={[
                    { value: 'compact', label: 'Compact' },
                    { value: 'comfortable', label: 'Comfortable' },
                  ]}
                  onChange={(v: CardDensity) => updateSetting('cardDensity', v)}
                />
              </OptionGroup>
            </div>
          </div>

          <Separator />

          {/* ── EDITOR DEFAULTS ── */}
          <div>
            <SectionHeader icon={<FileText className="w-4 h-4" />} title="Editor Defaults" />
            <div className="space-y-4">
              <OptionGroup label="Default Document Type">
                <OptionButtons
                  value={settings.defaultDocType}
                  options={[
                    { value: 'essay', label: 'Essay' },
                    { value: 'research_paper', label: 'Research' },
                    { value: 'report', label: 'Report' },
                    { value: 'general', label: 'General' },
                  ]}
                  onChange={(v: DocType) => updateSetting('defaultDocType', v)}
                />
              </OptionGroup>
              <OptionGroup label="Humanizer Intensity">
                <OptionButtons
                  value={settings.defaultHumanizerIntensity}
                  options={[
                    { value: 'subtle', label: 'Subtle' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'full', label: 'Full' },
                  ]}
                  onChange={(v: HumanizerIntensity) => updateSetting('defaultHumanizerIntensity', v)}
                />
              </OptionGroup>
              <OptionGroup label="Canvas Width">
                <OptionButtons
                  value={settings.canvasWidth}
                  options={[
                    { value: 'a4', label: 'A4' },
                    { value: 'full', label: 'Full Width' },
                  ]}
                  onChange={(v: CanvasWidth) => updateSetting('canvasWidth', v)}
                />
              </OptionGroup>
              <OptionGroup label="Line Spacing">
                <OptionButtons
                  value={settings.lineSpacing}
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'relaxed', label: 'Relaxed' },
                  ]}
                  onChange={(v: LineSpacing) => updateSetting('lineSpacing', v)}
                />
              </OptionGroup>
            </div>
          </div>

          <Separator />

          {/* ── BEHAVIOUR ── */}
          <div>
            <SectionHeader icon={<Timer className="w-4 h-4" />} title="Behaviour" />
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
                  <OptionButtons
                    value={String(settings.autosaveInterval)}
                    options={[
                      { value: '30', label: '30s' },
                      { value: '60', label: '1 min' },
                      { value: '120', label: '2 min' },
                    ]}
                    onChange={(v: string) => updateSetting('autosaveInterval', Number(v) as AutosaveInterval)}
                  />
                </OptionGroup>
              )}
              <OptionGroup label="Default Export Format">
                <OptionButtons
                  value={settings.defaultExportFormat}
                  options={[
                    { value: 'pdf', label: 'PDF' },
                    { value: 'docx', label: 'DOCX' },
                  ]}
                  onChange={(v: ExportFormat) => updateSetting('defaultExportFormat', v)}
                />
              </OptionGroup>
              <OptionGroup label="Chat Panel Default">
                <OptionButtons
                  value={settings.chatDefaultState}
                  options={[
                    { value: 'closed', label: 'Closed' },
                    { value: 'open', label: 'Open' },
                  ]}
                  onChange={(v: ChatDefault) => updateSetting('chatDefaultState', v)}
                />
              </OptionGroup>
            </div>
          </div>

          <Separator />

          {/* ── ACCESSIBILITY ── */}
          <div>
            <SectionHeader icon={<Eye className="w-4 h-4" />} title="Accessibility" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Reduce Motion</span>
                <Switch
                  checked={settings.reduceMotion}
                  onCheckedChange={(v) => updateSetting('reduceMotion', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">High Contrast</span>
                <Switch
                  checked={settings.highContrast}
                  onCheckedChange={(v) => updateSetting('highContrast', v)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── ACCOUNT ── */}
          <div>
            <SectionHeader icon={<User className="w-4 h-4" />} title="Account" />
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Signed in as</p>
                <p className="text-sm text-foreground truncate">{user?.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={resetTour} className="w-full">
                <RotateCcw className="w-3 h-3 mr-2" /> Reset Onboarding Tour
              </Button>
              <Button variant="destructive" size="sm" onClick={signOut} className="w-full">
                <LogOut className="w-3 h-3 mr-2" /> Sign Out
              </Button>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SettingsDrawer;
                    
