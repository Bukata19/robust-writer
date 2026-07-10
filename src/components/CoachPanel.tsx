// Writing Coach sidebar: mode + focus controls, live session summary, trends
// (lazy-loaded charts so recharts stays out of the main bundle), and a dry
// progress checklist. Reads everything from CoachContext.

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import CoachReportExporter from '@/components/CoachReportExporter';
import { Switch } from '@/components/ui/switch';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  X, Brain, Activity, TrendingUp, Flag, Check, Loader2, Download,
  Target, Zap, MessageSquare, Ruler, PenLine,
  type LucideIcon,
} from 'lucide-react';
import { useCoach } from '@/contexts/CoachContext';
import type { CoachMode } from '@/lib/coachTips';
import { type PatternCategory, toggleFocusArea } from '@/lib/coachPatterns';
import { PATTERN_LABELS } from '@/lib/coachReporting';

const CoachCharts = lazy(() => import('./CoachCharts'));

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

  // Milestone checklist — dry, computed from real stats.
  const totalTips = coach.recentSessions.reduce((n, r) => n + r.tips_given, 0) + (s?.tipsGiven ?? 0);
  const totalAccepted = coach.recentSessions.reduce((n, r) => n + r.tips_accepted, 0) + (s?.tipsAccepted ?? 0);
  const bestStreak = Math.max(s?.streak ?? 0, 0);
  const finishedSessions = coach.recentSessions.length;
  const milestones = [
    { label: 'First 10 tips', done: totalTips >= 10, progress: `${Math.min(totalTips, 10)}/10` },
    {
      label: '50% acceptance rate',
      done: totalTips >= 10 && totalAccepted / Math.max(totalTips, 1) >= 0.5,
      progress: totalTips > 0 ? `${Math.round((totalAccepted / totalTips) * 100)}%` : '—',
    },
    { label: '5-tip accept streak', done: bestStreak >= 5, progress: `${bestStreak}/5` },
    { label: '5 coached sessions', done: finishedSessions >= 5, progress: `${Math.min(finishedSessions, 5)}/5` },
  ];

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

      <Tabs defaultValue="session" className="flex flex-col flex-1 overflow-hidden mt-3">
        <TabsList className="grid grid-cols-3 mx-3 shrink-0">
          <TabsTrigger value="session" className="text-xs">
            <Activity className="w-3.5 h-3.5 mr-1" /> Session
          </TabsTrigger>
          <TabsTrigger value="trends" className="text-xs">
            <TrendingUp className="w-3.5 h-3.5 mr-1" /> Trends
          </TabsTrigger>
          <TabsTrigger value="progress" className="text-xs">
            <Flag className="w-3.5 h-3.5 mr-1" /> Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="session" className="flex-1 overflow-y-auto mt-2 px-3 pb-4 data-[state=inactive]:hidden">
          {!s ? (
            <p className="text-xs text-muted-foreground pt-2">Open a document to start a coaching session.</p>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-3 gap-2">
                <div className="surface-card p-2.5 rounded-lg border border-border text-center">
                  <p className="text-lg font-semibold text-foreground leading-none">{s.tipsGiven}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Tips given</p>
                </div>
                <div className="surface-card p-2.5 rounded-lg border border-border text-center">
                  <p className="text-lg font-semibold text-foreground leading-none">{s.tipsAccepted}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Accepted</p>
                </div>
                <div className="surface-card p-2.5 rounded-lg border border-border text-center">
                  <p className="text-lg font-semibold text-primary leading-none">{s.streak}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Streak</p>
                </div>
              </div>

              {acceptance !== null && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] text-muted-foreground">Acceptance rate</p>
                    <p className="text-[11px] font-medium text-foreground">{acceptance}%</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${acceptance}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                The coach watches for a pause in your typing, checks the current paragraph, and
                offers at most one tip at a time. Accept the ones that help — your acceptance
                pattern tunes what it prioritizes next.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trends" className="flex-1 overflow-y-auto mt-2 px-3 pb-4 data-[state=inactive]:hidden">
          {coach.statsLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : coach.recentSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground pt-2">
              No finished sessions yet — trends appear after your first coached document.
            </p>
          ) : (
            <div className="pt-2">
              <Suspense
                fallback={
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading charts…
                  </div>
                }
              >
                <CoachCharts sessions={coach.recentSessions} />
              </Suspense>

              {coach.aggregates.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-medium text-foreground mb-2">Your most frequent issues</p>
                  <ul className="space-y-1">
                    {coach.aggregates.slice(0, 5).map((a) => (
                      <li key={a.pattern_type} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{PATTERN_LABELS[a.pattern_type] ?? a.pattern_type}</span>
                        <span className="text-foreground font-medium">{a.total_occurrences}×</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-5"
                onClick={() => setExportOpen(true)}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export report
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress" className="flex-1 overflow-y-auto mt-2 px-3 pb-4 data-[state=inactive]:hidden">
          <ul className="space-y-2 pt-2">
            {milestones.map((m) => (
              <li
                key={m.label}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex items-center justify-center w-4 h-4 rounded-full border ${
                      m.done ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                    }`}
                  >
                    {m.done && <Check className="w-3 h-3" />}
                  </span>
                  <span className={`text-xs ${m.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {m.label}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">{m.progress}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            Progress counts your recent sessions on this device and account. Deleted documents
            keep their coaching history.
          </p>
        </TabsContent>
      </Tabs>

      <CoachReportExporter open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
