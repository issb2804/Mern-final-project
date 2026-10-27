import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import scheduleRoutes from './routes/schedule.js';
import notificationRoutes from './routes/notifications.js';
import statsRoutes from './routes/stats.js';
import cronRoutes from './routes/cron.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  // Only needed when the client is served from a different origin than the API.
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // Ensures the database is connected before any route touches it.
  app.use('/api', async (req, res, next) => {
    await connectDB();
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/schedule', scheduleRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/cron', cronRoutes);

  app.use('/api', notFoundHandler);

  // Single-server deployments (e.g. Render) serve the built React app from here.
  if (env.serveClient) {
    const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
