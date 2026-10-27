import { DateTime } from 'luxon';
import { WEEKDAYS } from '../models/User.js';

// Study hours are assumed to fall inside this local window each day.
export const STUDY_DAY_START_HOUR = 8;
export const STUDY_DAY_END_HOUR = 23;
const MAX_PLAN_DAYS = 366;

export const floorQuarter = (n) => Math.floor(n * 4 + 1e-9) / 4;

/**
 * Splits the time from `now` until the local day of `until` into calendar days,
 * each with the study capacity the user set for that weekday. Today only counts
 * the study hours that are still ahead.
 */
export function buildDays({ now, until, availability, timezone }) {
  const zone = timezone || 'UTC';
  const nowLocal = DateTime.fromJSDate(now, { zone });
  const lastDay = DateTime.fromJSDate(until, { zone }).startOf('day');
  const days = [];

  for (let day = nowLocal.startOf('day'); day <= lastDay && days.length < MAX_PLAN_DAYS; day = day.plus({ days: 1 })) {
    const weekday = WEEKDAYS[day.weekday - 1];
    const full = Number(availability?.[weekday]) || 0;
    let capacity = full;
    if (day.hasSame(nowLocal, 'day')) {
      const studyStart = DateTime.max(nowLocal, day.set({ hour: STUDY_DAY_START_HOUR }));
      const hoursLeft = day.set({ hour: STUDY_DAY_END_HOUR }).diff(studyStart, 'hours').hours;
      capacity = Math.min(full, Math.max(0, hoursLeft));
    }
    days.push({ date: day.toISODate(), weekday, start: day, capacity: floorQuarter(capacity) });
  }
  return days;
}

/**
 * How many hours of `day` can go towards a task due at `dueLocal`.
 * Days after the deadline give nothing; on the deadline day only the study
 * hours before the deadline count.
 */
export function usableHoursForTask(day, dueLocal) {
  if (day.start > dueLocal) return 0;
  if (!day.start.hasSame(dueLocal, 'day')) return Infinity;
  const studyStart = day.start.set({ hour: STUDY_DAY_START_HOUR });
  return Math.max(0, dueLocal.diff(studyStart, 'hours').hours);
}

/** Total study capacity before a deadline, ignoring other tasks. */
export function capacityUntil(days, dueLocal) {
  let total = 0;
  for (const day of days) total += Math.min(day.capacity, usableHoursForTask(day, dueLocal));
  return floorQuarter(total);
}

export function toLocal(date, timezone) {
  return DateTime.fromJSDate(new Date(date), { zone: timezone || 'UTC' });
}
