import { Link } from 'react-router-dom';
import { Clock3, ListChecks, PlusCircle } from 'lucide-react';
import { formatDue, formatHours, relativeDue, typeLabel } from '../lib/format';
import { ProgressBar, RiskBadge, ScoreChip } from './ui';

export default function TaskRow({ task, onLogProgress, compact = false }) {
  const done = task.status === 'done';
  const risk = done ? 'done' : task.priority.risk;
  const overdue = risk === 'overdue';

  return (
    <li className="flex items-start gap-4 px-5 py-4 transition hover:bg-ink-50/60 sm:items-center">
      <ScoreChip score={task.priority.score} risk={risk} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link to={`/tasks/${task.id}`} className={`truncate font-semibold hover:text-brand-700 ${done ? 'text-ink-400 line-through' : ''}`}>
            {task.title}
          </Link>
          <RiskBadge risk={risk} />
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
          {task.course && <span className="font-medium text-ink-600">{task.course}</span>}
          <span>{typeLabel(task.type)}</span>
          <span className={`flex items-center gap-1 ${overdue ? 'font-medium text-red-600' : ''}`} title={formatDue(task.dueAt)}>
            <Clock3 className="h-3 w-3" />
            {done ? `Due ${formatDue(task.dueAt)}` : relativeDue(task.dueAt)}
          </span>
          {task.checklistTotal > 0 && (
            <span className="num flex items-center gap-1" title="Checklist steps done">
              <ListChecks className="h-3 w-3" />
              {task.checklistDone}/{task.checklistTotal}
            </span>
          )}
        </p>
        {!compact && !done && task.priority.reasons[0] && (
          <p className="mt-1 text-xs text-ink-500">{task.priority.reasons[0]}</p>
        )}
      </div>
      <div className="hidden w-32 shrink-0 sm:block">
        <div className="mb-1 flex justify-between text-xs text-ink-500">
          <span className="num">{formatHours(task.hoursSpent)}</span>
          <span className="num">{formatHours(task.estimatedHours)}</span>
        </div>
        <ProgressBar value={task.hoursSpent} max={task.estimatedHours} tone={done ? 'bar-done' : 'bar-brand'} />
      </div>
      {onLogProgress && !done && (
        <button className="btn-ghost shrink-0 px-3 text-brand-700" onClick={() => onLogProgress(task)} title="Log progress">
          <PlusCircle className="h-4 w-4" />
          <span className="hidden md:inline">Log</span>
        </button>
      )}
    </li>
  );
}
