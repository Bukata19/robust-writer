import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useSettings, type ColorTheme, type FontSize, type CardDensity, type DocType, type HumanizerIntensity, type CanvasWidth, type LineSpacing, type AutosaveInterval, type ExportFormat, type ChatDefault, type ThemeMode } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Palette, FileText, Timer, Eye, User, LogOut, RotateCcw, Sun, Moon } from 'lucide-react';

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OptionGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
    {children}
  </div>
);

const OptionButtons: React.FC<{ value: string; options: { value: string; label: string }[]; onChange: (v: any) => void }> = ({ value, options, onChange }) => (
  <div className="flex gap-1 flex-wrap">
    {options.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`px-3 py-1.5 text-xs rounded-lg transition-all ${value === opt.value ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'}`}
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

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, onOpenChange }) => {
  const { settings, updateSetting } = useSettings();
  const { signOut, user } = useAuth();

  const resetTour = () => {
    localStorage.removeItem('rb_editor_tour_done');
    onOpenChange(false);
  };

  const darkThemes = [
    { value: 'deep-dark', label: 'Deep Dark' },
    { value: 'midnight-blue', label: 'Midnight Blue' },
    { value: 'forest-dark', label: 'Forest Dark' },
    { value: 'crimson-dark', label: 'Crimson Dark' },
  ];

  const lightThemes = [
    { value: 'ivory-mist', label: 'Ivory Mist' },
    { value: 'arctic-blue', label: 'Arctic Blue' },
    { value: 'sage-breeze', label: 'Sage Breeze' },
    { value: 'rose-petal', label: 'Rose Petal' },
  ];

  const currentThemes = settings.themeMode === 'dark' ? darkThemes : lightThemes;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:w-[400px] overflow-y-auto scrollbar-dark p-0">
        <SheetHeader className="p-5 pb-3 border-b border-border">
          <SheetTitle className="text-foreground font-display">Settings</SheetTitle>
        </SheetHeader>

        <div className="p-5 space-y-6">
          <div>
            <SectionHeader icon={<Palette className="w-4 h-4" />} title="Appearance" />
            <div className="space-y-4">
              <OptionGroup label="Theme Mode">
                <div className="flex gap-2">
                  <button
                    onClick={() => updateSetting('themeMode', 'dark')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg transition-all ${settings.themeMode === 'dark' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'}`}
                  >
                    <Moon className="w-3.5 h-3.5" /> Dark
                  </button>
                  <button
                    onClick={() => updateSetting('themeMode', 'light')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg transition-all ${settings.themeMode === 'light' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'}`}
                  >
                    <Sun className="w-3.5 h-3.5" /> Light
                  </button>
                </div>
              </OptionGroup>

              <OptionGroup label="Colour Theme">
                <OptionButtons
                  value={settings.colorTheme}
                  options={currentThemes}
                  onChange={(v: ColorTheme) => updateSetting('colorTheme', v)}
                />
              </OptionGroup>

              <OptionGroup label="Font Size">
                <OptionButtons
                  value={settings.fontSize}
                  options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]}
                  onChange={(v: FontSize) => updateSetting('fontSize', v)}
                />
              </OptionGroup>

              <OptionGroup label="Card Density">
                <OptionButtons
                  value={settings.cardDensity}
                  options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }]}
                  onChange={(v: CardDensity) => updateSetting('cardDensity', v)}
                />
              </OptionGroup>
            </div>
          </div>

          <Separator />

          <div>
            <SectionHeader icon={<FileText className="w-4 h-4" />} title="Editor Defaults" />
            <div className="space-y-4">
              <OptionGroup label="Default Document Type">
                <OptionButtons
                  value={settings.defaultDocType}
                  options={[{ value: 'essay', label: 'Essay' }, { value: 'research_paper', label: 'Research' }, { value: 'report', label: 'Report' }, { value: 'general', label: 'General' }]}
                  onChange={(v: DocType) => updateSetting('defaultDocType', v)}
                />
              </OptionGroup>
              <OptionGroup label="Humanizer Intensity">
                <OptionButtons
                  value={settings.defaultHumanizerIntensity}
                  options={[{ value: 'subtle', label: 'Subtle' }, { value: 'moderate', label: 'Moderate' }, { value: 'full', label: 'Full' }]}
                  onChange={(v: HumanizerIntensity) => updateSetting('defaultHumanizerIntensity', v)}
                />
              </OptionGroup>
              <OptionGroup label="Canvas Width">
                <OptionButtons
                  value={settings.canvasWidth}
                  options={[{ value: 'a4', label: 'A4' }, { value: 'full', label: 'Full Width' }]}
                  onChange={(v: CanvasWidth) => updateSetting('canvasWidth', v)}
                />
              </OptionGroup>
              <OptionGroup label="Line Spacing">
                <OptionButtons
                  value={settings.lineSpacing}
                  options={[{ value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Relaxed' }]}
                  onChange={(v: LineSpacing) => updateSetting('lineSpacing', v)}
                />
              </OptionGroup>
            </div>
          </div>

          <Separator />

          <div>
            <SectionHeader icon={<Timer className="w-4 h-4" />} title="Behaviour" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Autosave</span>
                <Switch checked={settings.autosaveEnabled} onCheckedChange={(v) => updateSetting('autosaveEnabled', v)} />
              </div>
              {settings.autosaveEnabled && (
                <OptionGroup label="Autosave Interval">
                  <OptionButtons
                    value={String(settings.autosaveInterval)}
                    options={[{ value: '30', label: '30s' }, { value: '60', label: '1 min' }, { value: '120', label: '2 min' }]}
                    onChange={(v: string) => updateSetting('autosaveInterval', Number(v) as AutosaveInterval)}
                  />
                </OptionGroup>
              )}
              <OptionGroup label="Default Export Format">
                <OptionButtons
                  value={settings.defaultExportFormat}
                  options={[{ value: 'pdf', label: 'PDF' }, { value: 'docx', label: 'DOCX' }]}
                  onChange={(v: ExportFormat) => updateSetting('defaultExportFormat', v)}
                />
              </OptionGroup>
              <OptionGroup label="Chat Panel Default">
                <OptionButtons
                  value={settings.chatDefaultState}
                  options={[{ value: 'closed', label: 'Closed' }, { value: 'open', label: 'Open' }]}
                  onChange={(v: ChatDefault) => updateSetting('chatDefaultState', v)}
                />
              </OptionGroup>
            </div>
          </div>

          <Separator />

          <div>
            <SectionHeader icon={<Eye className="w-4 h-4" />} title="Accessibility" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Reduce Motion</span>
                <Switch checked={settings.reduceMotion} onCheckedChange={(v) => updateSetting('reduceMotion', v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">High Contrast</span>
                <Switch checked={settings.highContrast} onCheckedChange={(v) => updateSetting('highContrast', v)} />
              </div>
            </div>
          </div>

          <Separator />

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
