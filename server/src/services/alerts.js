import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { buildPlan } from './planner.js';
import { toLocal } from './calendar.js';

function alertsFor(task, { timezone, today }) {
  const due = toLocal(task.dueAt, timezone).toFormat('ccc d LLL, HH:mm');
  const left = task.remainingHours > 0 ? ` ${task.remainingHours}h of work left.` : '';
  const h = task.hoursUntilDue;
  const alerts = [];

  if (h <= 0) {
    alerts.push({ kind: 'overdue', dedupeKey: task.dueAt, message: `"${task.title}" was due ${due} and isn't marked done.` });
  } else if (h <= 24) {
    alerts.push({ kind: 'due_24h', dedupeKey: task.dueAt, message: `"${task.title}" is due within 24 hours (${due}).${left}` });
  } else if (h <= 72) {
    alerts.push({ kind: 'due_72h', dedupeKey: task.dueAt, message: `"${task.title}" is due in under 3 days (${due}).${left}` });
  }

  // At most one at-risk alert per task per day, so a persistent problem doesn't spam.
  if (h > 0 && task.priority.risk === 'critical') {
    alerts.push({
      kind: 'at_risk',
      dedupeKey: today,
      message:
        task.shortfallHours > 0
          ? `"${task.title}" is ${task.shortfallHours}h short of finishing before ${due} at your current availability.`
          : `"${task.title}" needs more hours than you have free before ${due}.`,
    });
  }
  return alerts;
}

/**
 * Creates any due-soon / overdue / at-risk notifications the user should have.
 * Idempotent: a unique index on (user, task, kind, dedupeKey) plus $setOnInsert
 * means repeated or concurrent sweeps never create duplicates.
 */
export async function sweepUser(user, now = new Date()) {
  const tasks = await Task.find({ user: user._id, status: { $ne: 'done' } }).select('-progressLog').lean();
  let created = 0;

  if (tasks.length) {
    const { tasks: planned } = buildPlan({ tasks, user, now });
    const today = toLocal(now, user.timezone).toISODate();
    const ops = planned.flatMap((task) =>
      alertsFor(task, { timezone: user.timezone, today }).map(({ kind, dedupeKey, message }) => ({
        updateOne: {
          filter: { user: user._id, task: task.id, kind, dedupeKey },
          update: { $setOnInsert: { message, read: false } },
          upsert: true,
        },
      })),
    );
    if (ops.length) {
      try {
        const result = await Notification.bulkWrite(ops, { ordered: false });
        created = result.upsertedCount;
      } catch (err) {
        // A concurrent sweep inserted the same alert first; that's the outcome we want anyway.
        if (err?.code !== 11000 && !err?.writeErrors?.every((e) => e.code === 11000)) throw err;
      }
    }
  }

  await User.updateOne({ _id: user._id }, { lastAlertSweepAt: now });
  return created;
}

/** Runs the sweep for every user who has unfinished tasks. */
export async function sweepAll(now = new Date()) {
  const userIds = await Task.distinct('user', { status: { $ne: 'done' } });
  let users = 0;
  let created = 0;
  for await (const user of User.find({ _id: { $in: userIds } }).cursor()) {
    try {
      created += await sweepUser(user, now);
      users += 1;
    } catch (err) {
      console.error(`[alerts] sweep failed for user ${user._id}:`, err);
    }
  }
  return { users, created };
}
