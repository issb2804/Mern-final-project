import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Flame, Hourglass, ListTodo, Plus, Sparkles, Target, Timer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRefreshPlan, useSchedule, useStats, useTasks } from '../lib/queries';
import { post } from '../lib/api';
import { formatDay, formatHours, relativeDue, typeLabel } from '../lib/format';
import TaskRow from '../components/TaskRow';
import TaskFormModal from '../components/TaskFormModal';
import ProgressModal from '../components/ProgressModal';
import ConflictList from '../components/ConflictList';
import { EmptyState, ErrorState, PageLoader, RiskBadge, Stat } from '../components/ui';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const WEEK_MS = 7 * 24 * 3_600_000;

function ThisWeek() {
  const { data } = useTasks({ status: 'open', sort: 'due' });
  const soon = (data?.tasks ?? []).filter((t) => new Date(t.dueAt).getTime() - Date.now() <= WEEK_MS).slice(0, 6);
  if (!data) return null;
  return (
    <section className="card">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="section-title">Due this week</h2>
        <Link to="/calendar" className="text-sm font-medium text-brand-700 hover:underline">
          Calendar
        </Link>
      </div>
      {soon.length ? (
        <ul className="mt-2 divide-y divide-ink-100 pb-1">
          {soon.map((t) => {
            const d = new Date(t.dueAt);
            return (
              <li key={t.id}>
                <Link to={`/tasks/${t.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50/60">
                  <span className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-ink-100 py-1 leading-tight">
                    <span className="text-[10px] font-semibold uppercase text-ink-500">
                      {d.toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span className="font-display text-lg font-semibold">{d.getDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.title}</span>
                    <span className="text-xs text-ink-500">{relativeDue(t.dueAt)}</span>
                  </span>
                  <RiskBadge risk={t.priority.risk} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 pb-5 pt-2 text-sm text-ink-500">Nothing due in the next 7 days.</p>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const schedule = useSchedule();
  const stats = useStats();
  const [adding, setAdding] = useState(false);
  const [logging, setLogging] = useState(null);
  const refreshPlan = useRefreshPlan();
  const loadSample = useMutation({
    mutationFn: () => post('/tasks/sample'),
    onSuccess: (data) => {
      refreshPlan();
      toast.success(`Added ${data.created} sample tasks`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (schedule.isPending) return <PageLoader label="Building your plan…" />;
  if (schedule.error) return <ErrorState error={schedule.error} onRetry={schedule.refetch} />;

  const { focus, days, conflicts, summary } = schedule.data;
  const today = days[0];
  const t = stats.data?.totals;
  const risky = stats.data ? stats.data.risk.critical + stats.data.risk.overdue : 0;
  const hasTasks = focus.length > 0 || conflicts.some((c) => c.type === 'overdue');
  const todayPct = today?.capacity ? Math.round((today.used / today.capacity) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink-950 sm:text-5xl">
            {greeting()}, <span className="italic text-brand-700">{user.name.split(' ')[0]}</span>
          </h1>
          <p className="mt-3 max-w-xl text-ink-600">
            {hasTasks
              ? summary.feasible
                ? `All ${formatHours(summary.remainingHours)} of remaining work fits before its deadlines. Keep the rhythm.`
                : 'Some deadlines need attention — see the conflicts below.'
              : 'Add your first deadline and Cadence will plan the rest.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasTasks && (
            <Link to="/focus" className="btn-secondary">
              <Timer className="h-4 w-4" /> Start focus
            </Link>
          )}
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add deadline
          </button>
        </div>
      </div>

      {t && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={ListTodo} label="Open tasks" value={t.open} hint={`${t.done} completed`} />
          <Stat icon={Clock3} label="Due in 7 days" value={t.dueThisWeek} />
          <Stat icon={Hourglass} label="Work left" value={formatHours(t.remainingHours)} />
          <Stat
            icon={Flame}
            label="Need attention"
            value={risky}
            tone={risky ? 'text-rose-700' : 'text-emerald-700'}
            hint={risky ? 'Overdue or short on time' : 'Everything on track'}
          />
        </div>
      )}

      {!hasTasks ? (
        <div className="card">
          <EmptyState
            icon={Target}
            title="A clean slate"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn-primary" onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" /> Add your first deadline
                </button>
                <button className="btn-secondary" onClick={() => loadSample.mutate()} disabled={loadSample.isPending}>
                  <Sparkles className="h-4 w-4" /> Try with a sample semester
                </button>
              </div>
            }
          >
            Add an assignment, exam or project with its deadline and a rough estimate. Cadence will rank it and
            schedule study time for it.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-6">
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4">
                <h2 className="section-title">Up next</h2>
                <Link to="/tasks" className="text-sm font-medium text-brand-700 hover:underline">
                  All tasks
                </Link>
              </div>
              <p className="px-5 text-sm text-ink-500">Your highest-priority work right now.</p>
              {focus.length ? (
                <ul className="mt-2 divide-y divide-ink-100 border-t border-ink-100">
                  {focus.map((task) => (
                    <TaskRow key={task.id} task={task} onLogProgress={setLogging} />
                  ))}
                </ul>
              ) : (
                <p className="p-5 text-sm text-ink-500">No upcoming work. Only overdue items are left.</p>
              )}
            </section>

            {conflicts.length > 0 && (
              <section className="card overflow-hidden border-amber-200">
                <h2 className="flex items-center gap-2 bg-amber-50 px-5 py-3 section-title">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> {conflicts.length} conflict
                  {conflicts.length > 1 ? 's' : ''} to resolve
                </h2>
                <ConflictList conflicts={conflicts.slice(0, 4)} />
                {conflicts.length > 4 && (
                  <Link to="/plan" className="block border-t border-ink-100 px-5 py-2.5 text-sm font-medium text-brand-700 hover:underline">
                    See all {conflicts.length} conflicts
                  </Link>
                )}
              </section>
            )}
          </div>

          <aside className="min-w-0 space-y-6">
            <section className="card p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="section-title">Today's plan</h2>
                {today && (
                  <span className="num text-xs text-ink-500">
                    {formatHours(today.used)} / {formatHours(today.capacity)}
                  </span>
                )}
              </div>
              {today?.capacity > 0 && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-clay" style={{ width: `${Math.min(100, todayPct)}%` }} />
                </div>
              )}
              {today?.blocks.length ? (
                <ol className="relative mt-5 space-y-4 border-l-2 border-dashed border-ink-200 pl-5">
                  {today.blocks.map((b) => (
                    <li key={b.taskId} className="relative">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-brand-500" />
                      <Link to={`/tasks/${b.taskId}`} className="group block">
                        <span className="num text-xs font-semibold text-brand-700">{formatHours(b.hours)}</span>
                        <span className="block truncate text-sm font-medium group-hover:text-brand-700">{b.title}</span>
                        <span className="text-xs text-ink-500">{[b.course, typeLabel(b.type)].filter(Boolean).join(' · ')}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-sm text-ink-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {today?.capacity === 0 ? 'No study time left today — rest up.' : 'Nothing scheduled for today.'}
                </div>
              )}
              {days[1]?.blocks.length > 0 && (
                <p className="mt-5 border-t border-ink-100 pt-3 text-xs text-ink-500">
                  <span className="font-semibold text-ink-700">{formatDay(days[1].date)}:</span>{' '}
                  {days[1].blocks.map((b) => `${b.title} (${formatHours(b.hours)})`).join(', ')}
                </p>
              )}
              <Link to="/plan" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                Full study plan <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </section>

            <ThisWeek />
          </aside>
        </div>
      )}

      <TaskFormModal open={adding} onClose={() => setAdding(false)} />
      <ProgressModal open={!!logging} task={logging} onClose={() => setLogging(null)} />
    </div>
  );
}
