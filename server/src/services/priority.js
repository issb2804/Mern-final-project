import { round2 } from '../utils/time.js';

// Relative stakes of each kind of work: exams are rarely recoverable, quizzes usually are.
export const TYPE_WEIGHT = { exam: 1, project: 0.8, assignment: 0.6, quiz: 0.5, other: 0.3 };

// Score components and their maximum contribution (sums to 100).
const WEIGHTS = { pressure: 45, urgency: 30, difficulty: 15, type: 10 };

export function remainingHours(task) {
  if (task.status === 'done') return 0;
  return round2(Math.max(0, task.estimatedHours - (task.hoursSpent || 0)));
}

function describeTime(hours) {
  if (hours < 1) return 'less than an hour';
  if (hours < 48) return `${Math.round(hours)} hours`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * Scores one task from 0–100 and explains why.
 *
 * - pressure:   remaining work ÷ study hours available before the deadline
 * - urgency:    decays exponentially with days left (half-life ≈ 5 days)
 * - difficulty: the student's 1–5 rating
 * - type:       exams > projects > assignments > quizzes
 *
 * `capacityHours` comes from the user's weekly availability, so a task due in
 * three days is more urgent for someone with 1h/day than with 6h/day.
 */
export function scoreTask(task, { now, capacityHours }) {
  const remaining = remainingHours(task);
  const hoursLeft = (new Date(task.dueAt).getTime() - now.getTime()) / 3_600_000;
  const base = { remaining, hoursLeft: round2(hoursLeft), capacityHours };

  if (task.status === 'done') {
    return { ...base, score: 0, risk: 'done', pressure: 0, breakdown: null, reasons: [] };
  }
  if (hoursLeft <= 0) {
    return {
      ...base,
      score: 100,
      risk: 'overdue',
      pressure: null,
      breakdown: null,
      reasons: ['The deadline has passed'],
    };
  }

  const pressure = remaining === 0 ? 0 : capacityHours > 0 ? remaining / capacityHours : Infinity;
  const daysLeft = hoursLeft / 24;
  const breakdown = {
    pressure: (WEIGHTS.pressure * Math.min(pressure, 1.5)) / 1.5,
    urgency: WEIGHTS.urgency * Math.exp(-daysLeft / 7),
    difficulty: (WEIGHTS.difficulty * (task.difficulty - 1)) / 4,
    type: WEIGHTS.type * (TYPE_WEIGHT[task.type] ?? TYPE_WEIGHT.other),
  };
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  let risk = 'on_track';
  if (pressure > 1) risk = 'critical';
  else if (pressure >= 0.7 || (hoursLeft < 24 && remaining > 0)) risk = 'at_risk';

  const reasons = [];
  if (!Number.isFinite(pressure)) {
    reasons.push('You have no study hours set before this deadline');
  } else if (pressure >= 0.4) {
    reasons.push(
      `Needs ${remaining}h of the ${capacityHours}h you have free before it is due (${Math.round(pressure * 100)}%)`,
    );
  }
  if (daysLeft < 3) reasons.push(`Due in ${describeTime(hoursLeft)}`);
  if (task.difficulty >= 4) reasons.push(`Rated difficult (${task.difficulty}/5)`);
  if (task.type === 'exam') reasons.push('Exams carry the highest stakes');
  if (reasons.length === 0) reasons.push(`Due in ${describeTime(hoursLeft)} with plenty of time to spare`);

  return {
    ...base,
    score: Math.min(99, Math.round(total)),
    risk,
    pressure: Number.isFinite(pressure) ? round2(pressure) : null,
    breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, round2(v)])),
    reasons,
  };
}
