import { DateTime } from 'luxon';

/**
 * A realistic mid-semester workload, placed relative to `now` in the user's
 * timezone, so a new account can explore every feature immediately.
 */
export function sampleTasks(userId, timezone, now = new Date()) {
  const today = DateTime.fromJSDate(now, { zone: timezone || 'UTC' }).startOf('day');
  const at = (days, hour, minute = 0) => today.plus({ days }).set({ hour, minute }).toJSDate();
  const log = (daysAgo, hours, note) => ({ hours, note, at: at(-daysAgo, 19) });

  return [
    {
      title: 'Technical writing essay',
      course: 'HS102',
      type: 'assignment',
      dueAt: at(1, 17),
      difficulty: 2,
      estimatedHours: 3,
      hoursSpent: 0.5,
      status: 'in_progress',
      progressLog: [log(1, 0.5, 'Outline and sources')],
    },
    {
      title: 'Linear algebra quiz 4',
      course: 'MA201',
      type: 'quiz',
      dueAt: at(2, 9),
      difficulty: 2,
      estimatedHours: 2,
    },
    {
      title: 'DBMS assignment 3: normalisation',
      course: 'CS301',
      type: 'assignment',
      dueAt: at(3, 23, 59),
      difficulty: 3,
      estimatedHours: 6,
      hoursSpent: 2,
      status: 'in_progress',
      progressLog: [log(2, 2, 'ER diagram and functional dependencies')],
      checklist: [
        { text: 'Draw the ER diagram', done: true },
        { text: 'List functional dependencies', done: true },
        { text: 'Normalise to 3NF', done: false },
        { text: 'Write up and submit', done: false },
      ],
    },
    {
      title: 'Operating systems midterm',
      course: 'CS302',
      type: 'exam',
      dueAt: at(6, 10),
      difficulty: 5,
      estimatedHours: 12,
      hoursSpent: 3,
      status: 'in_progress',
      progressLog: [log(4, 1.5, 'Processes and threads'), log(3, 1.5, 'Scheduling algorithms')],
    },
    {
      title: 'Computer networks lab report',
      course: 'CS303',
      type: 'assignment',
      dueAt: at(6, 18),
      difficulty: 3,
      estimatedHours: 4,
    },
    {
      title: 'Web development project',
      course: 'CS310',
      type: 'project',
      dueAt: at(12, 23, 59),
      difficulty: 4,
      estimatedHours: 20,
      hoursSpent: 5,
      status: 'in_progress',
      progressLog: [log(6, 2, 'Data model and API'), log(5, 3, 'Auth and first screens')],
      checklist: [
        { text: 'Data model and API', done: true },
        { text: 'Authentication', done: true },
        { text: 'Dashboard screens', done: false },
        { text: 'Deploy and write README', done: false },
      ],
    },
    {
      title: 'Data structures problem set',
      course: 'CS201',
      type: 'assignment',
      dueAt: at(-2, 23, 59),
      difficulty: 3,
      estimatedHours: 5,
      originalEstimate: 5,
      hoursSpent: 6.5,
      status: 'done',
      completedAt: at(-3, 21),
      progressLog: [log(5, 3, 'Trees and heaps'), log(3, 3.5, 'Graphs')],
    },
    {
      title: 'Discrete maths quiz 3',
      course: 'MA102',
      type: 'quiz',
      dueAt: at(-4, 9),
      difficulty: 2,
      estimatedHours: 1.5,
      originalEstimate: 1.5,
      hoursSpent: 2,
      status: 'done',
      completedAt: at(-4, 11),
      progressLog: [log(5, 2, 'Practice problems')],
    },
  ].map((t) => ({ user: userId, originalEstimate: t.estimatedHours, ...t }));
}
