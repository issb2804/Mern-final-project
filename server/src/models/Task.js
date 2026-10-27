import mongoose from 'mongoose';

export const TASK_TYPES = ['assignment', 'exam', 'project', 'quiz', 'other'];
export const TASK_STATUSES = ['todo', 'in_progress', 'done'];

const progressEntrySchema = new mongoose.Schema(
  {
    hours: { type: Number, min: 0, max: 24, required: true },
    note: { type: String, trim: true, maxlength: 280 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const checklistItemSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 200 },
  done: { type: Boolean, default: false },
});

export const MAX_CHECKLIST_ITEMS = 50;

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    course: { type: String, trim: true, maxlength: 60, default: '' },
    type: { type: String, enum: TASK_TYPES, default: 'assignment' },
    dueAt: { type: Date, required: true },
    difficulty: { type: Number, min: 1, max: 5, default: 3 },
    // Current best estimate of total effort; re-estimating changes this.
    estimatedHours: { type: Number, min: 0.25, max: 500, required: true },
    // The estimate given at creation, kept to measure estimation accuracy.
    originalEstimate: { type: Number, min: 0.25, max: 500 },
    hoursSpent: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    completedAt: { type: Date },
    progressLog: { type: [progressEntrySchema], default: [] },
    // Small steps that break the task down; edited atomically so they never bump the task version.
    checklist: { type: [checklistItemSchema], default: [] },
  },
  // Optimistic concurrency: a save based on a stale copy fails with a VersionError
  // instead of silently overwriting another tab's progress update.
  { timestamps: true, optimisticConcurrency: true },
);

taskSchema.index({ user: 1, status: 1, dueAt: 1 });

taskSchema.pre('save', function setOriginalEstimate(next) {
  if (this.isNew && this.originalEstimate == null) this.originalEstimate = this.estimatedHours;
  next();
});

export const Task = mongoose.model('Task', taskSchema);
