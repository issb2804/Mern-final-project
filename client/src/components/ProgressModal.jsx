import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { post } from '../lib/api';
import { formatHours } from '../lib/format';
import { useRefreshPlan } from '../lib/queries';
import { Field, Modal, Spinner } from './ui';

export default function ProgressModal({ open, onClose, task }) {
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [remaining, setRemaining] = useState('');
  const [markDone, setMarkDone] = useState(false);
  const [errors, setErrors] = useState({});
  const refreshPlan = useRefreshPlan();

  useEffect(() => {
    if (open) {
      setHours('');
      setNote('');
      setRemaining('');
      setMarkDone(false);
      setErrors({});
    }
  }, [open]);

  const log = useMutation({
    mutationFn: (body) => post(`/tasks/${task.id}/progress`, body),
    onSuccess: (data) => {
      refreshPlan();
      toast.success(data.task.status === 'done' ? `"${task.title}" completed 🎉` : 'Progress logged');
      onClose();
    },
    onError: (err) => {
      setErrors(err.fields || {});
      if (err.status === 409) refreshPlan();
      toast.error(err.message);
    },
  });

  if (!task) return null;

  const submit = (e) => {
    e.preventDefault();
    const h = hours === '' ? 0 : Number(hours);
    const body = { hours: h, note: note.trim() || undefined, markDone, version: task.version };
    if (remaining !== '') body.remainingHours = Number(remaining);
    if (!(h > 0) && remaining === '' && !markDone) {
      return setErrors({ hours: 'Log some hours, update the remaining estimate, or mark it done' });
    }
    log.mutate(body);
  };

  const overEstimate = task.hoursSpent >= task.estimatedHours;

  return (
    <Modal open={open} onClose={onClose} title={`Log progress: ${task.title}`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-ink-600">
          {formatHours(task.hoursSpent)} spent of {formatHours(task.estimatedHours)} estimated.{' '}
          {overEstimate
            ? "You're past your estimate, so update the remaining hours to keep the plan accurate."
            : `${formatHours(task.remainingHours)} left.`}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hours worked" error={errors.hours} htmlFor="hours">
            <input
              id="hours"
              type="number"
              min="0"
              max="16"
              step="0.25"
              inputMode="decimal"
              className={`input ${errors.hours ? 'input-error' : ''}`}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 1.5"
            />
          </Field>
          <Field
            label="Hours still needed"
            error={errors.remainingHours}
            hint="Optional: re-estimate what's left"
            htmlFor="remaining"
          >
            <input
              id="remaining"
              type="number"
              min="0"
              step="0.25"
              inputMode="decimal"
              className="input"
              value={remaining}
              onChange={(e) => setRemaining(e.target.value)}
              placeholder={String(Math.max(0, task.remainingHours - (Number(hours) || 0)))}
              disabled={markDone}
            />
          </Field>
        </div>

        <Field label="What did you do?" error={errors.note} htmlFor="note">
          <input
            id="note"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            placeholder="e.g. Finished the ER diagram"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 accent-brand-600"
            checked={markDone}
            onChange={(e) => setMarkDone(e.target.checked)}
          />
          This task is finished
        </label>

        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={log.isPending}>
            {log.isPending && <Spinner className="h-4 w-4 text-on-accent" />}
            {markDone ? 'Complete task' : 'Log progress'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
