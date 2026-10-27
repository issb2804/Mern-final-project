import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProduction) throw new Error('JWT_SECRET must be set in production');
  jwtSecret = 'dev-only-insecure-secret';
  if (nodeEnv !== 'test') console.warn('[env] JWT_SECRET not set — using an insecure development secret');
}

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret,
  jwtExpiresIn: '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  cronSecret: process.env.CRON_SECRET || '',
  enableCron: process.env.ENABLE_CRON !== 'false',
  serveClient: process.env.SERVE_CLIENT === 'true',
};
