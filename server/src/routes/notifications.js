import { Router } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';
import { notFound } from '../utils/httpError.js';
import { sweepUser } from '../services/alerts.js';

const router = Router();
router.use(requireAuth);

// The background job sweeps everyone periodically; this keeps an active user's
// alerts fresh between runs (and covers hosts where the job runs rarely).
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

router.get('/', async (req, res) => {
  const last = req.user.lastAlertSweepAt?.getTime() ?? 0;
  if (Date.now() - last > SWEEP_INTERVAL_MS) await sweepUser(req.user);

  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({
    unreadCount,
    notifications: notifications.map((n) => ({
      id: String(n._id),
      taskId: String(n.task),
      kind: n.kind,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
    })),
  });
});

router.patch('/:id/read', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Notification not found');
  const result = await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
  if (result.matchedCount === 0) throw notFound('Notification not found');
  res.status(204).end();
});

router.post('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.status(204).end();
});

export default router;
