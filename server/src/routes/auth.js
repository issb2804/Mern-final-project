import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User, WEEKDAYS } from '../models/User.js';
import { AUTH_COOKIE, cookieOptions, requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { conflict, unauthorized } from '../utils/httpError.js';
import { isValidTimezone } from '../utils/time.js';
import { env } from '../config/env.js';

const router = Router();

// Slows down password guessing; skipped in tests so suites can log in freely.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const timezone = z.string().refine(isValidTimezone, 'Unknown timezone');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  timezone: timezone.optional(),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

const availabilitySchema = z.object(
  Object.fromEntries(WEEKDAYS.map((d) => [d, z.number().min(0).max(16, 'At most 16 hours a day')])),
);

const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    timezone,
    availability: availabilitySchema,
  })
  .partial();

function startSession(res, user) {
  res.cookie(AUTH_COOKIE, signToken(user._id), cookieOptions());
}

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password, timezone } = req.body;
  if (await User.exists({ email })) throw conflict('An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, timezone: timezone || 'UTC' });
  startSession(res, user);
  res.status(201).json({ user: user.toPublic() });
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password, so accounts can't be enumerated.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Incorrect email or password');
  }
  startSession(res, user);
  res.json({ user: user.toPublic() });
});

router.post('/logout', (req, res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(AUTH_COOKIE, opts);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

router.patch('/me', requireAuth, validate(updateMeSchema), async (req, res) => {
  const { name, timezone, availability } = req.body;
  if (name !== undefined) req.user.name = name;
  if (timezone !== undefined) req.user.timezone = timezone;
  if (availability !== undefined) req.user.availability = availability;
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

export default router;
