import { useState } from 'react';
import { AlertOctagon, AlertTriangle, BarChart3, CalendarX2, CheckCircle2 } from 'lucide-react';
import { useStats } from '../lib/queries';
import { formatDay, formatHours } from '../lib/format';
import { EmptyState, ErrorState, PageLoader, Stat } from '../components/ui';

function HoursChart({ data }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.hours));
  // Round the axis top up to a whole number so gridlines land on readable values.
  const top = Math.ceil(max);
  const total = data.reduce((s, d) => s + d.hours, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="section-title">Hours logged, last 14 days</h2>
          <p className="num mt-0.5 text-sm text-ink-500">{formatHours(Math.round(total * 100) / 100)} total</p>
        </div>
      </div>

      <div className="relative mt-4 h-48">
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-ink-100" style={{ bottom: `${f * 100}%` }}>
            <span className="num absolute -top-2.5 left-0 bg-surface pr-1 text-[10px] text-ink-400">
              {Math.round(top * f * 10) / 10}h
            </span>
          </div>
        ))}
        <div className="absolute inset-0 left-8 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={`w-full rounded-t-md transition-colors ${hover === i ? 'bg-clay' : 'bg-brand-400'}`}
                style={{ height: `${(d.hours / top) * 100}%`, minHeight: d.hours > 0 ? 2 : 0 }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-ink-200 bg-surface px-2 py-1 text-xs text-ink-900 shadow-lift">
                  {formatDay(d.date)}: <span className="num">{formatHours(d.hours)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-8 mt-1 flex justify-between text-[10px] text-ink-400">
        <span>{formatDay(data[0].date, { day: 'numeric', month: 'short' })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

const RISK_TILES = [
  { key: 'overdue', label: 'Overdue', icon: CalendarX2, tone: 'text-red-700' },
  { key: 'critical', label: 'Critical', icon: AlertOctagon, tone: 'text-rose-700' },
  { key: 'at_risk', label: 'At risk', icon: AlertTriangle, tone: 'text-amber-700' },
  { key: 'on_track', label: 'On track', icon: CheckCircle2, tone: 'text-emerald-700' },
];

function estimationText(ratio, sample) {
  if (ratio == null) return 'Finish a few tasks with logged hours to see how accurate your estimates are.';
  const pct = Math.round(Math.abs(ratio - 1) * 100);
  const base = `Based on ${sample} completed task${sample > 1 ? 's' : ''}.`;
  if (pct <= 10) return `Your estimates are close to reality. ${base}`;
  return ratio > 1
    ? `Tasks take you about ${pct}% longer than you first estimate. Consider padding new estimates. ${base}`
    : `You finish about ${pct}% faster than you estimate. ${base}`;
}

export default function Insights() {
  const { data, isPending, error, refetch } = useStats();
  if (isPending) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  if (data.totals.tasks === 0) {
    return (
      <div className="card">
        <EmptyState icon={BarChart3} title="No data yet">
          Insights appear once you add tasks and start logging progress.
        </EmptyState>
      </div>
    );
  }

  const maxCourse = Math.max(1, ...data.courses.map((c) => c.remainingHours + c.hoursSpent));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Insights</h1>
        <p className="mt-1 text-sm text-ink-500">How you're tracking, and how well your plans match reality.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {RISK_TILES.map(({ key, label, icon, tone }) => (
          <Stat key={key} icon={icon} label={label} value={data.risk[key] ?? 0} tone={tone} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="card p-5">
          <HoursChart data={data.hoursByDay} />
        </section>

        <section className="card space-y-5 p-5">
          <div>
            <p className="eyebrow">On-time completion</p>
            <p className="mt-1 font-display text-4xl font-semibold text-ink-950">
              {data.onTimeRate == null ? '—' : `${Math.round(data.onTimeRate * 100)}%`}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {data.totals.done
                ? `${data.completedOnTime} on time, ${data.completedLate} late`
                : 'No tasks completed yet'}
            </p>
          </div>
          <div className="border-t border-ink-100 pt-5">
            <p className="eyebrow">Estimate accuracy</p>
            <p className="mt-1 font-display text-4xl font-semibold text-ink-950">
              {data.estimationRatio == null ? '—' : `${data.estimationRatio}×`}
            </p>
            <p className="mt-1 text-xs text-ink-500">{estimationText(data.estimationRatio, data.estimationSample)}</p>
          </div>
          <div className="border-t border-ink-100 pt-5">
            <p className="eyebrow">Total logged</p>
            <p className="mt-1 font-display text-4xl font-semibold text-ink-950">{formatHours(data.totals.hoursLogged)}</p>
          </div>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="section-title">Workload by course</h2>
        <p className="mt-0.5 text-sm text-ink-500">Hours done (green) and hours still needed (clay).</p>
        <ul className="mt-4 space-y-3">
          {data.courses.map((c) => (
            <li key={c.course} className="grid items-center gap-2 sm:grid-cols-[140px_1fr_210px]">
              <span className="truncate text-sm font-medium">{c.course}</span>
              <div className="flex h-3 gap-[2px]" title={`${formatHours(c.hoursSpent)} done, ${formatHours(c.remainingHours)} left`}>
                {c.hoursSpent > 0 && (
                  <div className="rounded-l-full bg-brand-600" style={{ width: `${(c.hoursSpent / maxCourse) * 100}%` }} />
                )}
                {c.remainingHours > 0 && (
                  <div className="rounded-r-full bg-clay/40" style={{ width: `${(c.remainingHours / maxCourse) * 100}%` }} />
                )}
              </div>
              <span className="num text-xs text-ink-500 sm:text-right">
                {formatHours(c.hoursSpent)} done · {formatHours(c.remainingHours)} left · {c.open} open
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
