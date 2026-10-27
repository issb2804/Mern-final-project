import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Clock3, Columns3, ListChecks, Plus } from 'lucide-react';
import { patch } from '../lib/api';
import { useRefreshPlan, useTasks } from '../lib/queries';
import { formatHours, relativeDue, typeLabel } from '../lib/format';
import TaskFormModal from '../components/TaskFormModal';
import { EmptyState, ErrorState, PageLoader, ProgressBar, RiskBadge } from '../components/ui';

const COLUMNS = [
  { status: 'todo', label: 'To do', dot: 'bg-ink-400' },
  { status: 'in_progress', label: 'In progress', dot: 'bg-clay' },
  { status: 'done', label: 'Done', dot: 'bg-emerald-500' },
];

function Card({ task, column, onMove, onDragStart }) {
  const done = task.status === 'done';
  const risk = done ? 'done' : task.priority.risk;
  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      className="card cursor-grab p-3.5 transition hover:shadow-lift active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/tasks/${task.id}`} className={`text-sm font-semibold hover:text-brand-700 ${done ? 'text-ink-400 line-through' : ''}`}>
          {task.title}
        </Link>
        {!done && <span className="num shrink-0 text-xs font-semibold text-ink-500" title="Priority score">{task.priority.score}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {task.course && <span className="chip">{task.course}</span>}
        <span className="chip">{typeLabel(task.type)}</span>
        {!done && <RiskBadge risk={risk} />}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-ink-500">
        <span className={`flex items-center gap-1 ${risk === 'overdue' ? 'font-medium text-red-700' : ''}`}>
          <Clock3 className="h-3 w-3" />
          {done ? 'Completed' : relativeDue(task.dueAt)}
        </span>
        {task.checklistTotal > 0 && (
          <span className="num flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {task.checklistDone}/{task.checklistTotal}
          </span>
        )}
        <span className="num ml-auto">
          {formatHours(task.hoursSpent)}/{formatHours(task.estimatedHours)}
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar value={task.hoursSpent} max={task.estimatedHours} tone={done ? 'bar-done' : 'bar-brand'} />
      </div>
      {/* Buttons for touch screens and keyboards, where drag and drop isn't available. */}
      <div className="mt-2 flex justify-between">
        <button
          className="btn-ghost px-1.5 py-1 text-xs disabled:invisible"
          disabled={column === 0}
          onClick={() => onMove(task, COLUMNS[column - 1].status)}
          aria-label={column > 0 ? `Move to ${COLUMNS[column - 1].label}` : undefined}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          className="btn-ghost px-1.5 py-1 text-xs disabled:invisible"
          disabled={column === COLUMNS.length - 1}
          onClick={() => onMove(task, COLUMNS[column + 1].status)}
          aria-label={column < COLUMNS.length - 1 ? `Move to ${COLUMNS[column + 1].label}` : undefined}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

export default function Board() {
  const { data, isPending, error, refetch } = useTasks({ status: 'all' });
  const refreshPlan = useRefreshPlan();
  const [adding, setAdding] = useState(false);
  const [over, setOver] = useState(null);
  // Moves show immediately while the request is in flight.
  const [pending, setPending] = useState({});

  const move = useMutation({
    mutationFn: ({ task, status }) => patch(`/tasks/${task.id}`, { status, version: task.version }),
    onMutate: ({ task, status }) => setPending((p) => ({ ...p, [task.id]: status })),
    onSuccess: (_, { status }) => {
      if (status === 'done') toast.success('Nice work — task completed');
    },
    onError: (err) => toast.error(err.message),
    onSettled: async (_, __, { task }) => {
      await refreshPlan();
      setPending(({ [task.id]: _drop, ...rest }) => rest);
    },
  });

  const onMove = (task, status) => {
    if (task.status !== status) move.mutate({ task, status });
  };

  const onDragStart = (e, task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e, status) => {
    e.preventDefault();
    setOver(null);
    const task = data?.tasks.find((t) => t.id === e.dataTransfer.getData('text/plain'));
    if (task) onMove(task, status);
  };

  if (isPending) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const tasks = data.tasks.map((t) => (pending[t.id] ? { ...t, status: pending[t.id] } : t));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Board</h1>
          <p className="mt-2 text-ink-600">Drag cards between columns to update their status. Each column is sorted by priority.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add deadline
        </button>
      </div>

      {data.total === 0 ? (
        <div className="card">
          <EmptyState icon={Columns3} title="Your board is empty">
            Add a deadline and it will appear in the To do column.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {COLUMNS.map((col, i) => {
            const items = tasks.filter((t) => t.status === col.status);
            return (
              <section
                key={col.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(col.status);
                }}
                onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
                onDrop={(e) => onDrop(e, col.status)}
                className={`rounded-2xl border-2 border-dashed p-3 transition ${
                  over === col.status ? 'border-brand-400 bg-brand-50/70' : 'border-transparent bg-ink-100/60'
                }`}
              >
                <h2 className="flex items-center gap-2 px-1 pb-3 text-sm font-semibold">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  {col.label}
                  <span className="num ml-auto rounded-full bg-surface px-2 text-xs text-ink-500">{items.length}</span>
                </h2>
                <ul className="min-h-24 space-y-3">
                  {items.map((t) => (
                    <Card key={t.id} task={t} column={i} onMove={onMove} onDragStart={onDragStart} />
                  ))}
                  {items.length === 0 && <li className="px-1 py-6 text-center text-sm text-ink-400">Drop tasks here</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <TaskFormModal open={adding} onClose={() => setAdding(false)} courses={data.courses} />
    </div>
  );
}
