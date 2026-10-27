import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, Hourglass, Info, Sunrise } from 'lucide-react';
import { useSchedule } from '../lib/queries';
import { formatDay, formatDue, formatHours } from '../lib/format';
import ConflictList from '../components/ConflictList';
import { EmptyState, ErrorState, PageLoader, Stat } from '../components/ui';

export default function Plan() {
  const { data, isPending, error, refetch } = useSchedule();

  if (isPending) return <PageLoader label="Building your plan…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { days, conflicts, summary } = data;
  const hasWork = summary.remainingHours > 0;
  const serious = conflicts.filter((c) => c.severity === 'high').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Study plan</h1>
          <p className="mt-2 max-w-2xl text-ink-600">
            Each day's free hours go to the task with the nearest deadline first. If a task still doesn't fit, no
            ordering of your time could fit it, so it's flagged as a conflict.
          </p>
        </div>
        <Link to="/settings" className="btn-secondary">
          Change study hours
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Hourglass} label="Work remaining" value={formatHours(summary.remainingHours)} />
        <Stat icon={Sunrise} label="Study time until last deadline" value={formatHours(summary.availableHours)} />
        <Stat
          icon={summary.feasible ? CheckCircle2 : AlertTriangle}
          label="Status"
          value={summary.feasible ? 'Everything fits' : `${serious} serious conflict${serious === 1 ? '' : 's'}`}
          tone={summary.feasible ? 'text-emerald-700 !text-2xl' : 'text-rose-700 !text-2xl'}
        />
      </div>

      {conflicts.length > 0 && (
        <section className="card overflow-hidden border-amber-200">
          <h2 className="flex items-center gap-2 bg-amber-50 px-5 py-3 section-title">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Conflicts
          </h2>
          <ConflictList conflicts={conflicts} />
        </section>
      )}

      {!hasWork ? (
        <div className="card">
          <EmptyState icon={CalendarDays} title="Nothing to schedule">
            Add tasks with deadlines and estimates, and your study plan appears here.
          </EmptyState>
        </div>
      ) : (
        <section>
          <h2 className="section-title">Day by day</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {days.map((d, i) => {
              const pct = d.capacity ? Math.min(100, Math.round((d.used / d.capacity) * 100)) : 0;
              const rest = d.capacity === 0;
              return (
                <li key={d.date} className={`card flex flex-col p-4 ${rest ? 'bg-ink-100/50 shadow-none' : ''}`}>
                  <div className="flex items-baseline justify-between">
                    <p className="font-display text-base font-semibold">{i === 0 ? 'Today' : formatDay(d.date)}</p>
                    <p className="num text-xs text-ink-500">
                      {rest ? 'Rest day' : `${formatHours(d.used)} / ${formatHours(d.capacity)}`}
                    </p>
                  </div>
                  {!rest && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100">
                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-clay' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {d.blocks.length ? (
                    <div className="mt-3 space-y-1.5">
                      {d.blocks.map((b) => (
                        <Link
                          key={b.taskId}
                          to={`/tasks/${b.taskId}`}
                          className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2 hover:bg-brand-50"
                          title={`Due ${formatDue(b.dueAt)}`}
                        >
                          <span className="num w-10 shrink-0 text-xs font-semibold text-brand-700">{formatHours(b.hours)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{b.title}</span>
                            {b.course && <span className="block truncate text-xs text-ink-500">{b.course}</span>}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-ink-400">{rest ? 'No study time set.' : 'Free'}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="flex items-start gap-2 text-xs text-ink-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Study time counts between 08:00 and 23:00 in your timezone ({data.timezone}). On a deadline day only the hours
        before the deadline count.
      </p>
    </div>
  );
}
