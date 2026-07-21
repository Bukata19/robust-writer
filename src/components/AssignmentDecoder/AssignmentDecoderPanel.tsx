import React, { useState } from 'react';
import { BookOpenCheck, ChevronDown, ChevronRight, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { useAssignmentDecoder, DecoderDocType, AcademicLevel } from '@/hooks/useAssignmentDecoder';

type DecoderApi = ReturnType<typeof useAssignmentDecoder>;

interface Props {
  decoder: DecoderApi;
  onClose: () => void;
}

const DOC_TYPES: { value: DecoderDocType; label: string }[] = [
  { value: 'essay', label: 'Essay' },
  { value: 'research_paper', label: 'Research Paper' },
  { value: 'report', label: 'Report' },
  { value: 'general', label: 'General' },
];

const LEVELS: { value: NonNullable<AcademicLevel>; label: string }[] = [
  { value: 'high_school', label: 'High School' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'postgraduate', label: 'Postgraduate' },
];

const AssignmentDecoderPanel: React.FC<Props> = ({ decoder, onClose }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <>
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Assignment Decoder</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-dark">
        {decoder.step === 'input' && (
          <>
            <label className="text-xs text-muted-foreground block">Paste your assignment question</label>
            <textarea
              value={decoder.question}
              onChange={(e) => decoder.setQuestion(e.target.value)}
              rows={4}
              className="w-full text-sm rounded-lg border border-border bg-background text-foreground p-2 resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Discuss the impact of climate change on coastal communities…"
            />

            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {advancedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Advanced
            </button>
            {advancedOpen && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Academic level</p>
                <div className="flex gap-1 flex-wrap">
                  {LEVELS.map((l) => (
                    <button
                      key={l.value}
                      onClick={() =>
                        decoder.setAcademicLevel(decoder.academicLevel === l.value ? null : l.value)
                      }
                      className={`px-3 py-1 text-xs rounded-full transition-all ${
                        decoder.academicLevel === l.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={decoder.analyseQuestion}
              disabled={decoder.analysing || !decoder.question.trim()}
              className="w-full btn-glow"
              size="sm"
            >
              {decoder.analysing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Analyse Question →
            </Button>

            {decoder.analysing && (
              <div className="space-y-2 pt-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
          </>
        )}

        {decoder.step === 'confirm_type' && (
          <>
            <p className="text-sm text-foreground">
              We think this is a{' '}
              <span className="text-primary font-medium">
                {DOC_TYPES.find((d) => d.value === decoder.detectedDocType)?.label ?? 'Essay'}
              </span>{' '}
              assignment
            </p>
            {decoder.detectionReason && (
              <p className="text-xs text-muted-foreground italic">{decoder.detectionReason}</p>
            )}
            <div className="flex gap-1 flex-wrap">
              {DOC_TYPES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => decoder.setConfirmedDocType(d.value)}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${
                    decoder.confirmedDocType === d.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <Button
              onClick={() =>
                decoder.confirmedDocType &&
                decoder.confirmAndBuildOutline(decoder.confirmedDocType, decoder.academicLevel)
              }
              className="w-full btn-glow"
              size="sm"
            >
              Confirm & Build Outline →
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => decoder.setStep('input')}>
              ← Back
            </Button>
          </>
        )}

        {decoder.step === 'outline_ready' && (
          <>
            <p className="text-sm font-medium text-foreground">Your Outline is Ready</p>
            <div className="space-y-2">
              {decoder.outline.map((sec) => (
                <div key={sec.id} className="rounded-lg border border-border bg-muted/30 p-2 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{sec.heading}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary whitespace-nowrap">
                      ~{sec.wordCountSuggestion}w
                    </span>
                  </div>
                  {sec.guidanceTip && (
                    <p className="text-xs italic text-muted-foreground">{sec.guidanceTip}</p>
                  )}
                  {decoder.generatingSection === sec.heading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Writing…
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => decoder.generateSection(sec.heading)}
                      className="h-7 text-xs"
                    >
                      Write This Section
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {decoder.sectionDraft && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2 animate-fade-in">
                <p className="text-sm font-medium text-primary">{decoder.sectionDraft.heading}</p>
                <div className="text-xs text-foreground whitespace-pre-wrap max-h-[200px] overflow-y-auto scrollbar-dark">
                  {decoder.sectionDraft.content}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={decoder.acceptSection} className="flex-1 btn-glow">
                    Insert Section ✓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => decoder.rewriteSection(decoder.sectionDraft!.heading)}
                    className="flex-1"
                  >
                    Rewrite ↺
                  </Button>
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => decoder.setStep('input')}
            >
              Start New Analysis
            </Button>
          </>
        )}
      </div>
    </>
  );
};

export default AssignmentDecoderPanel;
