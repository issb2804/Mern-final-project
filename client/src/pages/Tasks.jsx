import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListChecks, Plus, Search, SearchX } from 'lucide-react';
import { useTasks } from '../lib/queries';
import { TASK_TYPES } from '../lib/format';
import TaskRow from '../components/TaskRow';
import TaskFormModal from '../components/TaskFormModal';
import ProgressModal from '../components/ProgressModal';
import { EmptyState, ErrorState, PageLoader, Spinner } from '../components/ui';

const STATUS_TABS = [
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
];

export default function Tasks() {
  // Filters live in the URL so they survive refreshes and can be shared or bookmarked.
  const [params, setParams] = useSearchParams();
  const filters = {
    status: params.get('status') || 'open',
    course: params.get('course') || '',
    type: params.get('type') || '',
    sort: params.get('sort') || 'priority',
    q: params.get('q') || '',
  };
  const [search, setSearch] = useState(filters.q);
  const [adding, setAdding] = useState(false);
  const [logging, setLogging] = useState(null);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const id = setTimeout(() => search !== filters.q && setFilter('q', search.trim()), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, isPending, error, refetch, isFetching } = useTasks(filters);
  const filtered = filters.course || filters.type || filters.q;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="mt-2 text-ink-600">Ranked by priority: the top of the list is what to work on next.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add deadline
        </button>
      </div>

      <div className="card flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:rounded-full lg:pl-2">
        <div className="flex rounded-full bg-ink-100 p-1" role="tablist">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={filters.status === t.value}
              onClick={() => setFilter('status', t.value === 'open' ? '' : t.value)}
              className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium lg:flex-none ${
                filters.status === t.value ? 'bg-surface text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Search by title or course"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search tasks"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:flex">
          <select className="input lg:w-36" value={filters.course} onChange={(e) => setFilter('course', e.target.value)} aria-label="Course">
            <option value="">All courses</option>
            {data?.courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className="input lg:w-32" value={filters.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Type">
            <option value="">All types</option>
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            className="input lg:w-36"
            value={filters.sort}
            onChange={(e) => setFilter('sort', e.target.value === 'priority' ? '' : e.target.value)}
            aria-label="Sort"
          >
            <option value="priority">By priority</option>
            <option value="due">By deadline</option>
            <option value="created">Newest first</option>
          </select>
        </div>
      </div>

      {isPending ? (
        <PageLoader />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="card relative">
          {isFetching && (
            <div className="absolute right-3 top-3">
              <Spinner className="h-4 w-4" />
            </div>
          )}
          {data.tasks.length > 0 ? (
            <ul className="divide-y divide-ink-100">
              {data.tasks.map((task) => (
                <TaskRow key={task.id} task={task} onLogProgress={setLogging} />
              ))}
            </ul>
          ) : data.total === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              action={
                <button className="btn-primary" onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" /> Add a deadline
                </button>
              }
            >
              Add your assignments, exams and projects, and they'll be ranked here automatically.
            </EmptyState>
          ) : (
            <EmptyState
              icon={SearchX}
              title={filtered ? 'No tasks match these filters' : `No ${filters.status === 'done' ? 'completed' : 'open'} tasks`}
              action={
                filtered && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setSearch('');
                      setParams(filters.status === 'open' ? {} : { status: filters.status }, { replace: true });
                    }}
                  >
                    Clear filters
                  </button>
                )
              }
            />
          )}
        </div>
      )}

      <TaskFormModal open={adding} onClose={() => setAdding(false)} courses={data?.courses} />
      <ProgressModal open={!!logging} task={logging} onClose={() => setLogging(null)} />
    </div>
  );
}
