import mongoose from 'mongoose';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const hours = (fallback) => ({ type: Number, min: 0, max: 24, default: fallback });

const availabilitySchema = new mongoose.Schema(
  {
    mon: hours(3),
    tue: hours(3),
    wed: hours(3),
    thu: hours(3),
    fri: hours(2),
    sat: hours(5),
    sun: hours(4),
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    timezone: { type: String, default: 'UTC' },
    // Hours the student can realistically study on each weekday.
    availability: { type: availabilitySchema, default: () => ({}) },
    lastAlertSweepAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    timezone: this.timezone,
    availability: this.availability,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
