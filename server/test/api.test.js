import './setup.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/db.js';
import { Notification } from '../src/models/Notification.js';
import { sweepUser } from '../src/services/alerts.js';
import { User } from '../src/models/User.js';

const app = createApp();
const inDays = (d, hour = 18) => {
  const date = new Date(Date.now() + d * 86_400_000);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

async function signUp(email) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: 'Test Student', email, password: 'correct-horse', timezone: 'UTC' });
  assert.equal(res.status, 201);
  return agent;
}

before(() => connectDB());
after(() => disconnectDB());

describe('auth', () => {
  test('register, read session, log out', async () => {
    const agent = await signUp('alice@example.com');
    const me = await agent.get('/api/auth/me');
    assert.equal(me.body.user.email, 'alice@example.com');
    assert.equal(me.body.user.passwordHash, undefined);

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  test('rejects duplicate emails and wrong passwords', async () => {
    await signUp('bob@example.com');
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'BOB@example.com', password: 'another-pass' });
    assert.equal(dup.status, 409);

    const bad = await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'nope-nope' });
    assert.equal(bad.status, 401);
    assert.equal(bad.body.error, 'Incorrect email or password');
  });

  test('validates input', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: '', email: 'x', password: 'short' });
    assert.equal(res.status, 400);
    assert.ok(res.body.fields.email && res.body.fields.password && res.body.fields.name);
  });

  test('protected routes need a session', async () => {
    await request(app).get('/api/tasks').expect(401);
  });
});

describe('tasks', () => {
  let agent;
  let taskId;

  before(async () => {
    agent = await signUp('carol@example.com');
  });

  test('creates a task with a priority and plan', async () => {
    const res = await agent.post('/api/tasks').send({
      title: 'DBMS assignment',
      course: 'CS301',
      type: 'assignment',
      dueAt: inDays(5),
      difficulty: 4,
      estimatedHours: 6,
    });
    assert.equal(res.status, 201);
    taskId = res.body.task.id;
    assert.ok(res.body.task.priority.score > 0);
    assert.equal(res.body.task.priority.risk, 'on_track');
    assert.ok(res.body.task.projectedFinish);
  });

  test('rejects past deadlines and duplicates', async () => {
    const past = await agent.post('/api/tasks').send({ title: 'Old', dueAt: inDays(-1), estimatedHours: 1 });
    assert.equal(past.status, 400);
    assert.ok(past.body.fields.dueAt);

    const list = await agent.get('/api/tasks');
    const dueAt = list.body.tasks[0].dueAt;
    const dup = await agent.post('/api/tasks').send({ title: 'dbms ASSIGNMENT', dueAt, estimatedHours: 2 });
    assert.equal(dup.status, 409);
  });

  test('other users cannot see or change the task', async () => {
    const mallory = await signUp('mallory@example.com');
    await mallory.get(`/api/tasks/${taskId}`).expect(404);
    await mallory.patch(`/api/tasks/${taskId}`).send({ title: 'pwned' }).expect(404);
    await mallory.delete(`/api/tasks/${taskId}`).expect(404);
    await mallory.get('/api/tasks/not-an-id').expect(404);
  });

  test('preview warns when a new task endangers an existing one', async () => {
    const res = await agent.post('/api/tasks/preview').send({
      title: 'Huge project',
      type: 'project',
      dueAt: inDays(3),
      estimatedHours: 40,
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.candidate.shortfallHours > 0);
    assert.equal(res.body.summaryAfter.feasible, false);
  });

  test('logs progress, re-estimates, and rejects stale versions', async () => {
    const { body } = await agent.get(`/api/tasks/${taskId}`);
    const version = body.task.version;

    const res = await agent
      .post(`/api/tasks/${taskId}/progress`)
      .send({ hours: 2, note: 'ER diagram', remainingHours: 5, version });
    assert.equal(res.status, 200);
    assert.equal(res.body.task.status, 'in_progress');
    assert.equal(res.body.task.hoursSpent, 2);
    assert.equal(res.body.task.estimatedHours, 7);

    // A second tab still holding the old version must not overwrite this.
    const stale = await agent.post(`/api/tasks/${taskId}/progress`).send({ hours: 1, version });
    assert.equal(stale.status, 409);

    const detail = await agent.get(`/api/tasks/${taskId}`);
    assert.equal(detail.body.task.progressLog[0].note, 'ER diagram');
    assert.equal(detail.body.task.remainingHours, 5);
  });

  test('marking done completes the task and blocks further logging', async () => {
    const res = await agent.post(`/api/tasks/${taskId}/progress`).send({ hours: 4, markDone: true });
    assert.equal(res.body.task.status, 'done');
    const again = await agent.post(`/api/tasks/${taskId}/progress`).send({ hours: 1 });
    assert.equal(again.status, 409);
  });

  test('filters, searches and reports stats', async () => {
    await agent.post('/api/tasks').send({ title: 'OS midterm', course: 'CS302', type: 'exam', dueAt: inDays(2), estimatedHours: 5 });
    const open = await agent.get('/api/tasks?status=open');
    assert.deepEqual(open.body.tasks.map((t) => t.title), ['OS midterm']);
    const search = await agent.get('/api/tasks?q=dbms');
    assert.deepEqual(search.body.tasks.map((t) => t.title), ['DBMS assignment']);
    assert.deepEqual(open.body.courses, ['CS301', 'CS302']);

    const stats = await agent.get('/api/stats');
    assert.equal(stats.body.totals.done, 1);
    assert.equal(stats.body.onTimeRate, 1);
    assert.equal(stats.body.estimationRatio, 1); // 6h spent on a 6h first estimate
    assert.equal(stats.body.hoursByDay.at(-1).hours, 6);
  });

  test('schedule endpoint returns days, focus list and summary', async () => {
    const res = await agent.get('/api/schedule');
    assert.equal(res.status, 200);
    assert.equal(res.body.focus[0].title, 'OS midterm');
    assert.ok(res.body.days.some((d) => d.blocks.length > 0));
    assert.equal(res.body.summary.feasible, true);
  });
});

describe('alerts', () => {
  test('sweeps create due-soon alerts exactly once', async () => {
    const agent = await signUp('dave@example.com');
    await agent.post('/api/tasks').send({ title: 'Quiz', type: 'quiz', dueAt: inDays(1, 23), estimatedHours: 1 });

    const user = await User.findOne({ email: 'dave@example.com' });
    await sweepUser(user);
    await Promise.all([sweepUser(user), sweepUser(user)]);
    const count = await Notification.countDocuments({ user: user._id });
    assert.equal(count, 1);

    const res = await agent.get('/api/notifications');
    assert.equal(res.body.unreadCount, 1);
    await agent.post('/api/notifications/read-all').expect(204);
    const after = await agent.get('/api/notifications');
    assert.equal(after.body.unreadCount, 0);
  });
});

describe('checklist', () => {
  test('adds, ticks and removes steps without bumping the task version', async () => {
    const agent = await signUp('erin@example.com');
    const created = await agent
      .post('/api/tasks')
      .send({ title: 'Lab report', dueAt: inDays(5), estimatedHours: 4 })
      .expect(201);
    const id = created.body.task.id;
    const version = created.body.task.version;

    const added = await agent.post(`/api/tasks/${id}/checklist`).send({ text: 'Collect results' }).expect(201);
    await agent.post(`/api/tasks/${id}/checklist`).send({ text: 'Write discussion' }).expect(201);
    const itemId = added.body.checklist[0].id;

    const ticked = await agent.patch(`/api/tasks/${id}/checklist/${itemId}`).send({ done: true }).expect(200);
    assert.equal(ticked.body.checklist[0].done, true);

    const detail = await agent.get(`/api/tasks/${id}`).expect(200);
    assert.equal(detail.body.task.checklist.length, 2);
    assert.equal(detail.body.task.checklistDone, 1);
    assert.equal(detail.body.task.checklistTotal, 2);
    // Checklist edits must not invalidate an edit form opened before them.
    assert.equal(detail.body.task.version, version);

    const removed = await agent.delete(`/api/tasks/${id}/checklist/${itemId}`).expect(200);
    assert.deepEqual(removed.body.checklist.map((i) => i.text), ['Write discussion']);

    await agent.post(`/api/tasks/${id}/checklist`).send({ text: '  ' }).expect(400);
    await agent.patch(`/api/tasks/${id}/checklist/${itemId}`).send({ done: true }).expect(404);

    const other = await signUp('frank@example.com');
    await other.post(`/api/tasks/${id}/checklist`).send({ text: 'Sneaky' }).expect(404);
  });
});
