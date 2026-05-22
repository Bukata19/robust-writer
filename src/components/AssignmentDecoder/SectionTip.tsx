import React, { useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  activeSection: string | null;
  outline: { id: string; heading: string; guidanceTip: string }[];
}

const SectionTip: React.FC<Props> = ({ activeSection, outline }) => {
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!activeSection) return null;
  const section = outline.find((s) => s.heading === activeSection);
  if (!section || !section.guidanceTip) return null;
  if (dismissed.has(section.id)) return null;

  const dismiss = () => setDismissed((prev) => new Set(prev).add(section.id));

  if (isMobile) {
    return (
      <div className="fixed left-2 right-2 z-40 bottom-[110px] safe-area-bottom rounded-lg border border-primary/30 bg-card/95 backdrop-blur-sm shadow-lg p-2 flex items-start gap-2 animate-fade-in">
        <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="flex-1 text-xs italic text-muted-foreground">{section.guidanceTip}</p>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-30 w-64 rounded-lg border border-primary/30 bg-card/95 backdrop-blur-sm shadow-lg p-3 animate-fade-in">
      <div className="flex items-start gap-2">
        <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-medium text-foreground mb-1">{section.heading}</p>
          <p className="text-xs italic text-muted-foreground">{section.guidanceTip}</p>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default SectionTip;
