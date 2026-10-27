import cron from 'node-cron';
import { sweepAll } from './services/alerts.js';

/** Every 30 minutes, generate deadline and at-risk alerts for all users. */
export function startJobs() {
  let running = false;
  cron.schedule('*/30 * * * *', async () => {
    if (running) return; // skip if the previous sweep is still going
    running = true;
    try {
      const { users, created } = await sweepAll();
      if (created) console.log(`[alerts] swept ${users} users, created ${created} notifications`);
    } catch (err) {
      console.error('[alerts] sweep failed:', err);
    } finally {
      running = false;
    }
  });
}
