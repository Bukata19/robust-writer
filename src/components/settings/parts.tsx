import React from "react";

import type { ColorTheme } from "@/contexts/SettingsContext";

// ── OPTION GROUP ─────────────────────────────────────────────────────────────
export const OptionGroup: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="space-y-2">
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    {children}
  </div>
);

// ── SECTION HEADER ───────────────────────────────────────────────────────────
export const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({
  icon,
  title,
}) => (
  <div className="mb-3 flex items-center gap-2">
    <span className="text-primary">{icon}</span>
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
  </div>
);

// ── THEME CHIP ───────────────────────────────────────────────────────────────
export interface ChipConfig {
  id: ColorTheme;
  label: string;
  bg: string;
  accent: string;
  surface: string;
}

export const DARK_CHIPS: ChipConfig[] = [
  { id: "deep-dark", label: "Deep Dark", bg: "#080a0c", accent: "#00d4b8", surface: "#131b22" },
  { id: "midnight-blue", label: "Midnight Blue", bg: "#080e1e", accent: "#4da6ff", surface: "#10182e" },
  { id: "forest-dark", label: "Forest Dark", bg: "#070f08", accent: "#3dba6e", surface: "#0e1c10" },
  { id: "crimson-dark", label: "Crimson Dark", bg: "#0f0809", accent: "#e05252", surface: "#1e1012" },
];

export const LIGHT_CHIPS: ChipConfig[] = [
  { id: "ivory-mist", label: "Ivory Mist", bg: "#f5f1e8", accent: "#1a8c7a", surface: "#ffffff" },
  { id: "arctic-blue", label: "Arctic Blue", bg: "#eaf2f8", accent: "#2563b0", surface: "#ffffff" },
  { id: "sage-breeze", label: "Sage Breeze", bg: "#eaf3ea", accent: "#2e7d4f", surface: "#ffffff" },
  { id: "rose-petal", label: "Rose Petal", bg: "#f8edf0", accent: "#c0385a", surface: "#ffffff" },
];

export const ThemeChip: React.FC<{
  config: ChipConfig;
  isActive: boolean;
  onSelect: () => void;
}> = ({ config, isActive, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    title={config.label}
    aria-pressed={isActive}
    className={`flex w-full flex-col items-center gap-1.5 rounded-xl border bg-muted p-2 transition-all duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
      isActive ? "border-ring ring-2 ring-ring" : "border-border"
    }`}
  >
    {/* Colour preview swatch */}
    <div
      className="flex h-5 w-full overflow-hidden rounded-md"
      style={{ border: "1px solid rgba(128,128,128,0.15)" }}
    >
      <div style={{ background: config.bg, flex: 2 }} />
      <div style={{ background: config.accent, flex: 1 }} />
      <div style={{ background: config.surface, flex: 1 }} />
    </div>
    <span className="text-center text-[10px] font-semibold leading-tight text-muted-foreground">
      {config.label}
    </span>
  </button>
);
