// Scheduling + dirtiness math. Pure functions, no Dexie — the server's reminder
// scheduler (server/reminders.js) mirrors isDue(); keep them in step.
import { dateStr, type Effort, type Task } from './db';

const DAY_MS = 86_400_000;

export const EFFORT_POINTS: Record<Effort, number> = { 1: 5, 2: 10, 3: 20 };
export const EFFORT_LABEL: Record<Effort, string> = { 1: 'Quick', 2: 'Medium', 3: 'Big job' };

export const FREQ_PRESETS: { days: number; label: string }[] = [
  { days: 1, label: 'Daily' },
  { days: 2, label: 'Every 2 days' },
  { days: 3, label: 'Every 3 days' },
  { days: 7, label: 'Weekly' },
  { days: 14, label: 'Every 2 weeks' },
  { days: 30, label: 'Monthly' },
  { days: 90, label: 'Every 3 months' },
  { days: 180, label: 'Every 6 months' },
];

export function freqLabel(days: number): string {
  return FREQ_PRESETS.find((p) => p.days === days)?.label ?? `Every ${days} days`;
}

/** 0 = just cleaned, 1 = due now, >1 = overdue. */
export function dirtiness(task: Task, now = Date.now()): number {
  const elapsed = now - Date.parse(task.lastDoneAt);
  return Math.max(0, elapsed / (task.freqDays * DAY_MS));
}

/** lastDoneAt value that makes the task show the given dirtiness right now (slider). */
export function lastDoneForDirtiness(task: Task, level: number, now = Date.now()): string {
  return new Date(now - level * task.freqDays * DAY_MS).toISOString();
}

/** Calendar date the task next comes due (local time). */
export function dueDate(task: Task): string {
  return dateStr(new Date(Date.parse(task.lastDoneAt) + task.freqDays * DAY_MS));
}

/** Due on or before the given local date. */
export function isDue(task: Task, onDate = dateStr()): boolean {
  return !task.archived && dueDate(task) <= onDate;
}

export function daysOverdue(task: Task, today = dateStr()): number {
  const a = Date.parse(`${dueDate(task)}T00:00:00`);
  const b = Date.parse(`${today}T00:00:00`);
  return Math.round((b - a) / DAY_MS);
}

export type DirtLevel = 'clean' | 'ok' | 'dirty' | 'overdue';

export function dirtLevel(d: number): DirtLevel {
  if (d < 0.5) return 'clean';
  if (d < 0.85) return 'ok';
  if (d <= 1.15) return 'dirty';
  return 'overdue';
}

/** 0–100, where 100 = every active task freshly done. */
export function cleanliness(tasks: Task[], now = Date.now()): number {
  const active = tasks.filter((t) => !t.archived && !t.deleted);
  if (active.length === 0) return 100;
  const avg = active.reduce((s, t) => s + Math.min(1, dirtiness(t, now)), 0) / active.length;
  return Math.round((1 - avg) * 100);
}

export function dueLabel(task: Task, today = dateStr()): string {
  const n = daysOverdue(task, today);
  if (n > 1) return `${n} days overdue`;
  if (n === 1) return 'Due yesterday';
  if (n === 0) return 'Due today';
  if (n === -1) return 'Due tomorrow';
  return `Due in ${-n} days`;
}
