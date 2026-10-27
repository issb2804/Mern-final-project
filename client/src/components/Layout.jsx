import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  Columns3,
  Home,
  ListChecks,
  LogOut,
  Moon,
  Settings,
  Sun,
  Timer,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../lib/theme';
import { formatClock, useFocusSession } from '../lib/focus';
import NotificationBell from './NotificationBell';

const NAV = [
  { to: '/', label: 'Today', icon: Home, end: true, primary: true },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, primary: true },
  { to: '/board', label: 'Board', icon: Columns3, primary: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, primary: true },
  { to: '/plan', label: 'Plan', icon: CalendarRange },
  { to: '/focus', label: 'Focus', icon: Timer, primary: true },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
];

export function Logo({ size = 'md' }) {
  const big = size === 'lg';
  return (
    <span className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className={big ? 'h-10 w-10' : 'h-8 w-8'} />
      <span className={`font-display font-semibold tracking-tight text-ink-950 ${big ? 'text-2xl' : 'text-xl'}`}>
        Cadence<span className="text-clay">.</span>
      </span>
    </span>
  );
}

const topLink = ({ isActive }) =>
  `rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-ink-900 text-ink-50' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
  }`;

const bottomLink = ({ isActive }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
    isActive ? 'text-brand-700' : 'text-ink-500'
  }`;

function FocusPill() {
  const { session, running, remaining } = useFocusSession();
  if (!session) return null;
  return (
    <Link
      to="/focus"
      className="num flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-200"
      title={`Focusing on ${session.taskTitle}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-clay' : 'bg-ink-400'}`} />
      {remaining === 0 ? 'Done' : formatClock(remaining)}
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
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

  const initials = user?.name
    ?.split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex h-9 w-9 items-center justify-center rounded-full bg-clay/15 text-sm font-semibold text-clay hover:bg-clay/25"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initials || <UserRound className="h-4 w-4" />}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-60 overflow-hidden p-1.5 shadow-lift">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-ink-500">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-ink-100" />
          {/* Secondary pages live here on small screens, where the bottom bar has no room. */}
          {NAV.filter((n) => !n.primary).map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-ink-100 lg:hidden">
              <Icon className="h-4 w-4 text-ink-500" /> {label}
            </Link>
          ))}
          <Link to="/settings" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-ink-100">
            <Settings className="h-4 w-4 text-ink-500" /> Settings
          </Link>
          <button
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-100"
            onClick={() => logout.mutate()}
          >
            <LogOut className="h-4 w-4 text-ink-500" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-ink-50/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="Cadence home">
            <Logo />
          </Link>
          <nav className="mx-auto hidden items-center gap-1 lg:flex">
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={topLink}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            <FocusPill />
            <button
              className="btn-ghost p-2"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-200 bg-surface/95 backdrop-blur-md lg:hidden">
        {NAV.filter((n) => n.primary).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={bottomLink}>
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
