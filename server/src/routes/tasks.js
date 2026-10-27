import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { MAX_CHECKLIST_ITEMS, Task, TASK_STATUSES, TASK_TYPES } from '../models/Task.js';
import { Notification } from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { badRequest, conflict, notFound } from '../utils/httpError.js';
import { buildPlan, previewImpact } from '../services/planner.js';
import { sampleTasks } from '../services/sampleData.js';

const router = Router();
router.use(requireAuth);

const fields = {
  title: z.string().trim().min(1, 'Title is required').max(120, 'Keep the title under 120 characters'),
  course: z.string().trim().max(60),
  type: z.enum(TASK_TYPES),
  dueAt: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid deadline' }) }),
  difficulty: z.coerce.number().int().min(1).max(5),
  estimatedHours: z.coerce
    .number({ invalid_type_error: 'Enter the hours you expect this to take' })
    .min(0.25, 'At least 15 minutes')
    .max(500, 'At most 500 hours'),
  notes: z.string().trim().max(2000),
};

const createSchema = z.object({
  ...fields,
  course: fields.course.default(''),
  type: fields.type.default('assignment'),
  difficulty: fields.difficulty.default(3),
  notes: fields.notes.default(''),
});

const updateSchema = z
  .object({ ...fields, status: z.enum(TASK_STATUSES), version: z.number().int().min(0) })
  .partial()
  .refine((v) => Object.keys(v).some((k) => k !== 'version'), 'Nothing to update');

const previewSchema = createSchema.extend({ replaceId: z.string().optional() });

const progressSchema = z
  .object({
    hours: z.coerce.number().min(0).max(16, 'Log at most 16 hours at a time').default(0),
    note: z.string().trim().max(280).optional(),
    remainingHours: z.coerce.number().min(0).max(500).optional(),
    markDone: z.boolean().optional(),
    version: z.number().int().min(0).optional(),
  })
  .refine((v) => v.hours > 0 || v.remainingHours !== undefined || v.markDone, {
    message: 'Log some hours, update the remaining estimate, or mark the task done',
    path: ['hours'],
  });

const checklistText = z.string().trim().min(1, 'Write something for this step').max(200, 'Keep it under 200 characters');
const checklistAddSchema = z.object({ text: checklistText });
const checklistUpdateSchema = z
  .object({ text: checklistText, done: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const listQuery = z.object({
  status: z.enum([...TASK_STATUSES, 'open', 'all']).default('all'),
  course: z.string().trim().max(60).optional(),
  type: z.enum(TASK_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['priority', 'due', 'created']).default('priority'),
});

async function findOwnTask(req, { lean = false } = {}) {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Task not found');
  // Scoping by user means another account's task id simply doesn't exist here.
  const query = Task.findOne({ _id: req.params.id, user: req.user._id });
  const task = await (lean ? query.lean() : query);
  if (!task) throw notFound('Task not found');
  return task;
}

function checkVersion(task, version) {
  if (version !== undefined && version !== task.__v) {
    throw conflict('This task was changed somewhere else. Refresh and try again.');
  }
}

const checklistDTO = (item) => ({ id: String(item._id), text: item.text, done: item.done });

function checkItemId(req) {
  if (!mongoose.isValidObjectId(req.params.itemId)) throw notFound('Checklist item not found');
}

const loadTasks = (userId) => Task.find({ user: userId }).select('-progressLog').lean();

router.get('/', validate(listQuery, 'query'), async (req, res) => {
  const { status, course, type, q, sort } = req.validQuery;
  const all = await loadTasks(req.user._id);
  // The plan is built from every task so priorities reflect the full workload,
  // then filtered for display.
  const plan = buildPlan({ tasks: all, user: req.user });

  const needle = q?.toLowerCase();
  let tasks = plan.tasks.filter(
    (t) =>
      (status === 'all' || (status === 'open' ? t.status !== 'done' : t.status === status)) &&
      (!course || t.course === course) &&
      (!type || t.type === type) &&
      (!needle || t.title.toLowerCase().includes(needle) || t.course.toLowerCase().includes(needle)),
  );
  if (sort === 'due') tasks = [...tasks].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  if (sort === 'created') tasks = [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const courses = [...new Set(all.map((t) => t.course).filter(Boolean))].sort();
  res.json({ tasks, courses, total: all.length });
});

router.post('/preview', validate(previewSchema), async (req, res) => {
  const { replaceId, ...candidate } = req.body;
  const tasks = await loadTasks(req.user._id);
  if (replaceId && !tasks.some((t) => String(t._id) === replaceId)) throw notFound('Task not found');
  res.json(previewImpact({ tasks, candidate, user: req.user, replaceId }));
});

router.post('/', validate(createSchema), async (req, res) => {
  const data = req.body;
  if (data.dueAt.getTime() < Date.now() - 60_000) {
    throw badRequest('The deadline is in the past', { fields: { dueAt: 'Pick a date and time in the future' } });
  }

  // Guards against double submits and accidental re-entry of the same deadline.
  const duplicate = await Task.exists({
    user: req.user._id,
    status: { $ne: 'done' },
    dueAt: data.dueAt,
    title: { $regex: `^${data.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  });
  if (duplicate) throw conflict('You already have an open task with this title and deadline');

  const existing = await loadTasks(req.user._id);
  const impact = previewImpact({ tasks: existing, candidate: data, user: req.user });
  const created = await Task.create({ ...data, user: req.user._id });

  const plan = buildPlan({ tasks: [...existing, created.toObject()], user: req.user });
  res.status(201).json({ task: plan.tasks.find((t) => t.id === created.id), impact });
});

// Fills an empty account with a sample semester so new users can explore right away.
router.post('/sample', async (req, res) => {
  if (await Task.exists({ user: req.user._id })) {
    throw conflict('Sample tasks can only be added to an empty account');
  }
  const created = await Task.insertMany(sampleTasks(req.user._id, req.user.timezone));
  res.status(201).json({ created: created.length });
});

router.get('/:id', async (req, res) => {
  const task = await findOwnTask(req, { lean: true });
  const plan = buildPlan({ tasks: await loadTasks(req.user._id), user: req.user });
  res.json({
    task: {
      ...plan.tasks.find((t) => t.id === String(task._id)),
      version: task.__v,
      progressLog: [...task.progressLog].reverse(),
      checklist: (task.checklist ?? []).map(checklistDTO),
    },
  });
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const task = await findOwnTask(req);
  const { version, status, ...changes } = req.body;
  checkVersion(task, version);

  Object.assign(task, changes);
  if (status && status !== task.status) {
    task.status = status;
    task.completedAt = status === 'done' ? new Date() : undefined;
  }
  await task.save();
  res.json({ task: { id: task.id, version: task.__v, status: task.status } });
});

router.post('/:id/progress', validate(progressSchema), async (req, res) => {
  const task = await findOwnTask(req);
  const { hours, note, remainingHours, markDone, version } = req.body;
  checkVersion(task, version);
  if (task.status === 'done') throw conflict('This task is already done. Reopen it to log more work.');

  if (hours > 0) {
    task.hoursSpent = Math.round((task.hoursSpent + hours) * 100) / 100;
    task.progressLog.push({ hours, note });
  }
  if (remainingHours !== undefined) {
    task.estimatedHours = Math.max(0.25, task.hoursSpent + remainingHours);
  }
  if (markDone || remainingHours === 0) {
    task.status = 'done';
    task.completedAt = new Date();
  } else if (task.hoursSpent > 0) {
    task.status = 'in_progress';
  }
  await task.save();
  res.json({
    task: { id: task.id, version: task.__v, status: task.status, hoursSpent: task.hoursSpent, estimatedHours: task.estimatedHours },
  });
});

// Checklist edits use atomic array updates, so ticking a box never conflicts with
// an edit or progress log happening in another tab.
router.post('/:id/checklist', validate(checklistAddSchema), async (req, res) => {
  const task = await findOwnTask(req, { lean: true });
  if ((task.checklist?.length ?? 0) >= MAX_CHECKLIST_ITEMS) {
    throw badRequest(`A task can have at most ${MAX_CHECKLIST_ITEMS} checklist items`);
  }
  const updated = await Task.findOneAndUpdate(
    { _id: task._id, user: req.user._id },
    { $push: { checklist: { text: req.body.text } } },
    { new: true, lean: true },
  );
  res.status(201).json({ checklist: updated.checklist.map(checklistDTO) });
});

router.patch('/:id/checklist/:itemId', validate(checklistUpdateSchema), async (req, res) => {
  await findOwnTask(req, { lean: true });
  checkItemId(req);
  const set = Object.fromEntries(Object.entries(req.body).map(([k, v]) => [`checklist.$.${k}`, v]));
  const updated = await Task.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, 'checklist._id': req.params.itemId },
    { $set: set },
    { new: true, lean: true },
  );
  if (!updated) throw notFound('Checklist item not found');
  res.json({ checklist: updated.checklist.map(checklistDTO) });
});

router.delete('/:id/checklist/:itemId', async (req, res) => {
  await findOwnTask(req, { lean: true });
  checkItemId(req);
  const updated = await Task.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $pull: { checklist: { _id: req.params.itemId } } },
    { new: true, lean: true },
  );
  res.json({ checklist: updated.checklist.map(checklistDTO) });
});

router.delete('/:id', async (req, res) => {
  const task = await findOwnTask(req);
  await Promise.all([task.deleteOne(), Notification.deleteMany({ task: task._id, user: req.user._id })]);
  res.status(204).end();
});

export default router;
