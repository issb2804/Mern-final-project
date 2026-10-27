export const TASK_TYPES = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'exam', label: 'Exam' },
  { value: 'project', label: 'Project' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'other', label: 'Other' },
];

export const typeLabel = (v) => TASK_TYPES.find((t) => t.value === v)?.label ?? v;

export const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', done: 'Done' };

export const WEEKDAYS = [
  { key: 'mon', label: 'Monday', short: 'Mon' },
  { key: 'tue', label: 'Tuesday', short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday', short: 'Thu' },
  { key: 'fri', label: 'Friday', short: 'Fri' },
  { key: 'sat', label: 'Saturday', short: 'Sat' },
  { key: 'sun', label: 'Sunday', short: 'Sun' },
];

export function formatHours(h) {
  if (h == null) return '—';
  const rounded = Math.round(h * 100) / 100;
  if (rounded > 0 && rounded < 1) return `${Math.round(rounded * 60)}m`;
  return `${rounded}h`;
}

export function formatDue(iso, timeZone) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/** Formats a yyyy-mm-dd calendar day without shifting it through UTC. */
export function formatDay(isoDate, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function relativeDue(iso) {
  const diffH = (new Date(iso).getTime() - Date.now()) / 3_600_000;
  const abs = Math.abs(diffH);
  let text;
  if (abs < 1) text = `${Math.max(1, Math.round(abs * 60))} min`;
  else if (abs < 48) text = `${Math.round(abs)} h`;
  else text = `${Math.round(abs / 24)} days`;
  return diffH < 0 ? `${text} overdue` : `in ${text}`;
}

/** Value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
