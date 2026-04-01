import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2, Eye, EyeOff, X, ChevronDown, ChevronUp, Lightbulb, Sparkles, CheckCircle2 } from 'lucide-react';

interface FlaggedPassage {
  excerpt: string;
  concern_type: string;
  reason: string;
  severity: string;
  suggestion?: string;
}

interface PlagiarismReport {
  overall_score: number;
  summary: string;
  flagged_passages: FlaggedPassage[];
  originality_strengths?: string[];
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

// Animated circular gauge
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
    if (score <= 40) return 'Warning';
    return 'High Risk';
  };

  return (
    <div className="flex flex-col items-center py-4">
      <svg width="140" height="140" viewBox="0 0 140 140" className="drop-shadow-lg">
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

const FlaggedCard: React.FC<{ passage: FlaggedPassage; index: number }> = ({ passage, index }) => {
  const [expanded, setExpanded] = useState(false);

  const borderColor = passage.severity === 'high' ? 'border-destructive/40' : passage.severity === 'medium' ? 'border-yellow-500/40' : 'border-border';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${borderColor} bg-card/50 backdrop-blur-sm`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs text-muted-foreground font-mono shrink-0">#{index + 1}</span>
          <span className="text-xs text-muted-foreground capitalize truncate">{passage.concern_type.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SeverityBadge severity={passage.severity} />
          {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 animate-fade-in">
          <p className="text-xs text-foreground italic border-l-2 border-primary/40 pl-2">"{passage.excerpt}"</p>
          <p className="text-[11px] text-muted-foreground">{passage.reason}</p>
          {passage.suggestion && (
            <div className="flex items-start gap-1.5 bg-primary/5 border border-primary/20 rounded-lg p-2">
              <Lightbulb className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-foreground">{passage.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PlagiarismPanel: React.FC<PlagiarismPanelProps> = ({
  report, running, highlightsVisible, onRun, onToggleHighlights, onClose,
}) => {
  return (
    <>
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Plagiarism Check</span>
        </div>
        <div className="flex items-center gap-1">
          {report && (
            <Button variant="ghost" size="icon" onClick={onToggleHighlights} title="Toggle highlights">
              {highlightsVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="p-3 space-y-4 overflow-y-auto flex-1 scrollbar-dark">
        <Button onClick={onRun} disabled={running} className="w-full group" size="sm">
          {running ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
          {running ? 'Analyzing…' : 'Run Plagiarism Check'}
        </Button>

        {report && (
          <div className="space-y-4 animate-fade-in">
            <ScoreGauge score={report.overall_score} />
            <p className="text-xs text-muted-foreground text-center">{report.summary}</p>

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
