import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { patch } from '../lib/api';
import { useRefreshPlan } from '../lib/queries';
import { browserTimezone, WEEKDAYS } from '../lib/format';
import { Field, Spinner } from '../components/ui';

const TIMEZONES = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const refreshPlan = useRefreshPlan();
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [availability, setAvailability] = useState(user.availability);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setName(user.name);
    setTimezone(user.timezone);
    setAvailability(user.availability);
  }, [user]);

  const weekly = useMemo(() => WEEKDAYS.reduce((s, d) => s + (Number(availability[d.key]) || 0), 0), [availability]);
  const zones = TIMEZONES.includes(timezone) || !timezone ? TIMEZONES : [timezone, ...TIMEZONES];

  const save = useMutation({
    mutationFn: (body) => patch('/auth/me', body),
    onSuccess: (data) => {
      setUser(data.user);
      refreshPlan();
      toast.success('Settings saved. Your plan has been recalculated.');
    },
    onError: (err) => {
      setErrors(err.fields || {});
      toast.error(err.message);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const hours = Object.fromEntries(WEEKDAYS.map((d) => [d.key, Number(availability[d.key]) || 0]));
    const bad = WEEKDAYS.find((d) => hours[d.key] < 0 || hours[d.key] > 16);
    if (!name.trim()) return setErrors({ name: 'Name is required' });
    if (bad) return setErrors({ [`availability.${bad.key}`]: 'Between 0 and 16 hours' });
    setErrors({});
    save.mutate({ name: name.trim(), timezone, availability: hours });
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">Your study hours drive every priority score and the study plan.</p>
      </div>

      <section className="card space-y-4 p-5">
        <h2 className="section-title">Weekly study hours</h2>
        <p className="-mt-2 text-sm text-ink-500">
          Be realistic: hours you can actually spend on coursework, after classes, work and rest.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
          {WEEKDAYS.map((d) => (
            <Field key={d.key} label={d.short} error={errors[`availability.${d.key}`]} htmlFor={`av-${d.key}`}>
              <input
                id={`av-${d.key}`}
                type="number"
                min="0"
                max="16"
                step="0.5"
                inputMode="decimal"
                className="input num"
                value={availability[d.key]}
                onChange={(e) => setAvailability((a) => ({ ...a, [d.key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        <p className="num text-sm text-ink-600">
          {weekly}h per week{weekly === 0 && <span className="text-rose-600"> — nothing can be scheduled with zero hours</span>}
        </p>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="section-title">Profile</h2>
        <Field label="Name" error={errors.name} htmlFor="name">
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" className="input bg-ink-50" value={user.email} disabled />
        </Field>
        <Field
          label="Timezone"
          error={errors.timezone}
          hint="Deadlines and daily study hours are worked out in this timezone."
          htmlFor="timezone"
        >
          <div className="flex gap-2">
            <select id="timezone" className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            {timezone !== browserTimezone() && (
              <button type="button" className="btn-secondary shrink-0" onClick={() => setTimezone(browserTimezone())}>
                Use this device's
              </button>
            )}
          </div>
        </Field>
      </section>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending && <Spinner className="h-4 w-4 text-on-accent" />}
          Save settings
        </button>
      </div>
    </form>
  );
}
