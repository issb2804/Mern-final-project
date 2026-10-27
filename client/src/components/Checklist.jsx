import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Plus, X } from 'lucide-react';
import { del, patch, post } from '../lib/api';
import { useRefreshPlan } from '../lib/queries';
import { ProgressBar } from './ui';

export default function Checklist({ taskId, items }) {
  const [text, setText] = useState('');
  const refreshPlan = useRefreshPlan();
  const onError = (err) => {
    refreshPlan();
    toast.error(err.message);
  };

  const add = useMutation({
    mutationFn: (value) => post(`/tasks/${taskId}/checklist`, { text: value }),
    onSuccess: () => {
      setText('');
      refreshPlan();
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (item) => patch(`/tasks/${taskId}/checklist/${item.id}`, { done: !item.done }),
    onSuccess: refreshPlan,
    onError,
  });
  const remove = useMutation({
    mutationFn: (item) => del(`/tasks/${taskId}/checklist/${item.id}`),
    onSuccess: refreshPlan,
    onError,
  });

  const done = items.filter((i) => i.done).length;

  const submit = (e) => {
    e.preventDefault();
    if (text.trim()) add.mutate(text.trim());
  };

  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="section-title">Checklist</h2>
        {items.length > 0 && (
          <span className="num text-xs text-ink-500">
            {done}/{items.length} done
          </span>
        )}
      </div>
      {items.length > 0 && (
        <div className="mt-3">
          <ProgressBar value={done} max={items.length} tone="bar-done" />
        </div>
      )}

      <ul className="mt-3 space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-ink-100/60">
            <button
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                item.done ? 'border-brand-600 bg-brand-600 text-on-accent' : 'border-ink-300 hover:border-brand-500'
              }`}
              onClick={() => toggle.mutate(item)}
              aria-label={item.done ? `Mark "${item.text}" not done` : `Mark "${item.text}" done`}
              aria-pressed={item.done}
            >
              {item.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <span className={`min-w-0 flex-1 text-sm ${item.done ? 'text-ink-400 line-through' : 'text-ink-800'}`}>{item.text}</span>
            <button
              className="rounded-md p-1 text-ink-400 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
              onClick={() => remove.mutate(item)}
              aria-label={`Remove "${item.text}"`}
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={items.length ? 'Add another step' : 'Break it down: add a first step'}
          maxLength={200}
          aria-label="New checklist step"
        />
        <button type="submit" className="btn-secondary shrink-0 px-3" disabled={!text.trim() || add.isPending} aria-label="Add step">
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
