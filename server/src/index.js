import { createApp } from './app.js';
import { connectDB } from './db.js';
import { env } from './config/env.js';
import { startJobs } from './jobs.js';

await connectDB();
const app = createApp();

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});

if (env.enableCron) startJobs();
