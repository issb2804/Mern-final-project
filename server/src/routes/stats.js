import { Router } from 'express';
import { Task } from '../models/Task.js';
import { requireAuth } from '../middleware/auth.js';
import { buildPlan } from '../services/planner.js';
import { toLocal } from '../services/calendar.js';
import { round2 } from '../utils/time.js';

const router = Router();
router.use(requireAuth);

const HISTORY_DAYS = 14;

router.get('/', async (req, res) => {
  const tz = req.user.timezone;
  const now = new Date();
  const tasks = await Task.find({ user: req.user._id }).lean();
  const { tasks: planned } = buildPlan({ tasks, user: req.user, now });

  const open = planned.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const onTime = done.filter((t) => t.completedAt && t.completedAt <= t.dueAt).length;

  const risk = { overdue: 0, critical: 0, at_risk: 0, on_track: 0 };
  for (const t of open) risk[t.priority.risk] = (risk[t.priority.risk] ?? 0) + 1;

  // Hours logged per local day for the last two weeks, oldest first.
  const today = toLocal(now, tz).startOf('day');
  const hoursByDay = new Map();
  for (let i = HISTORY_DAYS - 1; i >= 0; i -= 1) hoursByDay.set(today.minus({ days: i }).toISODate(), 0);
  for (const t of tasks) {
    for (const entry of t.progressLog ?? []) {
      const key = toLocal(entry.at, tz).toISODate();
      if (hoursByDay.has(key)) hoursByDay.set(key, round2(hoursByDay.get(key) + entry.hours));
    }
  }

  // Actual ÷ first estimate for finished work: above 1 means the student tends to underestimate.
  const measured = done.filter((t) => t.originalEstimate > 0 && t.hoursSpent > 0);
  const estimationRatio = measured.length
    ? round2(measured.reduce((sum, t) => sum + t.hoursSpent / t.originalEstimate, 0) / measured.length)
    : null;

  const courses = new Map();
  for (const t of planned) {
    const key = t.course || 'No course';
    const c = courses.get(key) ?? { course: key, open: 0, done: 0, remainingHours: 0, hoursSpent: 0 };
    if (t.status === 'done') c.done += 1;
    else c.open += 1;
    c.remainingHours = round2(c.remainingHours + t.remainingHours);
    c.hoursSpent = round2(c.hoursSpent + t.hoursSpent);
    courses.set(key, c);
  }

  const weekAhead = now.getTime() + 7 * 24 * 3_600_000;
  res.json({
    totals: {
      tasks: tasks.length,
      open: open.length,
      done: done.length,
      dueThisWeek: open.filter((t) => new Date(t.dueAt).getTime() <= weekAhead && t.hoursUntilDue > 0).length,
      remainingHours: round2(open.reduce((sum, t) => sum + t.remainingHours, 0)),
      hoursLogged: round2(tasks.reduce((sum, t) => sum + (t.hoursSpent || 0), 0)),
    },
    risk,
    onTimeRate: done.length ? round2(onTime / done.length) : null,
    completedOnTime: onTime,
    completedLate: done.length - onTime,
    estimationRatio,
    estimationSample: measured.length,
    hoursByDay: [...hoursByDay].map(([date, hours]) => ({ date, hours })),
    courses: [...courses.values()].sort((a, b) => b.remainingHours - a.remainingHours),
  });
});

export default router;
