// theme.tsx  

export type ThemeMode = 'light' | 'dark';

export interface ColorTheme {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    // Add 4 light variants
    ivoryMist: string;
    arcticBlue: string;
    sageBreeze: string;
    rosePetal: string;
}

export function getSystemThemePreference(): ThemeMode {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    return query.matches ? 'light' : 'dark';
}

export interface AppSettings {
    themeMode: ThemeMode;
    // Other settings...
}

// Light theme color definitions with HSL values
export const lightTheme: ColorTheme = {
    primary: 'hsl(210, 100%, 50%)', // Example color for primary
    secondary: 'hsl(200, 100%, 50%)', // Example color for secondary
    background: 'hsl(0, 0%, 95%)', // Light background
    text: 'hsl(0, 0%, 20%)', // Dark text for contrast
    ivoryMist: 'hsl(60, 20%, 95%)',
    arcticBlue: 'hsl(210, 60%, 90%)',
    sageBreeze: 'hsl(120, 20%, 85%)',
    rosePetal: 'hsl(340, 70%, 80%)',
};

// Apply light-mode CSS class to root element
if (themeMode === 'light') {
    document.documentElement.classList.add('light-mode');
}