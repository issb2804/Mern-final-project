import { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-ink-400 ${className}`} aria-hidden />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-sm text-ink-500" role="status">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <div>
        <p className="font-semibold text-ink-900">{title}</p>
        <p className="mt-1 text-sm text-ink-500">{error?.message || 'Something went wrong.'}</p>
      </div>
      {onRetry && (
        <button className="btn-secondary" onClick={() => onRetry()}>
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {Icon && (
        <div className="rounded-2xl bg-brand-50 p-3.5 ring-1 ring-brand-200">
          <Icon className="h-6 w-6 text-brand-600" />
        </div>
      )}
      <div>
        <p className="font-display text-lg font-semibold text-ink-900">{title}</p>
        {children && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  const dialogRef = useRef(null);
  // Kept in a ref so re-renders with a new onClose don't re-run the effect and steal focus.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('input, select, textarea, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/40 backdrop-blur-[2px] p-4 sm:py-12">
      <div className="fixed inset-0" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card relative w-full shadow-lift ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>
      )}
    </div>
  );
}

const RISK = {
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-800 ring-red-200' },
  critical: { label: 'Critical', cls: 'bg-rose-100 text-rose-800 ring-rose-200' },
  at_risk: { label: 'At risk', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
  on_track: { label: 'On track', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  done: { label: 'Done', cls: 'bg-ink-100 text-ink-500 ring-ink-200' },
};

export function RiskBadge({ risk }) {
  const r = RISK[risk] ?? RISK.on_track;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${r.cls}`}>
      {r.label}
    </span>
  );
}

export const SCORE_TONE = (score, risk) => {
  if (risk === 'done') return 'text-ink-400 bg-ink-100';
  if (risk === 'overdue' || risk === 'critical' || score >= 75) return 'text-rose-800 bg-rose-100';
  if (risk === 'at_risk' || score >= 50) return 'text-amber-800 bg-amber-100';
  return 'text-brand-800 bg-brand-100';
};

export function ScoreChip({ score, risk }) {
  return (
    <span
      className={`num inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${SCORE_TONE(score, risk)}`}
      title="Priority score (0–100)"
    >
      {risk === 'done' ? '✓' : score}
    </span>
  );
}

export function ProgressBar({ value, max, tone = 'bar-brand' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint, tone = 'text-ink-950', icon: Icon }) {
  return (
    <div className="card px-5 py-4">
      <p className="eyebrow flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className={`mt-2 font-display text-3xl font-semibold ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
