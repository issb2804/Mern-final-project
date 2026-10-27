import mongoose from 'mongoose';

export const NOTIFICATION_KINDS = ['due_72h', 'due_24h', 'overdue', 'at_risk'];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    // Identifies the occurrence being alerted about (e.g. the deadline timestamp),
    // so re-running the sweep never creates duplicates but a moved deadline alerts again.
    dedupeKey: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, task: 1, kind: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
