// Writing Coach sidebar: mode + focus controls, plus two live tabs (Stats and
// Patterns) scoped to the currently-open document only. No extra database
// reads — everything comes from CoachContext's in-memory session state.

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import CoachReportExporter from '@/components/CoachReportExporter';
import { Switch } from '@/components/ui/switch';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  X, Brain, Activity, BarChart3, Download,
  Target, Zap, MessageSquare, Ruler, PenLine,
  type LucideIcon,
} from 'lucide-react';
import { useCoach } from '@/contexts/CoachContext';
import type { CoachMode } from '@/lib/coachTips';
import { type PatternCategory, toggleFocusArea } from '@/lib/coachPatterns';
import { PATTERN_LABELS } from '@/lib/coachReporting';

const MODE_HINT: Record<CoachMode, string> = {
  encouraging: 'Fewer, gentler tips — only the clearest wins.',
  balanced: 'Solid middle ground: confident findings only.',
  strict: 'Every detected issue earns a tip.',
};

const FOCUS_OPTIONS: { value: PatternCategory; label: string; icon: LucideIcon }[] = [
  { value: 'clarity', label: 'Clarity', icon: Target },
  { value: 'conciseness', label: 'Conciseness', icon: Zap },
  { value: 'tone', label: 'Tone', icon: MessageSquare },
  { value: 'structure', label: 'Structure', icon: Ruler },
  { value: 'grammar', label: 'Grammar', icon: PenLine },
];




interface Props {
  onClose: () => void;
  /** One-line note when the Assignment Decoder is steering the coach. */
  assignmentSummary?: string | null;
}

export default function CoachPanel({ onClose, assignmentSummary }: Props) {
  const coach = useCoach();
  const s = coach.session;
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    void coach.refreshStats();
    // refreshStats identity changes with user; once per open is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptance = s && s.tipsGiven > 0 ? Math.round((s.tipsAccepted / s.tipsGiven) * 100) : null;

  // Live pattern counts for THIS document. Patterns are recorded into memory
  // without a React state change, so poll lightly while the panel is open.
  const [patternCounts, setPatternCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const read = () => setPatternCounts(coach.getLivePatternCounts());
    read();
    const id = window.setInterval(read, 2000);
    return () => window.clearInterval(id);
  }, [coach, s?.documentId]);

  const patternRows = Object.entries(patternCounts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxPattern = patternRows.length > 0 ? patternRows[0][1] : 0;

  const toggleFocus = (area: PatternCategory) => {
    coach.setFocusAreas(toggleFocusArea(coach.focusAreas, area));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Writing Coach</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={coach.enabled}
            onCheckedChange={coach.setEnabled}
            aria-label="Enable Writing Coach"
          />
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close coach panel">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="px-3 pt-3 space-y-3 shrink-0">
        {assignmentSummary && (
          <p className="text-[11px] leading-snug text-primary/90 bg-primary/5 border border-primary/20 rounded-md px-2.5 py-1.5">
            {assignmentSummary}
          </p>
        )}
        <div>
          <SegmentedControl<CoachMode>
            aria-label="Coach mode"
            value={coach.mode}
            onChange={coach.setMode}
            options={[
              { value: 'encouraging', label: 'Encouraging' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'strict', label: 'Strict' },
            ]}
          />
          <p className="text-[11px] text-muted-foreground mt-1">{MODE_HINT[coach.mode]}</p>
        </div>

        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
            Focus areas <span className="font-normal">(up to 3 — the coach prioritizes these)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FOCUS_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = coach.focusAreas.includes(value);
              const full = !active && coach.focusAreas.length >= 3;
              return (
                <button
                  key={value}
                  onClick={() => toggleFocus(value)}
                  disabled={full}
                  aria-pressed={active}
                  className={`focus-ring flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : full
                        ? 'border-border text-muted-foreground/50 cursor-not-allowed'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Tabs defaultValue="stats" className="flex flex-col flex-1 overflow-hidden mt-3">
        <TabsList className="grid grid-cols-2 mx-3 shrink-0">
          <TabsTrigger value="stats" className="text-xs">
            <Activity className="w-3.5 h-3.5 mr-1" /> Stats
          </TabsTrigger>
          <TabsTrigger value="patterns" className="text-xs">
            <BarChart3 className="w-3.5 h-3.5 mr-1" /> Patterns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="flex-1 overflow-y-auto mt-2 px-3 pb-4 data-[state=inactive]:hidden">
          {!s ? (
            <p className="text-xs text-muted-foreground pt-2">
              Start writing to see live stats for this document.
            </p>
          ) : (
            <div className="pt-1 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="surface-card p-2.5 rounded-lg border border-border text-center">
                  <p className="text-lg font-semibold text-foreground leading-none">{s.tipsGiven}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Tips given</p>
                </div>
                <div className="surface-card p-2.5 rounded-lg border border-border text-center">
                  <p className="text-lg font-semibold text-foreground leading-none">{s.tipsAccepted}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Accepted</p>
                </div>
                <div className="surface-card p-2.5 rounded-lg border border-border text-center">
                  <p className="text-lg font-semibold text-foreground leading-none">
                    {acceptance !== null ? `${acceptance}%` : '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Acceptance rate</p>
                </div>
                <div className="surface-card p-2.5 rounded-lg border border-border text-center">
                  <p className="text-lg font-semibold text-primary leading-none">{s.streak}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Streak</p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setExportOpen(true)}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export report
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="patterns" className="flex-1 overflow-y-auto mt-2 px-3 pb-4 data-[state=inactive]:hidden">
          {patternRows.length === 0 ? (
            <p className="text-xs text-muted-foreground pt-2">Nothing flagged yet — keep writing.</p>
          ) : (
            <ul className="space-y-2 pt-1">
              {patternRows.map(([type, count]) => (
                <li key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">
                      {PATTERN_LABELS[type] ?? type}
                    </span>
                    <span className="text-[11px] font-medium text-foreground">{count}×</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300 motion-reduce:transition-none"
                      style={{ width: `${maxPattern > 0 ? Math.max((count / maxPattern) * 100, 4) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <CoachReportExporter open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
