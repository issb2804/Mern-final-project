import { Router } from 'express';
import { Task } from '../models/Task.js';
import { requireAuth } from '../middleware/auth.js';
import { buildPlan } from '../services/planner.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const tasks = await Task.find({ user: req.user._id, status: { $ne: 'done' } }).select('-progressLog').lean();
  const { tasks: planned, schedule } = buildPlan({ tasks, user: req.user });
  res.json({
    generatedAt: new Date().toISOString(),
    timezone: req.user.timezone,
    focus: planned.filter((t) => t.priority.risk !== 'overdue').slice(0, 3),
    ...schedule,
  });
});

export default router;
