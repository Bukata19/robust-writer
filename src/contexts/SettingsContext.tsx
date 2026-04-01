import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ColorTheme = 'deep-dark' | 'midnight-blue' | 'forest-dark' | 'crimson-dark';
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
  // Appearance
  colorTheme: ColorTheme;
  fontSize: FontSize;
  cardDensity: CardDensity;
  // Editor Defaults
  defaultDocType: DocType;
  defaultHumanizerIntensity: HumanizerIntensity;
  canvasWidth: CanvasWidth;
  lineSpacing: LineSpacing;
  // Behaviour
  autosaveEnabled: boolean;
  autosaveInterval: AutosaveInterval;
  defaultExportFormat: ExportFormat;
  chatDefaultState: ChatDefault;
  // Accessibility
  reduceMotion: boolean;
  highContrast: boolean;
}

const defaultSettings: AppSettings = {
  colorTheme: 'deep-dark',
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

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'rb_app_settings';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  // Apply theme CSS variables
  useEffect(() => {
    const root = document.documentElement;

    const themes: Record<ColorTheme, Record<string, string>> = {
      'deep-dark': {
        '--background': '0 0% 0%',
        '--card': '210 11% 6%',
        '--popover': '210 11% 8%',
        '--primary': '180 100% 25%',
        '--teal': '180 100% 25%',
        '--teal-glow': '180 100% 35%',
        '--muted': '210 11% 10%',
        '--secondary': '210 11% 12%',
        '--border': '210 11% 16%',
        '--surface-elevated': '210 11% 8%',
        '--sidebar-background': '210 11% 4%',
      },
      'midnight-blue': {
        '--background': '222 47% 5%',
        '--card': '222 40% 9%',
        '--popover': '222 40% 11%',
        '--primary': '210 100% 50%',
        '--teal': '210 100% 50%',
        '--teal-glow': '210 100% 60%',
        '--muted': '222 30% 13%',
        '--secondary': '222 30% 15%',
        '--border': '222 25% 20%',
        '--surface-elevated': '222 40% 11%',
        '--sidebar-background': '222 47% 4%',
      },
      'forest-dark': {
        '--background': '150 20% 4%',
        '--card': '150 15% 8%',
        '--popover': '150 15% 10%',
        '--primary': '152 70% 35%',
        '--teal': '152 70% 35%',
        '--teal-glow': '152 70% 45%',
        '--muted': '150 12% 12%',
        '--secondary': '150 12% 14%',
        '--border': '150 10% 18%',
        '--surface-elevated': '150 15% 10%',
        '--sidebar-background': '150 20% 3%',
      },
      'crimson-dark': {
        '--background': '0 15% 4%',
        '--card': '0 12% 8%',
        '--popover': '0 12% 10%',
        '--primary': '0 80% 50%',
        '--teal': '0 80% 50%',
        '--teal-glow': '0 80% 60%',
        '--muted': '0 8% 12%',
        '--secondary': '0 8% 14%',
        '--border': '0 8% 18%',
        '--surface-elevated': '0 12% 10%',
        '--sidebar-background': '0 15% 3%',
      },
    };

    const themeVars = themes[settings.colorTheme];
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Also update accent/ring to match primary
    root.style.setProperty('--accent', themeVars['--primary']);
    root.style.setProperty('--ring', themeVars['--primary']);
    root.style.setProperty('--sidebar-primary', themeVars['--primary']);
    root.style.setProperty('--sidebar-ring', themeVars['--primary']);

    // Font size
    const fontSizes: Record<FontSize, string> = { small: '13px', medium: '14px', large: '16px' };
    root.style.setProperty('--editor-font-size', fontSizes[settings.fontSize]);

    // Reduce motion
    if (settings.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // High contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
  }, [settings]);

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
