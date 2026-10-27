import { WEEKDAYS } from '../models/User.js';
import { buildDays, floorQuarter, toLocal, usableHoursForTask } from './calendar.js';
import { remainingHours } from './priority.js';
import { round2 } from '../utils/time.js';

const EPS = 0.01;

/**
 * Builds a day-by-day study plan and detects conflicts.
 *
 * Allocation is earliest-deadline-first: each day's capacity goes to the
 * unfinished task with the nearest deadline (ties broken by priority score).
 * On a single shared resource (the student's time) EDF is optimal for meeting
 * deadlines: if any plan completes every task on time, EDF does too. So any
 * task EDF cannot finish is a real conflict, not an artefact of the plan.
 */
export function buildSchedule({ tasks, availability, timezone, now = new Date(), scores = new Map() }) {
  const zone = timezone || 'UTC';
  const nowMs = now.getTime();
  const open = tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => new Date(t.dueAt).getTime() <= nowMs);
  const upcoming = open.filter((t) => new Date(t.dueAt).getTime() > nowMs);
  const pending = upcoming.filter((t) => remainingHours(t) > 0);

  const lastDue = pending.reduce((max, t) => Math.max(max, new Date(t.dueAt).getTime()), nowMs);
  const days = buildDays({ now, until: new Date(lastDue), availability, timezone: zone }).map((d) => ({
    ...d,
    used: 0,
    blocks: [],
  }));

  const states = pending
    .map((t) => ({
      task: t,
      id: String(t._id),
      dueMs: new Date(t.dueAt).getTime(),
      dueLocal: toLocal(t.dueAt, zone),
      left: remainingHours(t),
      lastDay: null,
    }))
    .sort((a, b) => a.dueMs - b.dueMs || (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));

  for (const day of days) {
    for (const s of states) {
      const free = day.capacity - day.used;
      if (free < EPS) break;
      if (s.left < EPS) continue;
      const amount = round2(Math.min(s.left, floorQuarter(Math.min(free, usableHoursForTask(day, s.dueLocal)))));
      if (amount <= 0) continue;
      s.left = round2(s.left - amount);
      s.lastDay = day.date;
      day.used = round2(day.used + amount);
      day.blocks.push({
        taskId: s.id,
        title: s.task.title,
        course: s.task.course || '',
        type: s.task.type,
        dueAt: new Date(s.dueMs).toISOString(),
        hours: amount,
      });
    }
  }

  const conflicts = [];
  const totalWeekly = WEEKDAYS.reduce((sum, d) => sum + (Number(availability?.[d]) || 0), 0);
  if (totalWeekly === 0 && open.length > 0) {
    conflicts.push({
      type: 'no_availability',
      severity: 'high',
      taskIds: [],
      message: 'You have not set any study hours, so nothing can be scheduled.',
      suggestion: 'Set your weekly availability in Settings.',
    });
  }

  for (const t of overdue) {
    const left = remainingHours(t);
    conflicts.push({
      type: 'overdue',
      severity: 'high',
      taskIds: [String(t._id)],
      dueAt: new Date(t.dueAt).toISOString(),
      message: `"${t.title}" is past its deadline${left > 0 ? ` with ${left}h of work left` : ''}.`,
      suggestion: 'Finish and mark it done, or move the deadline if you got an extension.',
    });
  }

  const shortfalls = new Map();
  const finishDates = new Map();
  for (const s of states) {
    if (s.left >= EPS) {
      shortfalls.set(s.id, s.left);
      conflicts.push({
        type: 'infeasible',
        severity: 'high',
        taskIds: [s.id],
        dueAt: new Date(s.dueMs).toISOString(),
        shortfallHours: s.left,
        message: `"${s.task.title}" is ${s.left}h short: there isn't enough free study time before its deadline.`,
        suggestion: `Add about ${Math.ceil(s.left)}h of availability before ${s.dueLocal.toFormat('ccc d LLL')}, reduce the scope, or ask for an extension.`,
      });
    } else if (s.lastDay) {
      finishDates.set(s.id, s.lastDay);
    }
  }

  // Several deadlines on one day compete for the same final hours.
  const byDay = new Map();
  for (const t of upcoming) {
    const key = toLocal(t.dueAt, zone).toISODate();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(t);
  }
  for (const [date, group] of byDay) {
    const exams = group.filter((t) => t.type === 'exam').length;
    if (group.length >= 3 || (group.length >= 2 && exams >= 1)) {
      conflicts.push({
        type: 'deadline_cluster',
        severity: 'medium',
        taskIds: group.map((t) => String(t._id)),
        date,
        message: `${group.length} deadlines fall on ${toLocal(group[0].dueAt, zone).toFormat('cccc d LLL')}${
          exams ? `, including ${exams} exam${exams > 1 ? 's' : ''}` : ''
        }.`,
        suggestion: "Start these early so they don't compete for time in the last few days.",
      });
    }
  }

  const severityRank = { high: 0, medium: 1 };
  conflicts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const remaining = round2(pending.reduce((sum, t) => sum + remainingHours(t), 0));
  const scheduled = round2(days.reduce((sum, d) => sum + d.used, 0));
  return {
    days: days.map(({ start, ...d }) => d),
    conflicts,
    shortfalls,
    finishDates,
    summary: {
      remainingHours: remaining,
      availableHours: round2(days.reduce((sum, d) => sum + d.capacity, 0)),
      scheduledHours: scheduled,
      unscheduledHours: round2(remaining - scheduled),
      feasible: shortfalls.size === 0 && overdue.length === 0,
      weeklyAvailability: totalWeekly,
    },
  };
}
