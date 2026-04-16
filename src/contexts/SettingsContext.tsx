import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ── TYPES ──────────────────────────────────────────────────────────────────
export type ThemeMode = 'dark' | 'light';

export type ColorTheme =
  | 'deep-dark'
  | 'midnight-blue'
  | 'forest-dark'
  | 'crimson-dark'
  | 'ivory-mist'
  | 'arctic-blue'
  | 'sage-breeze'
  | 'rose-petal';

export type FontSize = 'small' | 'medium' | 'large';
export type CardDensity = 'compact' | 'comfortable';
export type DocType = 'essay' | 'research_paper' | 'report' | 'general';
export type HumanizerIntensity = 'subtle' | 'moderate' | 'full';
export type CanvasWidth = 'a4' | 'full';
export type LineSpacing = 'normal' | 'relaxed';
export type AutosaveInterval = 30 | 60 | 120;
export type ExportFormat = 'pdf' | 'docx';
export type ChatDefault = 'open' | 'closed';

export interface AppSettings {
  themeMode: ThemeMode;
  colorTheme: ColorTheme;
  fontSize: FontSize;
  cardDensity: CardDensity;
  defaultDocType: DocType;
  defaultHumanizerIntensity: HumanizerIntensity;
  canvasWidth: CanvasWidth;
  lineSpacing: LineSpacing;
  autosaveEnabled: boolean;
  autosaveInterval: AutosaveInterval;
  defaultExportFormat: ExportFormat;
  chatDefaultState: ChatDefault;
  reduceMotion: boolean;
  highContrast: boolean;
}

// ── SYSTEM PREFERENCE DETECTION ────────────────────────────────────────────
function detectSystemMode(): ThemeMode {
  try {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch { /* ignore */ }
  return 'dark';
}

const systemMode = detectSystemMode();

const defaultSettings: AppSettings = {
  themeMode: systemMode,
  colorTheme: systemMode === 'dark' ? 'deep-dark' : 'ivory-mist',
  fontSize: 'medium',
  cardDensity: 'comfortable',
  defaultDocType: 'essay',
  defaultHumanizerIntensity: 'moderate',
  canvasWidth: 'a4',
  lineSpacing: 'normal',
  autosaveEnabled: true,
  autosaveInterval: 30,
  defaultExportFormat: 'pdf',
  chatDefaultState: 'closed',
  reduceMotion: false,
  highContrast: false,
};

// ── CONTEXT ────────────────────────────────────────────────────────────────
interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
  toggleThemeMode: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'rb_app_settings';

// ── CSS VARIABLE MAPS PER THEME ────────────────────────────────────────────
type CSSVarMap = Record<string, string>;

const themeVarMap: Record<ColorTheme, CSSVarMap> = {
  'deep-dark': {
    '--background': '0 0% 0%',
    '--foreground': '210 11% 85%',
    '--card': '210 11% 6%',
    '--card-foreground': '210 11% 85%',
    '--popover': '210 11% 8%',
    '--popover-foreground': '210 11% 85%',
    '--primary': '180 100% 25%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '210 11% 12%',
    '--secondary-foreground': '210 11% 75%',
    '--muted': '210 11% 10%',
    '--muted-foreground': '210 11% 50%',
    '--accent': '180 100% 25%',
    '--accent-foreground': '0 0% 100%',
    '--destructive': '0 72% 58%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '210 11% 16%',
    '--input': '210 11% 16%',
    '--ring': '180 100% 25%',
    '--teal': '180 100% 25%',
    '--teal-glow': '180 100% 35%',
    '--surface-elevated': '210 11% 8%',
    '--sidebar-background': '210 11% 4%',
    '--sidebar-foreground': '210 11% 75%',
    '--sidebar-primary': '180 100% 25%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '210 11% 12%',
    '--sidebar-accent-foreground': '210 11% 85%',
    '--sidebar-border': '210 11% 14%',
    '--sidebar-ring': '180 100% 25%',
  },
  'midnight-blue': {
    '--background': '222 47% 5%',
    '--foreground': '220 20% 88%',
    '--card': '222 40% 9%',
    '--card-foreground': '220 20% 88%',
    '--popover': '222 40% 11%',
    '--popover-foreground': '220 20% 88%',
    '--primary': '210 100% 50%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '222 30% 15%',
    '--secondary-foreground': '220 14% 72%',
    '--muted': '222 30% 13%',
    '--muted-foreground': '218 14% 52%',
    '--accent': '210 100% 50%',
    '--accent-foreground': '0 0% 100%',
    '--destructive': '0 72% 58%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '222 25% 20%',
    '--input': '222 25% 20%',
    '--ring': '210 100% 50%',
    '--teal': '210 100% 50%',
    '--teal-glow': '210 100% 60%',
    '--surface-elevated': '222 40% 11%',
    '--sidebar-background': '222 47% 4%',
    '--sidebar-foreground': '220 14% 72%',
    '--sidebar-primary': '210 100% 50%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '222 30% 15%',
    '--sidebar-accent-foreground': '220 20% 88%',
    '--sidebar-border': '222 25% 17%',
    '--sidebar-ring': '210 100% 50%',
  },
  'forest-dark': {
    '--background': '150 20% 4%',
    '--foreground': '142 8% 84%',
    '--card': '150 15% 8%',
    '--card-foreground': '142 8% 84%',
    '--popover': '150 15% 10%',
    '--popover-foreground': '142 8% 84%',
    '--primary': '152 70% 35%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '150 12% 14%',
    '--secondary-foreground': '142 8% 70%',
    '--muted': '150 12% 12%',
    '--muted-foreground': '145 9% 50%',
    '--accent': '152 70% 35%',
    '--accent-foreground': '0 0% 100%',
    '--destructive': '0 72% 58%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '150 10% 18%',
    '--input': '150 10% 18%',
    '--ring': '152 70% 35%',
    '--teal': '152 70% 35%',
    '--teal-glow': '152 70% 45%',
    '--surface-elevated': '150 15% 10%',
    '--sidebar-background': '150 20% 3%',
    '--sidebar-foreground': '142 8% 70%',
    '--sidebar-primary': '152 70% 35%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '150 12% 14%',
    '--sidebar-accent-foreground': '142 8% 84%',
    '--sidebar-border': '150 10% 15%',
    '--sidebar-ring': '152 70% 35%',
  },
  'crimson-dark': {
    '--background': '0 15% 4%',
    '--foreground': '0 8% 87%',
    '--card': '0 12% 8%',
    '--card-foreground': '0 8% 87%',
    '--popover': '0 12% 10%',
    '--popover-foreground': '0 8% 87%',
    '--primary': '0 72% 58%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '0 8% 14%',
    '--secondary-foreground': '0 8% 72%',
    '--muted': '0 8% 12%',
    '--muted-foreground': '0 7% 51%',
    '--accent': '0 72% 58%',
    '--accent-foreground': '0 0% 100%',
    '--destructive': '0 72% 58%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '0 8% 18%',
    '--input': '0 8% 18%',
    '--ring': '0 72% 58%',
    '--teal': '0 72% 58%',
    '--teal-glow': '0 72% 68%',
    '--surface-elevated': '0 12% 10%',
    '--sidebar-background': '0 15% 3%',
    '--sidebar-foreground': '0 8% 72%',
    '--sidebar-primary': '0 72% 58%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '0 8% 14%',
    '--sidebar-accent-foreground': '0 8% 87%',
    '--sidebar-border': '0 8% 15%',
    '--sidebar-ring': '0 72% 58%',
  },

  // ── LIGHT THEMES ──────────────────────────────────────────────────────────
  'ivory-mist': {
    '--background': '40 30% 96%',
    '--foreground': '220 18% 16%',
    '--card': '0 0% 100%',
    '--card-foreground': '220 18% 16%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '220 18% 16%',
    '--primary': '174 65% 34%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '40 20% 91%',
    '--secondary-foreground': '220 14% 30%',
    '--muted': '40 20% 93%',
    '--muted-foreground': '220 10% 46%',
    '--accent': '174 65% 34%',
    '--accent-foreground': '0 0% 100%',
    '--destructive': '0 72% 50%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '40 15% 84%',
    '--input': '40 15% 88%',
    '--ring': '174 65% 34%',
    '--teal': '174 65% 34%',
    '--teal-glow': '174 65% 44%',
    '--surface-elevated': '0 0% 100%',
    '--sidebar-background': '40 25% 93%',
    '--sidebar-foreground': '220 14% 30%',
    '--sidebar-primary': '174 65% 34%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '40 20% 91%',
    '--sidebar-accent-foreground': '220 18% 16%',
    '--sidebar-border': '40 15% 82%',
    '--sidebar-ring': '174 65% 34%',
  },
  'arctic-blue': {
    '--background': '210 35% 95%',
    '--foreground': '220 28% 13%',
    '--card': '0 0% 100%',
    '--card-foreground': '220 28% 13%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '220 28% 13%',
    '--primary': '213 80% 44%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '210 28% 89%',
    '--secondary-foreground': '220 20% 28%',
    '--muted': '210 28% 92%',
    '--muted-foreground': '215 14% 46%',
    '--accent': '213 80% 44%',
    '--accent-foreground': '0 0% 100%',
    '--destructive': '0 72% 50%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '210 22% 83%',
    '--input': '210 22% 87%',
    '--ring': '213 80% 44%',
    '--teal': '213 80% 44%',
    '--teal-glow': '213 80% 54%',
    '--surface-elevated': '0 0% 100%',
    '--sidebar-background': '210 32% 93%',
    '--sidebar-foreground': '220 20% 28%',
    '--sidebar-primary': '213 80% 44%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '210 28% 89%',
    '--sidebar-accent-foreground': '220 28% 13%',
    '--sidebar-border': '210 22% 81%',
    '--sidebar-ring': '213 80% 44%',
  },
  'sage-breeze': {
    '--background': '138 22% 94%',
    '--foreground': '150 22% 12%',
    '--card': '0 0% 100%',
    '--card-foreground': '150 22% 12%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '150 22% 12%',
    '--primary': '142 42% 37%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '138 18% 88%',
    '--secondary-foreground': '150 16% 27%',
    '--muted': '138 18% 91%',
    '--muted-foreground': '145 12% 46%',
    '--accent': '142 42% 37%',
    '--accent-foreground': '0 0% 100%',
    '--destructive': '0 72% 50%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '138 14% 81%',
    '--input': '138 14% 85%',
    '--ring': '142 42% 37%',
    '--teal': '142 42% 37%',
    '--teal-glow': '142 42% 47%',
    '--surface-elevated': '0 0% 100%',
    '--sidebar-background': '138 20% 92%',
    '--sidebar-foreground': '150 16% 27%',
    '--sidebar-primary': '142 42% 37%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '138 18% 88%',
    '--sidebar-accent-foreground': '150 22% 12%',
    '--sidebar-border': '138 14% 79%',
    '--sidebar-ring': '142 42% 37%',
  },
  'rose-petal': {
    '--background': '348 28% 95%',
    '--foreground': '340 22% 13%',
    '--card': '0 0% 100%',
    '--card-foreground': '340 22% 13%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '340 22% 13%',
    '--primary': '340 65% 47%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '348 22% 89%',
    '--secondary-foreground': '340 16% 28%',
    '--muted': '348 22% 92%',
    '--muted-foreground': '340 12% 47%',
    '--accent': '340 65% 47%',
    '--accent-foreground': '0 0% 100%',
    '--destructive': '0 72% 50%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '348 16% 82%',
    '--input': '348 16% 86%',
    '--ring': '340 65% 47%',
    '--teal': '340 65% 47%',
    '--teal-glow': '340 65% 57%',
    '--surface-elevated': '0 0% 100%',
    '--sidebar-background': '348 25% 93%',
    '--sidebar-foreground': '340 16% 28%',
    '--sidebar-primary': '340 65% 47%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '348 22% 89%',
    '--sidebar-accent-foreground': '340 22% 13%',
    '--sidebar-border': '348 16% 80%',
    '--sidebar-ring': '340 65% 47%',
  },
};

// ── PROVIDER ───────────────────────────────────────────────────────────────
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Back-fill themeMode for existing users upgrading from previous version
        if (!parsed.themeMode) {
          parsed.themeMode = 'dark';
        }
        return { ...defaultSettings, ...parsed };
      }
    } catch { /* ignore */ }
    return defaultSettings;
  });

  // Apply CSS variables whenever settings change
  useEffect(() => {
    const root = document.documentElement;
    const vars = themeVarMap[settings.colorTheme];
    if (vars) {
      Object.entries(vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
    const fontSizes: Record<FontSize, string> = { small: '13px', medium: '14px', large: '16px' };
    root.style.setProperty('--editor-font-size', fontSizes[settings.fontSize]);
    root.classList.toggle('reduce-motion', settings.reduceMotion);
    root.classList.toggle('high-contrast', settings.highContrast);
  }, [settings]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* ignore */ }
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  // Toggle between dark/light mode and switch to that mode's default theme
  const toggleThemeMode = useCallback(() => {
    setSettings(prev => {
      const newMode: ThemeMode = prev.themeMode === 'dark' ? 'light' : 'dark';
      const newTheme: ColorTheme = newMode === 'dark' ? 'deep-dark' : 'ivory-mist';
      return { ...prev, themeMode: newMode, colorTheme: newTheme };
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings, toggleThemeMode }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
