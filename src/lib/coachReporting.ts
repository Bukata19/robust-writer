// Coach report generation: pure aggregation over session/tip rows, plus
// local-only exporters (JSON blob, PDF via the same lazy html2pdf pattern the
// editor export uses). Nothing leaves the browser — no uploads, no share
// links; the file lands in the user's downloads folder and that's it.

import type { CoachSessionRow, CoachTipRow } from './coachDb';
import { getSessionsInRange, getTipsInRange } from './coachDb';

export const PATTERN_LABELS: Record<string, string> = {
  passive_voice: 'Passive voice',
  wordy_phrase: 'Wordy phrasing',
  weak_opener: 'Weak openers',
  complex_sentence: 'Long sentences',
  transition_density: 'Transition overuse',
  repetition: 'Word repetition',
};

export interface CoachReport {
  from: string;
  to: string;
  generatedAt: string;
  sessionCount: number;
  tipsGiven: number;
  tipsAccepted: number;
  tipsSkipped: number;
  acceptanceRate: number | null;
  tipLogCount: number;
  topPatterns: { type: string; label: string; count: number }[];
  improvements: { type: string; label: string; deltaPct: number }[];
}

/** Pure aggregation — testable without a network. */
export function computeReport(
  sessions: CoachSessionRow[],
  tips: CoachTipRow[],
  from: Date,
  to: Date,
): CoachReport {
  const tipsGiven = sessions.reduce((n, s) => n + s.tips_given, 0);
  const tipsAccepted = sessions.reduce((n, s) => n + s.tips_accepted, 0);
  const tipsSkipped = sessions.reduce((n, s) => n + s.tips_skipped, 0);

  const totals = new Map<string, number>();
  for (const s of sessions) {
    for (const [type, count] of Object.entries(s.patterns ?? {})) {
      totals.set(type, (totals.get(type) ?? 0) + count);
    }
  }
  const topPatterns = [...totals.entries()]
    .map(([type, count]) => ({ type, label: PATTERN_LABELS[type] ?? type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Improvement = a pattern's total in the second half of the range dropped
  // versus the first half. Coarse, but honest — and it never invents progress.
  const midpoint = new Date((from.getTime() + to.getTime()) / 2);
  const firstHalf = new Map<string, number>();
  const secondHalf = new Map<string, number>();
  for (const s of sessions) {
    const bucket = new Date(s.session_start) < midpoint ? firstHalf : secondHalf;
    for (const [type, count] of Object.entries(s.patterns ?? {})) {
      bucket.set(type, (bucket.get(type) ?? 0) + count);
    }
  }
  const improvements: CoachReport['improvements'] = [];
  for (const [type, before] of firstHalf) {
    const after = secondHalf.get(type) ?? 0;
    if (before > 0 && after < before) {
      improvements.push({
        type,
        label: PATTERN_LABELS[type] ?? type,
        deltaPct: Math.round(((before - after) / before) * 100),
      });
    }
  }
  improvements.sort((a, b) => b.deltaPct - a.deltaPct);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    generatedAt: new Date().toISOString(),
    sessionCount: sessions.length,
    tipsGiven,
    tipsAccepted,
    tipsSkipped,
    acceptanceRate: tipsGiven > 0 ? tipsAccepted / tipsGiven : null,
    tipLogCount: tips.length,
    topPatterns,
    improvements,
  };
}

export async function generateReportData(
  userId: string,
  from: Date,
  to: Date,
): Promise<CoachReport> {
  const [sessions, tips] = await Promise.all([
    getSessionsInRange(userId, from, to),
    getTipsInRange(userId, from, to),
  ]);
  return computeReport(sessions, tips, from, to);
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

export function downloadJSON(report: CoachReport, filename: string): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPDF(report: CoachReport, filename: string): Promise<void> {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'font-family: Georgia, serif; color: #1a1a1a; padding: 32px; max-width: 700px;';
  const pct = report.acceptanceRate !== null ? `${Math.round(report.acceptanceRate * 100)}%` : '—';
  wrapper.innerHTML = `
    <h1 style="font-size:22px;margin:0 0 4px;">RobAssister — Writing Coach Report</h1>
    <p style="font-size:12px;color:#555;margin:0 0 20px;">
      ${fmtDate(report.from)} – ${fmtDate(report.to)} · generated ${fmtDate(report.generatedAt)}
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <tr>
        <td style="padding:6px 0;color:#555;">Coached sessions</td><td style="text-align:right;font-weight:bold;">${report.sessionCount}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#555;">Tips given</td><td style="text-align:right;font-weight:bold;">${report.tipsGiven}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#555;">Tips accepted</td><td style="text-align:right;font-weight:bold;">${report.tipsAccepted}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#555;">Acceptance rate</td><td style="text-align:right;font-weight:bold;">${pct}</td>
      </tr>
    </table>
    ${report.topPatterns.length > 0 ? `
      <h2 style="font-size:15px;margin:0 0 8px;">Most frequent issues</h2>
      <ul style="font-size:13px;margin:0 0 20px;padding-left:18px;">
        ${report.topPatterns.map((p) => `<li>${p.label} — ${p.count}×</li>`).join('')}
      </ul>` : ''}
    ${report.improvements.length > 0 ? `
      <h2 style="font-size:15px;margin:0 0 8px;">Improved this period</h2>
      <ul style="font-size:13px;margin:0 0 20px;padding-left:18px;">
        ${report.improvements.map((i) => `<li>${i.label} — down ${i.deltaPct}%</li>`).join('')}
      </ul>` : ''}
    <p style="font-size:11px;color:#888;margin-top:24px;">Generated locally by RobAssister Writing Coach.</p>
  `;
  const html2pdf = (await import('html2pdf.js')).default;
  await html2pdf()
    .set({
      margin: 10,
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(wrapper)
    .save();
}
