import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlarmClock, AlertTriangle, Bell, CalendarClock, CheckCheck, Clock } from 'lucide-react';
import { patch, post } from '../lib/api';
import { useNotifications, useRefreshPlan } from '../lib/queries';
import { Spinner } from './ui';

const KIND = {
  overdue: { icon: AlertTriangle, tone: 'text-red-700 bg-red-100' },
  at_risk: { icon: AlarmClock, tone: 'text-rose-700 bg-rose-100' },
  due_24h: { icon: Clock, tone: 'text-amber-700 bg-amber-100' },
  due_72h: { icon: CalendarClock, tone: 'text-brand-700 bg-brand-100' },
};

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { data, isPending, error } = useNotifications();
  const refresh = useRefreshPlan();

  const markRead = useMutation({ mutationFn: (id) => patch(`/notifications/${id}/read`), onSettled: refresh });
  const markAll = useMutation({ mutationFn: () => post('/notifications/read-all'), onSettled: refresh });

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = data?.unreadCount ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-ghost relative p-2"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="num absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 z-40 mt-2 shadow-lift w-[min(22rem,calc(100vw-2rem))] overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="font-display text-base font-semibold">Alerts</p>
            {unread > 0 && (
              <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => markAll.mutate()}>
                <CheckCheck className="mr-1 inline h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isPending && (
              <div className="flex justify-center p-6">
                <Spinner />
              </div>
            )}
            {error && <p className="p-4 text-sm text-red-600">Couldn't load alerts: {error.message}</p>}
            {data && data.notifications.length === 0 && (
              <p className="p-6 text-center text-sm text-ink-500">
                No alerts yet. You'll be told here when a deadline gets close or falls behind.
              </p>
            )}
            {data?.notifications.map((n) => {
              const { icon: Icon, tone } = KIND[n.kind] ?? KIND.due_72h;
              return (
                <button
                  key={n.id}
                  className={`flex w-full gap-3 border-b border-ink-50 px-4 py-3 text-left hover:bg-ink-100/60 ${
                    n.read ? 'opacity-60' : ''
                  }`}
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id);
                    setOpen(false);
                    navigate(`/tasks/${n.taskId}`);
                  }}
                >
                  <span className={`mt-0.5 h-fit rounded-full p-1.5 ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink-800">{n.message}</span>
                    <span className="text-xs text-ink-400">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="unread" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
