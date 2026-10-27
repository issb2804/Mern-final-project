import mongoose from 'mongoose';
import { env } from './config/env.js';

let connecting = null;
let memoryServer = null;

/**
 * Connects once and reuses the connection. Safe to call on every request,
 * which matters on serverless hosts where the module may stay warm.
 * Without MONGODB_URI (outside production) an in-memory MongoDB is started.
 */
export function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!connecting) {
    connecting = (async () => {
      let uri = env.mongoUri;
      if (!uri) {
        if (env.isProduction) throw new Error('MONGODB_URI must be set in production');
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
        uri = memoryServer.getUri('cadence');
        if (!env.isTest) console.warn('[db] MONGODB_URI not set — using in-memory MongoDB (data resets on restart)');
      }
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
      return mongoose.connection;
    })().catch((err) => {
      connecting = null;
      throw err;
    });
  }
  return connecting;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
  connecting = null;
  memoryServer = null;
}
