import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, FileQuestion, Pencil, PlusCircle, RotateCcw, Timer, Trash2 } from 'lucide-react';
import { del, patch } from '../lib/api';
import { useRefreshPlan, useTask } from '../lib/queries';
import { formatDay, formatDue, formatHours, relativeDue, STATUS_LABEL, typeLabel } from '../lib/format';
import TaskFormModal from '../components/TaskFormModal';
import ProgressModal from '../components/ProgressModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Checklist from '../components/Checklist';
import { EmptyState, ErrorState, PageLoader, ProgressBar, RiskBadge, ScoreChip } from '../components/ui';

const FACTORS = [
  { key: 'pressure', label: 'Time pressure', max: 45, help: 'Work left vs. your free study hours before the deadline' },
  { key: 'urgency', label: 'Urgency', max: 30, help: 'How soon it is due' },
  { key: 'difficulty', label: 'Difficulty', max: 15, help: 'Your 1–5 rating' },
  { key: 'type', label: 'Stakes', max: 10, help: 'Exams > projects > assignments > quizzes' },
];

function Fact({ label, children }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: task, isPending, error, refetch } = useTask(id);
  const refreshPlan = useRefreshPlan();
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setStatus = useMutation({
    mutationFn: (status) => patch(`/tasks/${id}`, { status, version: task.version }),
    onSuccess: (_, status) => {
      refreshPlan();
      toast.success(status === 'done' ? 'Marked as done' : 'Task reopened');
    },
    onError: (err) => {
      refreshPlan();
      toast.error(err.message);
    },
  });

  const remove = useMutation({
    mutationFn: () => del(`/tasks/${id}`),
    onSuccess: () => {
      refreshPlan();
      toast.success('Task deleted');
      navigate('/tasks', { replace: true });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isPending) return <PageLoader />;
  if (error?.status === 404) {
    return (
      <div className="card">
        <EmptyState
          icon={FileQuestion}
          title="Task not found"
          action={
            <Link to="/tasks" className="btn-secondary">
              Back to tasks
            </Link>
          }
        >
          It may have been deleted, or the link is wrong.
        </EmptyState>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const done = task.status === 'done';
  const risk = done ? 'done' : task.priority.risk;

  return (
    <div className="space-y-6">
      <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Tasks
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <ScoreChip score={task.priority.score} risk={risk} />
          <div>
            <h1 className="page-title">{task.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-500">
              <RiskBadge risk={risk} />
              {task.course && <span className="font-medium text-ink-700">{task.course}</span>}
              <span>{typeLabel(task.type)}</span>
              <span>·</span>
              <span>{STATUS_LABEL[task.status]}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!done && (
            <>
              <Link to={`/focus?task=${task.id}`} className="btn-secondary">
                <Timer className="h-4 w-4" /> Focus
              </Link>
              <button className="btn-primary" onClick={() => setLogging(true)}>
                <PlusCircle className="h-4 w-4" /> Log progress
              </button>
            </>
          )}
          <button className="btn-secondary" onClick={() => setStatus.mutate(done ? 'todo' : 'done')} disabled={setStatus.isPending}>
            {done ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {done ? 'Reopen' : 'Mark done'}
          </button>
          <button className="btn-secondary" onClick={() => setEditing(true)} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button className="btn-secondary text-red-600" onClick={() => setConfirmDelete(true)} aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="card p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label="Deadline">
              {formatDue(task.dueAt)}
              {!done && (
                <span className={`block text-xs font-normal ${risk === 'overdue' ? 'text-red-600' : 'text-ink-500'}`}>
                  {relativeDue(task.dueAt)}
                </span>
              )}
            </Fact>
            <Fact label="Difficulty">{task.difficulty}/5</Fact>
            <Fact label="Time spent">
              <span className="num">{formatHours(task.hoursSpent)}</span> of{' '}
              <span className="num">{formatHours(task.estimatedHours)}</span>
            </Fact>
            <Fact label="Work left">
              <span className="num">{formatHours(task.remainingHours)}</span>
            </Fact>
            <Fact label="First estimate">
              <span className="num">{formatHours(task.originalEstimate)}</span>
            </Fact>
            <Fact label={done ? 'Completed' : 'Projected finish'}>
              {done
                ? task.completedAt
                  ? formatDue(task.completedAt)
                  : '—'
                : task.shortfallHours > 0
                  ? <span className="text-rose-600">Won't fit: {formatHours(task.shortfallHours)} short</span>
                  : task.projectedFinish
                    ? formatDay(task.projectedFinish)
                    : '—'}
            </Fact>
          </dl>
          <div className="mt-5">
            <ProgressBar value={task.hoursSpent} max={task.estimatedHours} tone={done ? 'bar-done' : 'bar-brand'} />
          </div>
          {task.notes && (
            <div className="mt-5 border-t border-ink-100 pt-4">
              <p className="text-xs text-ink-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800">{task.notes}</p>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="section-title">Why this priority</h2>
          {done ? (
            <p className="mt-2 text-sm text-ink-500">Completed tasks don't need prioritising.</p>
          ) : (
            <>
              <ul className="mt-2 space-y-1 text-sm text-ink-700">
                {task.priority.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
              {task.priority.breakdown && (
                <dl className="mt-5 space-y-3">
                  {FACTORS.map((f) => (
                    <div key={f.key} title={f.help}>
                      <div className="mb-1 flex justify-between text-xs">
                        <dt className="text-ink-600">{f.label}</dt>
                        <dd className="num text-ink-500">
                          {Math.round(task.priority.breakdown[f.key])} / {f.max}
                        </dd>
                      </div>
                      <ProgressBar value={task.priority.breakdown[f.key]} max={f.max} />
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-4 text-xs text-ink-400">
                {task.priority.capacityHours != null &&
                  `${formatHours(task.priority.capacityHours)} of study time is available before this deadline (before other tasks).`}
              </p>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Checklist taskId={task.id} items={task.checklist ?? []} />

        <section className="card">
          <h2 className="border-b border-ink-100 px-5 py-3 section-title">Progress log</h2>
          {task.progressLog.length ? (
            <ul className="divide-y divide-ink-100">
              {task.progressLog.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <span className="num w-14 shrink-0 font-semibold text-brand-700">+{formatHours(entry.hours)}</span>
                  <span className="min-w-0 flex-1 text-ink-700">{entry.note || <span className="text-ink-400">No note</span>}</span>
                  <span className="shrink-0 text-xs text-ink-400">{formatDue(entry.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-ink-500">No work logged yet. Log hours as you go to keep your plan accurate.</p>
          )}
        </section>
      </div>

      <TaskFormModal open={editing} onClose={() => setEditing(false)} task={task} />
      <ProgressModal open={logging} onClose={() => setLogging(false)} task={task} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        pending={remove.isPending}
        title="Delete this task?"
      >
        "{task.title}" and its progress log will be permanently deleted.
      </ConfirmDialog>
    </div>
  );
}
