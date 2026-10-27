import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTasks } from '../lib/queries';
import { formatDue, typeLabel } from '../lib/format';
import { ErrorState, PageLoader } from '../components/ui';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TONE = {
  overdue: 'bg-red-100 text-red-800 border-red-300',
  critical: 'bg-rose-100 text-rose-800 border-rose-300',
  at_risk: 'bg-amber-100 text-amber-800 border-amber-300',
  on_track: 'bg-brand-100 text-brand-800 border-brand-300',
  done: 'bg-ink-100 text-ink-400 border-ink-200 line-through',
};

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Six Monday-first weeks covering the given month. */
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}

// RFC 5545 calendar file of open deadlines, importable into Google Calendar, Outlook or Apple Calendar.
function toICS(tasks) {
  const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const events = tasks.map((t) =>
    [
      'BEGIN:VEVENT',
      `UID:${t.id}@cadence`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(t.dueAt)}`,
      `DTEND:${stamp(t.dueAt)}`,
      `SUMMARY:${esc(`${t.title}${t.course ? ` (${t.course})` : ''}`)}`,
      `DESCRIPTION:${esc(`${typeLabel(t.type)} · ${t.remainingHours}h of work left`)}`,
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`${t.title} is due tomorrow`)}`,
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n'),
  );
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cadence//Deadlines//EN', ...events, 'END:VCALENDAR'].join('\r\n');
}

export default function CalendarPage() {
  const { data, isPending, error, refetch } = useTasks({ status: 'all', sort: 'due' });
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const byDay = useMemo(() => {
    const map = new Map();
    for (const t of data?.tasks ?? []) {
      const key = dayKey(new Date(t.dueAt));
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [data]);

  if (isPending) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const cells = monthGrid(cursor.year, cursor.month);
  const todayKey = dayKey(new Date());
  const title = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(cursor.year, cursor.month, 1));
  const shift = (n) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + n, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const exportICS = () => {
    const open = data.tasks.filter((t) => t.status !== 'done');
    if (!open.length) return toast('No open deadlines to export');
    const url = URL.createObjectURL(new Blob([toICS(open)], { type: 'text/calendar' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'cadence-deadlines.ics' });
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${open.length} deadline${open.length > 1 ? 's' : ''}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="mt-2 text-ink-600">Every deadline at a glance, coloured by risk.</p>
        </div>
        <button className="btn-secondary" onClick={exportICS}>
          <Download className="h-4 w-4" /> Export to calendar (.ics)
        </button>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <div className="flex items-center gap-1">
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => {
                const now = new Date();
                setCursor({ year: now.getFullYear(), month: now.getMonth() });
              }}
            >
              Today
            </button>
            <button className="btn-ghost p-2" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="btn-ghost p-2" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-ink-100 bg-ink-50/60">
          {WEEK.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const key = dayKey(d);
            const inMonth = d.getMonth() === cursor.month;
            const items = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`min-h-[5.5rem] border-ink-100 p-1.5 sm:min-h-[7rem] ${i % 7 !== 6 ? 'border-r' : ''} ${
                  i < 35 ? 'border-b' : ''
                } ${inMonth ? '' : 'bg-ink-50/70'}`}
              >
                <span
                  className={`num inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday ? 'bg-clay font-semibold text-white' : inMonth ? 'text-ink-700' : 'text-ink-400'
                  }`}
                >
                  {d.getDate()}
                </span>
                <ul className="mt-1 space-y-1">
                  {items.slice(0, 3).map((t) => (
                    <li key={t.id}>
                      <Link
                        to={`/tasks/${t.id}`}
                        title={`${t.title} · due ${formatDue(t.dueAt)}`}
                        className={`block truncate rounded-md border-l-2 px-1.5 py-0.5 text-[11px] font-medium ${
                          TONE[t.status === 'done' ? 'done' : t.priority.risk] ?? TONE.on_track
                        }`}
                      >
                        {t.title}
                      </Link>
                    </li>
                  ))}
                  {items.length > 3 && <li className="px-1.5 text-[11px] text-ink-500">+{items.length - 3} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-4 text-xs text-ink-500">
        {[
          ['on_track', 'On track'],
          ['at_risk', 'At risk'],
          ['critical', 'Critical'],
          ['overdue', 'Overdue'],
          ['done', 'Done'],
        ].map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded border-l-2 ${TONE[k]}`} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
