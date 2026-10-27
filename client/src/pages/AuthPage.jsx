import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlarmClock, CalendarDays, Gauge, Timer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { browserTimezone } from '../lib/format';
import { Logo } from '../components/Layout';
import { Field, Spinner } from '../components/ui';

const POINTS = [
  { icon: Gauge, title: 'Know what to do first', text: 'Every task gets a priority score from its deadline, effort, difficulty and your free time.' },
  { icon: CalendarDays, title: 'A plan that fits your week', text: 'Study hours are allocated day by day, earliest deadline first, within the hours you have.' },
  { icon: AlarmClock, title: 'Catch problems early', text: "See conflicts before they happen, and get alerted when work falls behind or a deadline gets close." },
  { icon: Timer, title: 'Focus, then log it', text: 'Run a focus timer on any task and the time is logged for you when it ends.' },
];

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const mutation = isLogin ? login : register;

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((errs) => ({ ...errs, [key]: undefined, _form: undefined }));
  };

  const submit = (e) => {
    e.preventDefault();
    const local = {};
    if (!isLogin && !form.name.trim()) local.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) local.email = 'Enter a valid email address';
    if (!isLogin && form.password.length < 8) local.password = 'Use at least 8 characters';
    if (isLogin && !form.password) local.password = 'Enter your password';
    if (Object.keys(local).length) return setErrors(local);

    const body = isLogin
      ? { email: form.email, password: form.password }
      : { ...form, timezone: browserTimezone() };
    mutation.mutate(body, {
      onSuccess: () => navigate(location.state?.from || '/', { replace: true }),
      onError: (err) => setErrors({ ...err.fields, _form: err.message }),
    });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#1f3f27] p-12 text-[#f6f1e6] lg:order-last lg:flex">
        <svg className="pointer-events-none absolute -right-24 top-24 h-[28rem] w-[28rem] opacity-20" viewBox="0 0 200 200" aria-hidden>
          {[90, 70, 50, 30].map((r) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="0.8" />
          ))}
        </svg>
        <span className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-[10px] ring-1 ring-white/20" />
          <span className="font-display text-2xl font-semibold tracking-tight">
            Cadence<span className="text-clay">.</span>
          </span>
        </span>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9cc2a0]">A calmer semester</p>
          <h1 className="mt-4 max-w-lg font-display text-5xl font-semibold leading-[1.08] tracking-tight">
            Find your rhythm. <span className="italic text-[#e8956b]">Meet every deadline.</span>
          </h1>
          <p className="mt-5 max-w-md text-[#c9dbc8]">
            Cadence turns your assignments, exams and projects into a ranked to-do list and a study plan that fits
            the hours you actually have.
          </p>
          <ul className="mt-10 grid max-w-xl gap-x-8 gap-y-6 sm:grid-cols-2">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon className="h-5 w-5 text-[#e8956b]" />
                <p className="mt-2 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-[#c9dbc8]">{text}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#9cc2a0]">Built for students juggling several courses at once.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <div className="card w-full max-w-sm p-7 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="lg:hidden">
            <Logo size="lg" />
            <p className="mt-3 text-sm text-ink-600">
              Prioritise assignments, exams and projects, and get a study plan that fits your week.
            </p>
          </div>
          <h2 className="mt-8 page-title lg:mt-0 lg:text-4xl">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {isLogin ? 'Log in to see your plan for today.' : 'It takes a few seconds. No card, no spam.'}
          </p>

          <form onSubmit={submit} noValidate className="mt-8 space-y-4">
            {!isLogin && (
              <Field label="Name" error={errors.name} htmlFor="name">
                <input id="name" className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={set('name')} autoComplete="name" />
              </Field>
            )}
            <Field label="Email" error={errors.email} htmlFor="email">
              <input
                id="email"
                type="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
              />
            </Field>
            <Field label="Password" error={errors.password} hint={!isLogin ? 'At least 8 characters' : undefined} htmlFor="password">
              <input
                id="password"
                type="password"
                className={`input ${errors.password ? 'input-error' : ''}`}
                value={form.password}
                onChange={set('password')}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </Field>

            {errors._form && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {errors._form}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner className="h-4 w-4 text-on-accent" />}
              {isLogin ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'} className="font-semibold text-brand-700 hover:underline">
              {isLogin ? 'Sign up' : 'Log in'}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
