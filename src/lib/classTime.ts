import { ClassSchedule, Course } from "@/types";
import { combine, dateKey, formatClock } from "@/lib/dates";

/**
 * University classes are 1h30m. A class block that has no usable end time is
 * treated as start + 90 minutes. An explicit, valid end time always wins, so
 * nothing already stored is ever overridden (and nothing is rewritten in the
 * database — the end time is derived whenever it is read).
 */
export const DEFAULT_CLASS_MINUTES = 90;

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const LAST_MINUTE = 23 * 60 + 59;

/** Minimal shape so tests and callers with partial rows can use these helpers. */
export type TimedBlock = Pick<ClassSchedule, "startTime"> & { endTime?: string | null };

export function isValidTime(t: unknown): t is string {
  return typeof t === "string" && TIME_RE.test(t.trim());
}

/** "HH:MM" → minutes after midnight. Returns NaN for malformed input. */
export function toMinutes(t: string): number {
  const m = TIME_RE.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** Minutes after midnight → zero-padded "HH:MM" (clamped to 23:59 so it never wraps into tomorrow). */
export function minutesToTime(total: number): string {
  const c = Math.max(0, Math.min(LAST_MINUTE, Math.round(total)));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
}

/** Start time + 90 minutes, e.g. "16:20" → "17:50". */
export function defaultEndTime(startTime: string): string {
  const s = toMinutes(startTime);
  return Number.isNaN(s) ? startTime : minutesToTime(s + DEFAULT_CLASS_MINUTES);
}

/**
 * The effective end time of a class block.
 * - explicit valid end time after the start → used as-is
 * - missing / empty / malformed / not after the start → start + 90 minutes
 */
export function classEndTime(block: TimedBlock): string {
  const start = toMinutes(block.startTime);
  if (Number.isNaN(start)) return block.endTime && isValidTime(block.endTime) ? block.endTime : block.startTime;
  if (isValidTime(block.endTime) && toMinutes(block.endTime) > start) return block.endTime.trim();
  return defaultEndTime(block.startTime);
}

export function classStartMinutes(block: TimedBlock): number {
  return toMinutes(block.startTime);
}

export function classEndMinutes(block: TimedBlock): number {
  return toMinutes(classEndTime(block));
}

/** "4:20 PM – 5:50 PM" */
export function formatClassRange(block: TimedBlock): string {
  return `${formatClock(block.startTime)} – ${formatClock(classEndTime(block))}`;
}

/** Local start/end instants of a class block on a given calendar day. */
export function classInterval(block: TimedBlock, day: Date | string): { start: Date; end: Date } {
  const key = typeof day === "string" ? day : dateKey(day);
  return { start: combine(key, block.startTime), end: combine(key, classEndTime(block)) };
}

export type ClassPhase = "upcoming" | "current" | "ended";

/** start ≤ now < end is "current": at exactly the end time the class is over. */
export function classPhase(block: TimedBlock, now: Date, day: Date | string = now): ClassPhase {
  const { start, end } = classInterval(block, day);
  const t = now.getTime();
  if (t < start.getTime()) return "upcoming";
  if (t < end.getTime()) return "current";
  return "ended";
}

/** Do two blocks on the same day overlap? Touching back-to-back classes (end == start) do not. */
export function blocksOverlap(a: TimedBlock, b: TimedBlock): boolean {
  return classStartMinutes(a) < classEndMinutes(b) && classStartMinutes(b) < classEndMinutes(a);
}

/** The class in progress right now (today only), if any. */
export function currentClassNow(
  today: { course: Course; sched: ClassSchedule }[],
  now: Date
): { course: Course; sched: ClassSchedule } | undefined {
  return today.find(({ sched }) => classPhase(sched, now) === "current");
}
