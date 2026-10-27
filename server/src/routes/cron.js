import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError, notFound } from '../utils/httpError.js';
import { sweepAll } from '../services/alerts.js';

const router = Router();

function secretMatches(header) {
  const expected = Buffer.from(`Bearer ${env.cronSecret}`);
  const given = Buffer.from(header || '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Lets an external scheduler (e.g. Vercel Cron) trigger the alert sweep on hosts
// where an in-process job can't run.
router.get('/alerts', async (req, res) => {
  if (!env.cronSecret) throw notFound();
  if (!secretMatches(req.get('authorization'))) throw new HttpError(401, 'Invalid cron secret');
  res.json(await sweepAll());
});

export default router;
