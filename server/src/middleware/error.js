import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

// Express recognises error handlers by their four-argument signature.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) fields[issue.path.join('.') || '_'] = issue.message;
    return res.status(400).json({ error: 'Some fields are invalid', fields });
  }
  if (err instanceof HttpError) {
    // `details` carries extra response fields, e.g. { fields: { dueAt: '...' } }.
    return res.status(err.status).json({ error: err.message, ...err.details });
  }
  if (err instanceof mongoose.Error.VersionError) {
    return res.status(409).json({ error: 'This task was changed somewhere else. Refresh and try again.' });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(404).json({ error: 'Resource not found' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'That record already exists' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (!env.isTest) console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
