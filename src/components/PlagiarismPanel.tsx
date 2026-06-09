import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck, Loader2, Eye, EyeOff, X, ChevronDown, ChevronUp,
  Lightbulb, Sparkles, CheckCircle2, AlertTriangle, Cpu, Activity,
  TrendingDown, Zap, Info,
} from 'lucide-react';

// ── concern_type label + icon map ──────────────────────────────────────────
const CONCERN_META: Record<
  string,
  { label: string; icon: React.ReactNode; colorClass: string }
> = {
  ai_generated:          { label: 'AI Generated',           icon: <Cpu        className="w-3 h-3" />, colorClass: 'text-purple-400' },
  ai_signature_words:    { label: 'AI Vocab',               icon: <Zap        className="w-3 h-3" />, colorClass: 'text-violet-400' },
  ai_signature_phrases:  { label: 'AI Phrases',             icon: <Zap        className="w-3 h-3" />, colorClass: 'text-violet-400' },
  low_burstiness:        { label: 'Uniform Sentences',      icon: <Activity   className="w-3 h-3" />, colorClass: 'text-blue-400' },
  high_transition_density:{ label: 'Over-connected',        icon: <TrendingDown className="w-3 h-3"/>, colorClass: 'text-sky-400' },
  formulaic_structure:   { label: 'Formulaic Structure',    icon: <AlertTriangle className="w-3 h-3"/>, colorClass: 'text-yellow-400' },
  style_inconsistency:   { label: 'Style Shift',            icon: <AlertTriangle className="w-3 h-3"/>, colorClass: 'text-orange-400' },
  common_phrasing:       { label: 'Common Phrasing',        icon: <Info       className="w-3 h-3" />, colorClass: 'text-muted-foreground' },
  uncited_claim:         { label: 'Uncited Claim',          icon: <Info       className="w-3 h-3" />, colorClass: 'text-amber-400' },
  coherence_uniformity:  { label: 'Machine Coherence',      icon: <Cpu        className="w-3 h-3" />, colorClass: 'text-purple-300' },
};

interface SourceIndicators {
  ai_word_density: string;
  burstiness_risk: string;
  transition_density: string;
  top_ai_words: string[];
  structural_patterns: string[];
}

interface RawSignals {
  burstiness_score: number;
  uniformity_score: number;
  transition_density: number;
  signature_word_density: number;
  word_count: number;
  sentence_count: number;
  avg_sentence_length: number;
}

interface FlaggedPassage {
  excerpt: string;
  concern_type: string;
  reason: string;
  severity: string;
  suggestion?: string;
}

export interface PlagiarismReport {
  overall_score: number;
  summary: string;
  flagged_passages: FlaggedPassage[];
  originality_strengths?: string[];
  source_indicators?: SourceIndicators;
  raw_signals?: RawSignals;
  suggestions?: string[];
}

interface PlagiarismPanelProps {
  report: PlagiarismReport | null;
  running: boolean;
  highlightsVisible: boolean;
  onRun: () => void;
  onToggleHighlights: () => void;
  onClose: () => void;
}

// ── Animated circular gauge ───────────────────────────────────────────────
const ScoreGauge: React.FC<{ score: number }> = ({ score }) => {
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
    if (score <= 15) return 'Clean';
    if (score <= 40) return 'Low Risk';
    if (score <= 70) return 'Moderate';
    return 'High Risk';
  };

  return (
    <div className="flex flex-col items-center py-4">
      <svg
        width="140" height="140" viewBox="0 0 140 140"
        className="drop-shadow-lg"
        aria-label={`Plagiarism risk gauge: ${score}% ${getScoreLabel()}`}
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
        <text x="70" y="64" textAnchor="middle" className="fill-foreground text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '28px' }}>
          {score}%
        </text>
        <text x="70" y="84" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '11px' }}>
          {getScoreLabel()}
        </text>
      </svg>
    </div>
  );
};

// ── Mini signal bar ───────────────────────────────────────────────────────
const SignalBar: React.FC<{ label: string; value: number; max?: number; colorThresholds?: [number, number] }> = ({
  label, value, max = 100, colorThresholds = [40, 70],
}) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const barColor =
    value >= colorThresholds[1]
      ? 'bg-destructive'
      : value >= colorThresholds[0]
      ? 'bg-yellow-500'
      : 'bg-emerald-500';

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center">
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

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const styles = {
    high:   'bg-destructive/20 text-destructive border-destructive/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low:    'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase border ${styles[severity as keyof typeof styles] || styles.low}`}>
      {severity}
    </span>
  );
};

const FlaggedCard: React.FC<{ passage: FlaggedPassage; index: number }> = ({ passage, index }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = CONCERN_META[passage.concern_type] ?? {
    label: passage.concern_type.replace(/_/g, ' '),
    icon: <Info className="w-3 h-3" />,
    colorClass: 'text-muted-foreground',
  };
  const borderColor =
    passage.severity === 'high'
      ? 'border-destructive/40'
      : passage.severity === 'medium'
      ? 'border-yellow-500/40'
      : 'border-border';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${borderColor} bg-card/50 backdrop-blur-sm`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={expanded}
        aria-controls={`flagged-details-${index}`}
        aria-label={`Flagged passage ${index + 1}: ${meta.label}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs text-muted-foreground font-mono shrink-0">#{index + 1}</span>
          <span className={`shrink-0 ${meta.colorClass}`}>{meta.icon}</span>
          <span className="text-xs text-muted-foreground capitalize truncate">{meta.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SeverityBadge severity={passage.severity} />
          {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div
          id={`flagged-details-${index}`}
          className="px-3 pb-3 space-y-2 animate-fade-in"
          role="region"
          aria-label="Flagged passage details"
        >
          <p className="text-xs text-foreground italic border-l-2 border-primary/40 pl-2">"{passage.excerpt}"</p>
          <p className="text-[11px] text-muted-foreground">{passage.reason}</p>
          {passage.suggestion && (
            <div className="flex items-start gap-1.5 bg-primary/5 border border-primary/20 rounded-lg p-2">
              <Lightbulb className="w-3 h-3 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[11px] text-foreground">{passage.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Source Indicators card ─────────────────────────────────────────────────
const SourceIndicatorsCard: React.FC<{ indicators: SourceIndicators; rawSignals?: RawSignals }> = ({
  indicators, rawSignals,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-medium text-foreground">Detection Signals</span>
        </div>
        {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 animate-fade-in border-t border-border/50">
          {/* Signal bars */}
          {rawSignals && (
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Measured Signals</p>
              <SignalBar
                label="AI vocab density (per 1000 w)"
                value={rawSignals.signature_word_density}
                max={20}
                colorThresholds={[4, 8]}
              />
              <SignalBar
                label="Sentence uniformity risk"
                value={rawSignals.burstiness_score}
                max={100}
                colorThresholds={[45, 70]}
              />
              <SignalBar
                label="Transition density (per 1000 w)"
                value={rawSignals.transition_density}
                max={30}
                colorThresholds={[8, 15]}
              />
              <SignalBar
                label="Uniformity run score"
                value={rawSignals.uniformity_score}
                max={100}
                colorThresholds={[30, 60]}
              />
              <div className="flex gap-4 mt-1">
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-mono text-foreground">{rawSignals.word_count}</span> words
                </div>
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-mono text-foreground">{rawSignals.sentence_count}</span> sentences
                </div>
                <div className="text-[10px] text-muted-foreground">
                  avg <span className="font-mono text-foreground">{rawSignals.avg_sentence_length}</span> words/sent
                </div>
              </div>
            </div>
          )}

          {/* AI word hits */}
          {indicators.top_ai_words && indicators.top_ai_words.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Top AI Words Found</p>
              <div className="flex flex-wrap gap-1">
                {indicators.top_ai_words.map((w, i) => (
                  <span key={i} className="text-[10px] bg-purple-500/15 border border-purple-500/25 text-purple-300 rounded px-1.5 py-0.5 font-mono">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Structural patterns */}
          {indicators.structural_patterns && indicators.structural_patterns.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Structural Patterns</p>
              <ul className="space-y-0.5">
                {indicators.structural_patterns.map((p, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-yellow-400 mt-0.5 shrink-0">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Text summaries */}
          <div className="space-y-1 border-t border-border/50 pt-2">
            {[
              { label: 'AI Vocab', value: indicators.ai_word_density },
              { label: 'Burstiness', value: indicators.burstiness_risk },
              { label: 'Transitions', value: indicators.transition_density },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="text-[10px] font-medium text-muted-foreground shrink-0 w-16">{label}</span>
                <span className="text-[10px] text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main panel ─────────────────────────────────────────────────────────────
const PlagiarismPanel: React.FC<PlagiarismPanelProps> = ({
  report, running, highlightsVisible, onRun, onToggleHighlights, onClose,
}) => {
  return (
    <>
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">Plagiarism Check</span>
        </div>
        <div className="flex items-center gap-1">
          {report && (
            <Button
              variant="ghost" size="icon"
              onClick={onToggleHighlights}
              aria-label={highlightsVisible ? 'Hide plagiarism highlights' : 'Show plagiarism highlights'}
              title="Toggle highlights"
            >
              {highlightsVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close plagiarism check panel">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-4 overflow-y-auto flex-1 scrollbar-dark">
        <Button onClick={onRun} disabled={running} className="w-full group" size="sm">
          {running
            ? <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden="true" />
            : <ShieldCheck className="w-4 h-4 mr-1" aria-hidden="true" />}
          {running ? 'Analyzing…' : 'Run Plagiarism Check'}
        </Button>

        {report && (
          <div className="space-y-4 animate-fade-in">
            <ScoreGauge score={report.overall_score} />
            <p className="text-xs text-muted-foreground text-center">{report.summary}</p>

            {/* Detection Signals */}
            {report.source_indicators && (
              <SourceIndicatorsCard
                indicators={report.source_indicators}
                rawSignals={report.raw_signals}
              />
            )}

            {/* Originality Strengths */}
            {report.originality_strengths && report.originality_strengths.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <p className="text-xs font-medium text-emerald-400">Originality Strengths</p>
                </div>
                {report.originality_strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                    <Sparkles className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
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
                  <FlaggedCard key={i} passage={fp} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default PlagiarismPanel;
