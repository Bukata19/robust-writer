import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck, Loader2, Eye, EyeOff, X,
  ChevronDown, ChevronUp, Lightbulb, Sparkles,
  CheckCircle2, Wand2, AlertTriangle, BarChart2, Radar, Zap,
} from 'lucide-react';
import type { HighlightFilters, HighlightCategory } from '@/lib/aiHighlightCompute';

// ── INTERFACES ─────────────────────────────────────────────────────────────
interface FlaggedPassage {
  excerpt: string;
  concern_type: string;
  reason: string;
  severity: string;
  confidence: number;
  suggestion?: string;
}

interface SourceIndicators {
  ai_word_density: string;
  burstiness_risk: string;
  transition_density: string;
  coherence_uniformity: string;
  top_ai_words: string[];
  structural_patterns: string[];
}

interface ParagraphRisk {
  index: number;
  preview: string;
  risk_score: number;
  word_count: number;
  burstiness: number;
  ai_word_density: number;
}

interface RawSignals {
  burstiness_score: number;
  uniformity_score: number;
  coherence_uniformity_score: number;
  transition_density: number;
  signature_word_density: number;
  word_count: number;
  sentence_count: number;
  avg_sentence_length: number;
  paragraph_risks?: ParagraphRisk[];
}

interface PlagiarismReport {
  overall_score: number;
  risk_level?: 'clean' | 'low_risk' | 'moderate' | 'high_risk';
  summary: string;
  flagged_passages: FlaggedPassage[];
  originality_strengths?: string[];
  source_indicators?: SourceIndicators;
  raw_signals?: RawSignals;
}

interface PlagiarismPanelProps {
  report: PlagiarismReport | null;
  running: boolean;
  highlightsVisible: boolean;
  onRun: () => void;
  onToggleHighlights: () => void;
  onClose: () => void;
  onHumanizePassage?: (text: string) => void;
  // AI highlight controls
  filters: HighlightFilters;
  counts: Record<HighlightCategory, number>;
  onToggleFilter: (cat: HighlightCategory) => void;
  liveDetect: boolean;
  onToggleLiveDetect: () => void;
}

// ── HIGHLIGHT LEGEND + FILTERS ─────────────────────────────────────────────
const CATEGORY_INFO: { key: HighlightCategory; label: string; dot: string }[] = [
  { key: 'word', label: 'AI words', dot: 'bg-amber-400' },
  { key: 'phrase', label: 'AI phrases', dot: 'bg-violet-400' },
  { key: 'passage', label: 'AI passages', dot: 'bg-red-400' },
  { key: 'structure', label: 'Structure', dot: 'bg-sky-400' },
];

const HighlightLegend: React.FC<{
  filters: HighlightFilters;
  counts: Record<HighlightCategory, number>;
  onToggleFilter: (cat: HighlightCategory) => void;
  liveDetect: boolean;
  onToggleLiveDetect: () => void;
}> = ({ filters, counts, onToggleFilter, liveDetect, onToggleLiveDetect }) => (
  <div className="rounded-xl border border-border bg-card/30 p-3 space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium text-foreground">Highlights</p>
      <button
        onClick={onToggleLiveDetect}
        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
          liveDetect
            ? 'border-primary/40 text-primary bg-primary/10'
            : 'border-border text-muted-foreground'
        }`}
        title="Highlight AI words & phrases live as you type"
      >
        <Zap className="w-3 h-3" /> Live {liveDetect ? 'on' : 'off'}
      </button>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      {CATEGORY_INFO.map((c) => (
        <button
          key={c.key}
          onClick={() => onToggleFilter(c.key)}
          aria-pressed={filters[c.key]}
          className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-[11px] transition-all ${
            filters[c.key]
              ? 'border-border bg-muted/40 text-foreground'
              : 'border-border/40 text-muted-foreground opacity-50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${c.dot}`} />
            {c.label}
          </span>
          <span className="font-mono">{counts[c.key]}</span>
        </button>
      ))}
    </div>
  </div>
);

// ── SCORE GAUGE ────────────────────────────────────────────────────────────
const ScoreGauge: React.FC<{ score: number; riskLevel?: string }> = ({ score, riskLevel }) => {
  const radius = 54;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getGradientId = () => {
    if (score <= 15) return 'gauge-teal';
    if (score <= 40) return 'gauge-yellow';
    return 'gauge-red';
  };

  const getScoreLabel = () => {
    if (riskLevel === 'clean') return 'Clean';
    if (riskLevel === 'low_risk') return 'Low Risk';
    if (riskLevel === 'moderate') return 'Moderate';
    if (riskLevel === 'high_risk') return 'High Risk';
    if (score <= 15) return 'Clean';
    if (score <= 40) return 'Low Risk';
    if (score <= 70) return 'Moderate';
    return 'High Risk';
  };

  return (
    <div className="flex flex-col items-center py-3">
      <svg
        width="140" height="140" viewBox="0 0 140 140"
        className="drop-shadow-lg"
        aria-label={`Plagiarism risk: ${score}% — ${getScoreLabel()}`}
        role="img"
      >
        <defs>
          <linearGradient id="gauge-teal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(180, 100%, 25%)" />
            <stop offset="100%" stopColor="hsl(180, 100%, 40%)" />
          </linearGradient>
          <linearGradient id="gauge-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(45, 100%, 50%)" />
            <stop offset="100%" stopColor="hsl(30, 100%, 50%)" />
          </linearGradient>
          <linearGradient id="gauge-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(0, 100%, 50%)" />
            <stop offset="100%" stopColor="hsl(0, 80%, 40%)" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(210, 11%, 15%)" strokeWidth={stroke} />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={`url(#${getGradientId()})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform="rotate(-90 70 70)"
          className="transition-all duration-1000 ease-out"
        />
        <text x="70" y="64" textAnchor="middle" className="fill-foreground font-bold"
          style={{ fontFamily: 'var(--font-display)', fontSize: '28px' }}>
          {score}%
        </text>
        <text x="70" y="84" textAnchor="middle" className="fill-muted-foreground"
          style={{ fontSize: '11px' }}>
          {getScoreLabel()}
        </text>
      </svg>
    </div>
  );
};

// ── SIGNAL BAR ─────────────────────────────────────────────────────────────
const SignalBar: React.FC<{ label: string; value: number; max?: number; invert?: boolean }> = ({
  label, value, max = 100, invert = false,
}) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  // invert=true means high value = high risk (burstiness, transition density, AI word density)
  const riskPct = invert ? pct : 100 - pct;
  const barColor =
    riskPct >= 70 ? 'bg-destructive' :
    riskPct >= 45 ? 'bg-yellow-500' :
    'bg-primary';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-foreground">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ── SEVERITY BADGE ─────────────────────────────────────────────────────────
const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const styles = {
    high: 'bg-destructive/20 text-destructive border-destructive/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase border ${styles[severity as keyof typeof styles] || styles.low}`}>
      {severity}
    </span>
  );
};

// ── CONFIDENCE INDICATOR ───────────────────────────────────────────────────
const ConfidenceIndicator: React.FC<{ confidence: number }> = ({ confidence }) => {
  const color =
    confidence >= 80 ? 'text-destructive' :
    confidence >= 60 ? 'text-yellow-400' :
    'text-muted-foreground';
  return (
    <span className={`text-[10px] font-mono ${color}`} title={`Detection confidence: ${confidence}%`}>
      {confidence}%
    </span>
  );
};

// ── FLAGGED CARD ───────────────────────────────────────────────────────────
const FlaggedCard: React.FC<{
  passage: FlaggedPassage;
  index: number;
  onHumanize?: (text: string) => void;
}> = ({ passage, index, onHumanize }) => {
  const [expanded, setExpanded] = useState(false);
  const borderColor =
    passage.severity === 'high' ? 'border-destructive/40' :
    passage.severity === 'medium' ? 'border-yellow-500/40' :
    'border-border';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${borderColor} bg-card/50 backdrop-blur-sm`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={expanded}
        aria-label={`Flagged passage ${index + 1}: ${passage.concern_type.replace(/_/g, ' ')}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs text-muted-foreground font-mono shrink-0">#{index + 1}</span>
          <span className="text-xs text-muted-foreground capitalize truncate">
            {passage.concern_type.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {passage.confidence !== undefined && (
            <ConfidenceIndicator confidence={passage.confidence} />
          )}
          <SeverityBadge severity={passage.severity} />
          {expanded
            ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
            : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 animate-fade-in">
          <p className="text-xs text-foreground italic border-l-2 border-primary/40 pl-2">
            "{passage.excerpt}"
          </p>
          <p className="text-[11px] text-muted-foreground">{passage.reason}</p>
          {passage.suggestion && (
            <div className="flex items-start gap-1.5 bg-primary/5 border border-primary/20 rounded-lg p-2">
              <Lightbulb className="w-3 h-3 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[11px] text-foreground">{passage.suggestion}</p>
            </div>
          )}
          {onHumanize && (
            <button
              onClick={() => onHumanize(passage.excerpt)}
              className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors mt-1"
            >
              <Wand2 className="w-3 h-3" />
              Fix with Humanizer
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── PARAGRAPH RISK HEATMAP ─────────────────────────────────────────────────
const ParagraphHeatmap: React.FC<{ paragraphs: ParagraphRisk[] }> = ({ paragraphs }) => {
  const [expanded, setExpanded] = useState(false);

  if (paragraphs.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-foreground">Paragraph Risk Map</p>
        </div>
        {expanded
          ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
          : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-1.5 animate-fade-in">
          {paragraphs.map((p) => {
            const riskColor =
              p.risk_score >= 70 ? 'bg-destructive/20 border-destructive/30' :
              p.risk_score >= 45 ? 'bg-yellow-500/10 border-yellow-500/30' :
              'bg-primary/5 border-primary/20';
            const barColor =
              p.risk_score >= 70 ? 'bg-destructive' :
              p.risk_score >= 45 ? 'bg-yellow-500' :
              'bg-primary';

            return (
              <div key={p.index} className={`rounded-lg border p-2 ${riskColor}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground">Para {p.index}</span>
                  <span className="text-[10px] font-mono text-foreground">{p.risk_score}/100</span>
                </div>
                <div className="h-1 rounded-full bg-muted/40 overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all duration-500`}
                    style={{ width: `${p.risk_score}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{p.preview}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── SIGNAL BREAKDOWN ───────────────────────────────────────────────────────
const SignalBreakdown: React.FC<{ raw: RawSignals; indicators?: SourceIndicators }> = ({
  raw, indicators,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-foreground">Signal Breakdown</p>
        </div>
        {expanded
          ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
          : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-3 bg-card/30 rounded-xl border border-border p-3 animate-fade-in">
          {/* Numeric bars */}
          <div className="space-y-2">
            <SignalBar
              label="Burstiness Risk"
              value={raw.burstiness_score}
              max={100}
              invert={true}
            />
            <SignalBar
              label="Uniformity Score"
              value={raw.uniformity_score}
              max={100}
              invert={true}
            />
            <SignalBar
              label="Coherence Uniformity"
              value={raw.coherence_uniformity_score}
              max={100}
              invert={true}
            />
            <SignalBar
              label="AI Word Density (/1000w)"
              value={raw.signature_word_density}
              max={20}
              invert={true}
            />
            <SignalBar
              label="Transition Density (/1000w)"
              value={raw.transition_density}
              max={25}
              invert={true}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
            {[
              { label: 'Words', value: raw.word_count },
              { label: 'Sentences', value: raw.sentence_count },
              { label: 'Avg Length', value: `${raw.avg_sentence_length}w` },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-xs font-mono text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Top AI words */}
          {indicators?.top_ai_words && indicators.top_ai_words.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                Top AI Words Found
              </p>
              <div className="flex flex-wrap gap-1">
                {indicators.top_ai_words.slice(0, 6).map((word) => (
                  <span
                    key={word}
                    className="text-[10px] px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-full font-mono"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Structural patterns */}
          {indicators?.structural_patterns && indicators.structural_patterns.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                Structural Patterns
              </p>
              <div className="space-y-0.5">
                {indicators.structural_patterns.map((p) => (
                  <p key={p} className="text-[10px] text-muted-foreground">• {p}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── MAIN PANEL ─────────────────────────────────────────────────────────────
const PlagiarismPanel: React.FC<PlagiarismPanelProps> = ({
  report, running, highlightsVisible,
  onRun, onToggleHighlights, onClose, onHumanizePassage,
  filters, counts, onToggleFilter, liveDetect, onToggleLiveDetect,
}) => {
  return (
    <>
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">AI Detector</span>
        </div>
        <div className="flex items-center gap-1">
          {report && (
            <Button
              variant="ghost" size="icon"
              onClick={onToggleHighlights}
              aria-label={highlightsVisible ? 'Hide highlights' : 'Show highlights'}
              title="Toggle highlights"
            >
              {highlightsVisible
                ? <Eye className="w-4 h-4" />
                : <EyeOff className="w-4 h-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-4 overflow-y-auto flex-1 scrollbar-dark">
        <Button onClick={onRun} disabled={running} className="w-full group" size="sm">
          {running
            ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
            : <Radar className="w-4 h-4 mr-1" />}
          {running ? 'Analyzing…' : 'Run Deep AI Analysis'}
        </Button>

        {/* Highlight legend + filters (live detection works without a full run) */}
        <HighlightLegend
          filters={filters}
          counts={counts}
          onToggleFilter={onToggleFilter}
          liveDetect={liveDetect}
          onToggleLiveDetect={onToggleLiveDetect}
        />

        {report && (
          <div className="space-y-4 animate-fade-in">
            {/* Score */}
            <ScoreGauge score={report.overall_score} riskLevel={report.risk_level} />
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-center -mt-2">
              Estimated AI-likelihood
            </p>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              {report.summary}
            </p>

            {/* Signal Breakdown */}
            {report.raw_signals && (
              <SignalBreakdown
                raw={report.raw_signals}
                indicators={report.source_indicators}
              />
            )}

            {/* Paragraph Risk Map */}
            {report.raw_signals?.paragraph_risks &&
              report.raw_signals.paragraph_risks.length > 0 && (
                <ParagraphHeatmap paragraphs={report.raw_signals.paragraph_risks} />
              )}

            {/* Originality Strengths */}
            {report.originality_strengths && report.originality_strengths.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-xs font-medium text-emerald-400">Originality Strengths</p>
                </div>
                {report.originality_strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                    <Sparkles className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-foreground">{s}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Flagged Passages */}
            {report.flagged_passages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">
                  Flagged Passages ({report.flagged_passages.length})
                </p>
                {report.flagged_passages.map((fp, i) => (
                  <FlaggedCard
                    key={i}
                    passage={fp}
                    index={i}
                    onHumanize={onHumanizePassage}
                  />
                ))}
              </div>
            )}

            {report.flagged_passages.length === 0 && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-400">No passages flagged. Your writing looks original.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default PlagiarismPanel;
