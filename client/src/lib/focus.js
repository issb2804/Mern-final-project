import { useCallback, useEffect, useState } from 'react';

// The focus session lives in localStorage so it keeps running while you move
// between pages (or reload), and every component reading it stays in sync.
const KEY = 'cadence-focus';
const EVENT = 'cadence-focus-change';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

function write(session) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the session just won't survive a reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Milliseconds left in a session, whether it's running or paused. */
export const remainingMs = (s, now = Date.now()) =>
  !s ? 0 : s.endsAt ? Math.max(0, s.endsAt - now) : s.pausedRemaining;

/** Milliseconds of focus completed so far. */
export const elapsedMs = (s, now = Date.now()) => (s ? s.durationMin * 60_000 - remainingMs(s, now) : 0);

export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useFocusSession() {
  const [session, setSession] = useState(read);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const sync = () => setSession(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const running = !!session?.endsAt;
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(({ taskId, taskTitle, durationMin }) => {
    write({ taskId, taskTitle, durationMin, endsAt: Date.now() + durationMin * 60_000, pausedRemaining: null });
  }, []);

  const pause = useCallback(() => {
    const s = read();
    if (s?.endsAt) write({ ...s, endsAt: null, pausedRemaining: remainingMs(s) });
  }, []);

  const resume = useCallback(() => {
    const s = read();
    if (s && !s.endsAt) write({ ...s, endsAt: Date.now() + s.pausedRemaining, pausedRemaining: null });
  }, []);

  const clear = useCallback(() => write(null), []);

  return {
    session,
    running,
    finished: !!session && remainingMs(session, now) === 0,
    remaining: remainingMs(session, now),
    elapsed: elapsedMs(session, now),
    start,
    pause,
    resume,
    clear,
  };
}
