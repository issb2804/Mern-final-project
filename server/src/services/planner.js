import { buildDays, capacityUntil, toLocal } from './calendar.js';
import { remainingHours, scoreTask } from './priority.js';
import { buildSchedule } from './scheduler.js';

export function toTaskDTO(t) {
  return {
    id: String(t._id),
    title: t.title,
    course: t.course || '',
    type: t.type,
    dueAt: new Date(t.dueAt).toISOString(),
    difficulty: t.difficulty,
    estimatedHours: t.estimatedHours,
    originalEstimate: t.originalEstimate ?? t.estimatedHours,
    hoursSpent: t.hoursSpent || 0,
    status: t.status,
    notes: t.notes || '',
    completedAt: t.completedAt ?? null,
    createdAt: t.createdAt ?? null,
    updatedAt: t.updatedAt ?? null,
    checklistTotal: t.checklist?.length ?? 0,
    checklistDone: t.checklist?.filter((i) => i.done).length ?? 0,
    // Sent back on edits so the server can reject changes based on a stale copy.
    version: t.__v ?? 0,
  };
}

/**
 * Scores every task, builds the schedule, and merges the two: a task the
 * scheduler can't fit in time is critical even if its own numbers look fine,
 * because other deadlines are taking its hours.
 */
export function buildPlan({ tasks, user, now = new Date() }) {
  const timezone = user.timezone || 'UTC';
  const availability = user.availability || {};

  const lastDue = tasks.reduce((max, t) => Math.max(max, new Date(t.dueAt).getTime()), now.getTime());
  const days = buildDays({ now, until: new Date(lastDue), availability, timezone });

  const scored = tasks.map((task) => ({
    task,
    result: scoreTask(task, { now, capacityHours: capacityUntil(days, toLocal(task.dueAt, timezone)) }),
  }));
  const scores = new Map(scored.map(({ task, result }) => [String(task._id), result.score]));
  const schedule = buildSchedule({ tasks, availability, timezone, now, scores });

  const annotated = scored.map(({ task, result }) => {
    const id = String(task._id);
    const shortfall = schedule.shortfalls.get(id) ?? 0;
    let { score, risk } = result;
    const reasons = [...result.reasons];
    if (shortfall > 0 && risk !== 'overdue') {
      risk = 'critical';
      score = Math.max(score, 90);
      reasons.unshift(`Other deadlines leave it ${shortfall}h short of finishing in time`);
    }
    return {
      ...toTaskDTO(task),
      remainingHours: remainingHours(task),
      hoursUntilDue: result.hoursLeft,
      projectedFinish: schedule.finishDates.get(id) ?? null,
      shortfallHours: shortfall,
      priority: {
        score,
        risk,
        pressure: result.pressure,
        capacityHours: result.capacityHours,
        breakdown: result.breakdown,
        reasons,
      },
    };
  });

  annotated.sort(
    (a, b) =>
      (a.status === 'done') - (b.status === 'done') ||
      b.priority.score - a.priority.score ||
      new Date(a.dueAt) - new Date(b.dueAt),
  );

  const { shortfalls, finishDates, ...publicSchedule } = schedule;
  return { tasks: annotated, schedule: publicSchedule };
}

const conflictKey = (c) => `${c.type}:${[...c.taskIds].sort().join(',')}:${c.date ?? ''}`;

/**
 * What-if analysis: how would the plan change if `candidate` were added
 * (or, with `replaceId`, if an existing task were edited)?
 */
export function previewImpact({ tasks, candidate, user, now = new Date(), replaceId }) {
  const candidateId = replaceId || '__preview__';
  const before = buildPlan({ tasks, user, now });

  const afterTasks = replaceId
    ? tasks.map((t) => (String(t._id) === replaceId ? { ...t, ...candidate, _id: t._id } : t))
    : [...tasks, { status: 'todo', hoursSpent: 0, ...candidate, _id: candidateId }];
  const after = buildPlan({ tasks: afterTasks, user, now });

  const beforeById = new Map(before.tasks.map((t) => [t.id, t]));
  const newlyAtRisk = after.tasks
    .filter((t) => t.id !== candidateId && t.shortfallHours > 0)
    .filter((t) => t.shortfallHours > (beforeById.get(t.id)?.shortfallHours ?? 0))
    .map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, shortfallHours: t.shortfallHours }));

  const beforeKeys = new Set(before.schedule.conflicts.map(conflictKey));
  const self = after.tasks.find((t) => t.id === candidateId);

  return {
    candidate: self
      ? {
          priority: self.priority,
          projectedFinish: self.projectedFinish,
          shortfallHours: self.shortfallHours,
          remainingHours: self.remainingHours,
        }
      : null,
    newlyAtRisk,
    newConflicts: after.schedule.conflicts.filter((c) => !beforeKeys.has(conflictKey(c))),
    summaryBefore: before.schedule.summary,
    summaryAfter: after.schedule.summary,
  };
}
