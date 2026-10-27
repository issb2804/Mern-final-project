import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule } from '../src/services/scheduler.js';
import { scoreTask } from '../src/services/priority.js';
import { buildPlan, previewImpact } from '../src/services/planner.js';

// Monday 2 Nov 2026, 08:00 UTC
const now = new Date('2026-11-02T08:00:00Z');
const every = (h) => ({ mon: h, tue: h, wed: h, thu: h, fri: h, sat: h, sun: h });
const user = { timezone: 'UTC', availability: every(4) };

let seq = 0;
const task = (overrides) => ({
  _id: `t${++seq}`,
  title: `Task ${seq}`,
  type: 'assignment',
  difficulty: 3,
  hoursSpent: 0,
  status: 'todo',
  ...overrides,
});

test('a task that fits is scheduled across days before its deadline', () => {
  const t = task({ estimatedHours: 6, dueAt: '2026-11-04T20:00:00Z' });
  const s = buildSchedule({ tasks: [t], availability: every(4), timezone: 'UTC', now });
  assert.equal(s.summary.feasible, true);
  assert.deepEqual(
    s.days.filter((d) => d.used > 0).map((d) => [d.date, d.used]),
    [
      ['2026-11-02', 4],
      ['2026-11-03', 2],
    ],
  );
  assert.equal(s.finishDates.get(t._id), '2026-11-03');
});

test('a task without enough time before its deadline is reported with its shortfall', () => {
  const t = task({ estimatedHours: 10, dueAt: '2026-11-03T20:00:00Z' });
  const s = buildSchedule({ tasks: [t], availability: every(4), timezone: 'UTC', now });
  assert.equal(s.summary.feasible, false);
  assert.equal(s.shortfalls.get(t._id), 2);
  assert.equal(s.conflicts[0].type, 'infeasible');
});

test('hours already spent reduce the work left to schedule', () => {
  const t = task({ estimatedHours: 10, hoursSpent: 3, dueAt: '2026-11-03T20:00:00Z' });
  const s = buildSchedule({ tasks: [t], availability: every(4), timezone: 'UTC', now });
  assert.equal(s.summary.feasible, true);
  assert.equal(s.summary.scheduledHours, 7);
});

test('competing deadlines make the later task critical even if it looks fine alone', () => {
  const a = task({ title: 'Essay', estimatedHours: 4, dueAt: '2026-11-03T20:00:00Z' });
  const b = task({ title: 'Lab report', estimatedHours: 6, dueAt: '2026-11-03T22:00:00Z' });

  // On its own, b needs 6 of 8 available hours: at risk but possible.
  const alone = buildPlan({ tasks: [b], user, now });
  assert.equal(alone.tasks[0].priority.risk, 'at_risk');

  const plan = buildPlan({ tasks: [a, b], user, now });
  const lab = plan.tasks.find((t) => t.id === b._id);
  assert.equal(lab.shortfallHours, 2);
  assert.equal(lab.priority.risk, 'critical');
  assert.ok(lab.priority.score >= 90);
  assert.equal(plan.tasks[0].id, b._id, 'the critical task is ranked first');
});

test('overdue and completed tasks are handled separately from the plan', () => {
  const late = task({ estimatedHours: 3, dueAt: '2026-11-01T10:00:00Z' });
  const done = task({ estimatedHours: 3, status: 'done', dueAt: '2026-11-03T10:00:00Z' });
  const s = buildSchedule({ tasks: [late, done], availability: every(4), timezone: 'UTC', now });
  assert.equal(s.summary.scheduledHours, 0);
  assert.deepEqual(
    s.conflicts.map((c) => c.type),
    ['overdue'],
  );
});

test('an exam sharing a day with another deadline is flagged as a cluster', () => {
  const tasks = [
    task({ type: 'exam', estimatedHours: 2, dueAt: '2026-11-06T09:00:00Z' }),
    task({ estimatedHours: 2, dueAt: '2026-11-06T18:00:00Z' }),
  ];
  const s = buildSchedule({ tasks, availability: every(4), timezone: 'UTC', now });
  const cluster = s.conflicts.find((c) => c.type === 'deadline_cluster');
  assert.ok(cluster);
  assert.equal(cluster.date, '2026-11-06');
});

test('deadlines are interpreted in the user timezone', () => {
  // 03:00 UTC on Tuesday is 08:30 in Kolkata: only 0.5h of study time that morning.
  const t = task({ estimatedHours: 4.5, dueAt: '2026-11-03T03:00:00Z' });
  const kolkataNow = new Date('2026-11-02T02:30:00Z'); // 08:00 IST Monday
  const s = buildSchedule({ tasks: [t], availability: every(4), timezone: 'Asia/Kolkata', now: kolkataNow });
  assert.equal(s.summary.feasible, true);
  assert.deepEqual(
    s.days.map((d) => [d.date, d.used]),
    [
      ['2026-11-02', 4],
      ['2026-11-03', 0.5],
    ],
  );
});

test('exams outrank quizzes with otherwise identical numbers', () => {
  const base = { estimatedHours: 3, difficulty: 3, dueAt: '2026-11-06T12:00:00Z' };
  const exam = scoreTask(task({ ...base, type: 'exam' }), { now, capacityHours: 16 });
  const quiz = scoreTask(task({ ...base, type: 'quiz' }), { now, capacityHours: 16 });
  assert.ok(exam.score > quiz.score);
});

test('no availability before a deadline makes a task critical', () => {
  const r = scoreTask(task({ estimatedHours: 2, dueAt: '2026-11-03T12:00:00Z' }), { now, capacityHours: 0 });
  assert.equal(r.risk, 'critical');
  assert.equal(r.pressure, null);
});

test('preview reports which existing tasks a new task would endanger', () => {
  const existing = task({ title: 'Project', estimatedHours: 6, dueAt: '2026-11-03T22:00:00Z' });
  const result = previewImpact({
    tasks: [existing],
    candidate: { title: 'Quiz prep', type: 'quiz', difficulty: 2, estimatedHours: 4, dueAt: '2026-11-03T12:00:00Z' },
    user,
    now,
  });
  assert.deepEqual(
    result.newlyAtRisk.map((t) => [t.title, t.shortfallHours]),
    [['Project', 2]],
  );
  assert.equal(result.candidate.shortfallHours, 0);
  assert.equal(result.summaryBefore.feasible, true);
  assert.equal(result.summaryAfter.feasible, false);
});
