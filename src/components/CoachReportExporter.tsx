// Export a coach report as PDF or JSON. Preset ranges instead of a custom
// date picker (the app has none, and "last 7 / 30 / all" covers the real
// use). Everything is generated and downloaded locally — no share links.

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { generateReportData, downloadJSON, downloadPDF } from '@/lib/coachReporting';

type RangeKey = '7d' | '30d' | 'all';
type Format = 'pdf' | 'json';

const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

const rangeToDates = (key: RangeKey): { from: Date; to: Date } => {
  const to = new Date();
  const from = new Date();
  if (key === '7d') from.setDate(from.getDate() - 7);
  else if (key === '30d') from.setDate(from.getDate() - 30);
  else from.setFullYear(from.getFullYear() - 10); // "all" — practical epoch
  return { from, to };
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CoachReportExporter({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>('30d');
  const [format, setFormat] = useState<Format>('pdf');
  const [working, setWorking] = useState(false);

  const exportReport = async () => {
    if (!user || working) return;
    setWorking(true);
    try {
      const { from, to } = rangeToDates(range);
      const report = await generateReportData(user.id, from, to);
      if (report.sessionCount === 0) {
        toast('No coached sessions in this range yet.');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `coach_report_${range}_${stamp}.${format}`;
      if (format === 'json') downloadJSON(report, filename);
      else await downloadPDF(report, filename);
      toast.success('Report downloaded');
      onOpenChange(false);
    } catch {
      toast.error('Could not generate the report — try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export coach report</DialogTitle>
          <DialogDescription>
            A summary of your coaching stats, generated and saved locally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Date range</p>
            <SegmentedControl<RangeKey>
              aria-label="Report date range"
              value={range}
              onChange={setRange}
              options={(['7d', '30d', 'all'] as RangeKey[]).map((k) => ({
                value: k,
                label: RANGE_LABEL[k],
              }))}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Format</p>
            <SegmentedControl<Format>
              aria-label="Report format"
              value={format}
              onChange={setFormat}
              options={[
                { value: 'pdf', label: 'PDF' },
                { value: 'json', label: 'JSON' },
              ]}
            />
          </div>

          <Button onClick={exportReport} disabled={working || !user} className="w-full">
            {working ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <Download className="w-4 h-4 mr-1.5" />
            )}
            Download report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
