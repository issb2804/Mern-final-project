import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Coffee, Pause, Play, Square, Timer } from 'lucide-react';
import { post } from '../lib/api';
import { formatClock, useFocusSession } from '../lib/focus';
import { formatHours, relativeDue } from '../lib/format';
import { useRefreshPlan, useTasks } from '../lib/queries';
import { EmptyState, ErrorState, PageLoader, Spinner } from '../components/ui';

const PRESETS = [25, 45, 60, 90];
const MIN_LOG_MS = 60_000;

function Ring({ fraction, children }) {
  const r = 120;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[18rem]">
      <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90">
        <circle cx="140" cy="140" r={r} fill="none" strokeWidth="10" className="stroke-ink-100" />
        <circle
          cx="140"
          cy="140"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          className="stroke-brand-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export default function Focus() {
  const [params] = useSearchParams();
  const { data, isPending, error, refetch } = useTasks({ status: 'open' });
  const { session, running, finished, remaining, elapsed, start, pause, resume, clear } = useFocusSession();
  const [taskId, setTaskId] = useState(params.get('task') || '');
  const [duration, setDuration] = useState(25);
  const refreshPlan = useRefreshPlan();
  const announced = useRef(false);

  const tasks = data?.tasks ?? [];
  // Default to the requested task, else the top-priority one.
  useEffect(() => {
    if (!taskId && tasks.length) setTaskId(tasks[0].id);
  }, [taskId, tasks]);

  useEffect(() => {
    if (finished && !announced.current) {
      announced.current = true;
      toast.success('Focus session complete. Log it below.', { duration: 6000 });
    }
    if (!session) announced.current = false;
  }, [finished, session]);

  useEffect(() => {
    if (!session) return undefined;
    const prev = document.title;
    document.title = finished ? '✓ Session done · Cadence' : `${formatClock(remaining)} · ${session.taskTitle}`;
    return () => {
      document.title = prev;
    };
  }, [session, remaining, finished]);

  const log = useMutation({
    mutationFn: () =>
      post(`/tasks/${session.taskId}/progress`, {
        hours: Math.round((elapsed / 3_600_000) * 100) / 100,
        note: `Focus session (${Math.round(elapsed / 60_000)} min)`,
      }),
    onSuccess: () => {
      toast.success(`Logged ${formatHours(elapsed / 3_600_000)} to "${session.taskTitle}"`);
      clear();
      refreshPlan();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isPending) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  if (!session && tasks.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={Timer}
          title="Nothing to focus on"
          action={
            <Link to="/tasks" className="btn-primary">
              Go to tasks
            </Link>
          }
        >
          Add an open task first, then come back to run a focus session on it.
        </EmptyState>
      </div>
    );
  }

  const selected = tasks.find((t) => t.id === taskId);
  const total = session ? session.durationMin * 60_000 : duration * 60_000;
  const shown = session ? remaining : total;
  const canLog = session && elapsed >= MIN_LOG_MS;

  const stop = () => {
    if (canLog) log.mutate();
    else clear();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <h1 className="page-title">Focus</h1>
        <p className="mt-2 text-ink-600">One task, no distractions. The time is logged to the task when you finish.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <section className="card flex flex-col items-center gap-6 p-8">
          <Ring fraction={session ? 1 - remaining / total : 0}>
            <p className="eyebrow">{finished ? 'Session done' : running ? 'Focusing' : session ? 'Paused' : 'Ready'}</p>
            <p className="num mt-2 text-6xl font-semibold tracking-tight text-ink-950">{formatClock(shown)}</p>
            {session && <p className="mt-2 max-w-[13rem] truncate text-sm text-ink-500">{session.taskTitle}</p>}
          </Ring>

          <div className="flex flex-wrap justify-center gap-2">
            {!session && (
              <button
                className="btn-primary px-6 py-2.5"
                disabled={!selected}
                onClick={() => start({ taskId: selected.id, taskTitle: selected.title, durationMin: duration })}
              >
                <Play className="h-4 w-4" /> Start {duration} min
              </button>
            )}
            {session && !finished && (
              <button className="btn-secondary px-5" onClick={running ? pause : resume}>
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running ? 'Pause' : 'Resume'}
              </button>
            )}
            {session && (
              <button className={finished ? 'btn-primary px-6 py-2.5' : 'btn-secondary px-5'} onClick={stop} disabled={log.isPending}>
                {log.isPending ? <Spinner className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {canLog ? `End & log ${formatHours(elapsed / 3_600_000)}` : 'Cancel session'}
              </button>
            )}
          </div>
          {session && !canLog && !finished && (
            <p className="-mt-2 text-xs text-ink-400">Sessions shorter than a minute aren't logged.</p>
          )}
        </section>

        <aside className="space-y-6">
          <section className="card space-y-4 p-5">
            <div>
              <label className="label" htmlFor="focus-task">
                Task
              </label>
              <select
                id="focus-task"
                className="input"
                value={session ? session.taskId : taskId}
                onChange={(e) => setTaskId(e.target.value)}
                disabled={!!session}
              >
                {session && !tasks.some((t) => t.id === session.taskId) && (
                  <option value={session.taskId}>{session.taskTitle}</option>
                )}
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              {selected && !session && (
                <p className="mt-1.5 text-xs text-ink-500">
                  {formatHours(selected.remainingHours)} left · due {relativeDue(selected.dueAt)}
                </p>
              )}
            </div>
            <div>
              <p className="label">Length</p>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESETS.map((m) => (
                  <button
                    key={m}
                    className={`rounded-xl py-2 text-sm font-medium transition ${
                      duration === m ? 'bg-ink-900 text-ink-50' : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                    }`}
                    onClick={() => setDuration(m)}
                    disabled={!!session}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card flex gap-3 p-5 text-sm text-ink-600">
            <Coffee className="mt-0.5 h-5 w-5 shrink-0 text-clay" />
            <p>
              After each session, take a 5-minute break. The timer keeps running if you switch pages, and you'll see it in
              the top bar.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
