// Coach trend charts. This module is the only importer of recharts in the
// app, and it is loaded lazily (React.lazy in CoachPanel) so the charting
// bundle never lands in the main chunk.

import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import type { CoachSessionRow } from '@/lib/coachDb';

const PATTERN_LABEL: Record<string, string> = {
  passive_voice: 'Passive',
  wordy_phrase: 'Wordy',
  weak_opener: 'Weak open',
  complex_sentence: 'Long sent.',
  transition_density: 'Transitions',
  repetition: 'Repetition',
};

const axisStyle = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };
const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
  color: 'hsl(var(--foreground))',
};

export default function CoachCharts({ sessions }: { sessions: CoachSessionRow[] }) {
  // Fold the last sessions' pattern maps into per-pattern totals.
  const totals = new Map<string, number>();
  for (const s of sessions.slice(0, 5)) {
    for (const [type, count] of Object.entries(s.patterns ?? {})) {
      totals.set(type, (totals.get(type) ?? 0) + count);
    }
  }
  const patternData = [...totals.entries()]
    .map(([type, count]) => ({ name: PATTERN_LABEL[type] ?? type, count }))
    .sort((a, b) => b.count - a.count);

  const acceptanceData = sessions
    .slice(0, 8)
    .reverse()
    .map((s, i) => ({
      name: `${i + 1}`,
      rate: s.tips_given > 0 ? Math.round((s.tips_accepted / s.tips_given) * 100) : 0,
    }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-foreground mb-2">
          Issues across your last {Math.min(sessions.length, 5)} sessions
        </p>
        {patternData.length === 0 ? (
          <p className="text-xs text-muted-foreground">No patterns recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, patternData.length * 28)}>
            <BarChart data={patternData} layout="vertical" margin={{ left: 8, right: 8 }}>
              <XAxis type="number" tick={axisStyle} allowDecimals={false} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={70} tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-foreground mb-2">Acceptance rate per session</p>
        {acceptanceData.length < 2 ? (
          <p className="text-xs text-muted-foreground">Finish a couple of sessions to see your trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={acceptanceData} margin={{ left: 8, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={axisStyle} width={30} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'accepted']} />
              <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
