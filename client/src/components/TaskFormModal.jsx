import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, CalendarCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { api, patch, post } from '../lib/api';
import { formatDay, formatHours, TASK_TYPES, toLocalInput } from '../lib/format';
import { useRefreshPlan } from '../lib/queries';
import { Field, Modal, RiskBadge, ScoreChip, Spinner } from './ui';

const empty = { title: '', course: '', type: 'assignment', dueAt: '', difficulty: 3, estimatedHours: '', notes: '' };

function fromTask(task) {
  if (!task) return empty;
  return {
    title: task.title,
    course: task.course,
    type: task.type,
    dueAt: toLocalInput(task.dueAt),
    difficulty: task.difficulty,
    estimatedHours: task.estimatedHours,
    notes: task.notes,
  };
}

function toPayload(form) {
  return {
    title: form.title.trim(),
    course: form.course.trim(),
    type: form.type,
    // datetime-local is in the browser's timezone; send an absolute instant.
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : '',
    difficulty: Number(form.difficulty),
    estimatedHours: form.estimatedHours === '' ? '' : Number(form.estimatedHours),
    notes: form.notes.trim(),
  };
}

function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function ImpactPanel({ preview, isFetching, error, ready }) {
  if (!ready) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-ink-500">
        <Sparkles className="h-6 w-6 text-brand-400" />
        Fill in the title, deadline and estimate to see how this fits your schedule.
      </div>
    );
  }
  if (error) return <p className="p-4 text-sm text-red-600">Couldn't preview the impact: {error.message}</p>;
  if (!preview) {
    return (
      <div className="flex h-full items-center justify-center gap-2 p-6 text-sm text-ink-500">
        <Spinner className="h-4 w-4" /> Checking your schedule…
      </div>
    );
  }

  const { candidate, newlyAtRisk, newConflicts, summaryAfter } = preview;
  const clusters = newConflicts.filter((c) => c.type === 'deadline_cluster');
  return (
    <div className={`space-y-4 p-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <ScoreChip score={candidate.priority.score} risk={candidate.priority.risk} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Projected priority</span>
            <RiskBadge risk={candidate.priority.risk} />
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-ink-600">
            {candidate.priority.reasons.slice(0, 3).map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>
      </div>

      {candidate.shortfallHours > 0 ? (
        <div className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You'd be <b>{formatHours(candidate.shortfallHours)} short</b> of finishing this before the deadline with
            your current study hours.
          </span>
        </div>
      ) : (
        candidate.projectedFinish && (
          <div className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Fits your plan. You'd finish by <b>{formatDay(candidate.projectedFinish)}</b>.
            </span>
          </div>
        )
      )}

      {newlyAtRisk.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> This would push other work off track:
          </p>
          <ul className="mt-1 space-y-0.5 pl-6 text-xs">
            {newlyAtRisk.map((t) => (
              <li key={t.id}>
                {t.title}: {formatHours(t.shortfallHours)} short
              </li>
            ))}
          </ul>
        </div>
      )}

      {clusters.map((c) => (
        <p key={c.date} className="rounded-lg bg-ink-50 p-3 text-xs text-ink-700">
          {c.message} {c.suggestion}
        </p>
      ))}

      {candidate.shortfallHours === 0 && newlyAtRisk.length === 0 && (
        <p className="flex items-center gap-2 text-xs text-ink-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Your other deadlines stay on track ({formatHours(summaryAfter.remainingHours)} of work planned in total).
        </p>
      )}
    </div>
  );
}

export default function TaskFormModal({ open, onClose, task, courses = [] }) {
  const editing = !!task;
  const [form, setForm] = useState(() => fromTask(task));
  const [errors, setErrors] = useState({});
  const refreshPlan = useRefreshPlan();

  // Reset only when the dialog opens or targets another task, not when a
  // background refetch hands us a new copy of the same task mid-edit.
  useEffect(() => {
    if (open) {
      setForm(fromTask(task));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  const payload = useMemo(() => toPayload(form), [form]);
  const ready = open && payload.title && payload.dueAt && payload.estimatedHours > 0;
  const debounced = useDebounced(ready ? payload : null, 450);

  const preview = useQuery({
    queryKey: ['preview', task?.id ?? 'new', debounced],
    queryFn: ({ signal }) =>
      api('/tasks/preview', {
        method: 'POST',
        body: { ...debounced, ...(editing && { replaceId: task.id }) },
        signal,
      }),
    enabled: !!debounced,
    placeholderData: (prev) => prev,
    staleTime: 10_000,
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      editing ? patch(`/tasks/${task.id}`, { ...payload, version: task.version }) : post('/tasks', payload),
    onSuccess: (data) => {
      refreshPlan();
      const atRisk = data?.impact?.newlyAtRisk ?? [];
      if (atRisk.length) {
        toast(`Saved. Heads up: ${atRisk.map((t) => t.title).join(', ')} is now at risk.`, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success(editing ? 'Task updated' : 'Task added to your plan');
      }
      onClose();
    },
    onError: (err) => {
      setErrors(err.fields || {});
      if (err.status === 409 && editing) refreshPlan();
      toast.error(err.message);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const local = {};
    if (!payload.title) local.title = 'Title is required';
    if (!payload.dueAt) local.dueAt = 'Pick a deadline';
    if (!(payload.estimatedHours > 0)) local.estimatedHours = 'Enter how many hours you expect this to take';
    if (Object.keys(local).length) return setErrors(local);
    save.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit task' : 'Add a deadline'} wide>
      <form onSubmit={submit} noValidate className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Field label="Title" error={errors.title} htmlFor="title">
            <input
              id="title"
              className={`input ${errors.title ? 'input-error' : ''}`}
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. DBMS assignment 3"
              maxLength={120}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course" error={errors.course} htmlFor="course">
              <input
                id="course"
                className="input"
                value={form.course}
                onChange={set('course')}
                list="course-options"
                placeholder="e.g. CS301"
                maxLength={60}
              />
              <datalist id="course-options">
                {courses.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Type" htmlFor="type">
              <select id="type" className="input" value={form.type} onChange={set('type')}>
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Deadline" error={errors.dueAt} htmlFor="dueAt">
              <input
                id="dueAt"
                type="datetime-local"
                className={`input ${errors.dueAt ? 'input-error' : ''}`}
                value={form.dueAt}
                onChange={set('dueAt')}
              />
            </Field>
            <Field
              label={editing ? 'Total estimate (hours)' : 'Estimated effort (hours)'}
              error={errors.estimatedHours}
              hint="Your best guess at the total work"
              htmlFor="estimatedHours"
            >
              <input
                id="estimatedHours"
                type="number"
                min="0.25"
                step="0.25"
                inputMode="decimal"
                className={`input ${errors.estimatedHours ? 'input-error' : ''}`}
                value={form.estimatedHours}
                onChange={set('estimatedHours')}
                placeholder="e.g. 6"
              />
            </Field>
          </div>

          <Field label={`Difficulty: ${form.difficulty}/5`} htmlFor="difficulty">
            <input
              id="difficulty"
              type="range"
              min="1"
              max="5"
              step="1"
              className="w-full accent-brand-600"
              value={form.difficulty}
              onChange={set('difficulty')}
            />
            <div className="flex justify-between text-xs text-ink-400">
              <span>Easy</span>
              <span>Very hard</span>
            </div>
          </Field>

          <Field label="Notes" error={errors.notes} htmlFor="notes">
            <textarea
              id="notes"
              rows={3}
              className="input"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Requirements, links, chapters to cover…"
              maxLength={2000}
            />
          </Field>
        </div>

        <aside className="rounded-xl border border-ink-100 bg-ink-50/60">
          <p className="border-b border-ink-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Impact on your plan
          </p>
          <ImpactPanel
            preview={preview.data}
            isFetching={preview.isFetching}
            error={preview.error}
            ready={!!ready}
          />
        </aside>

        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4 md:col-span-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending && <Spinner className="h-4 w-4 text-on-accent" />}
            {editing ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
