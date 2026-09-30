/**
 * Local-time date helpers. Everything user-facing in StudyOS is bucketed by the
 * user's LOCAL calendar day. (Using `toISOString().slice(0, 10)` buckets by UTC
 * day instead, which files late-evening / early-morning sessions under the
 * wrong date for anyone not in UTC.)
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD for a Date or ISO string, in local time. */
export function dateKey(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local Date at 00:00 for a YYYY-MM-DD key. */
export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
  return r;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfWeek(d: Date, weekStartsOn = 0): Date {
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  return startOfDay(addDays(d, -diff));
}

/** Whole calendar days from a to b (b − a), DST-safe. */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return daysBetween(a, b) === 0;
}

/** 6×7 grid of dates covering the month containing `anchor`. */
export function monthGrid(anchor: Date, weekStartsOn = 0): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function weekDays(anchor: Date, weekStartsOn = 0): Date[] {
  const start = startOfWeek(anchor, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Parses either a date-only key ("2026-10-05") or a local date-time
 * ("2026-10-05T14:30"). Date-only values are treated as due at END of that day,
 * which is what "due Oct 5" means to a student.
 */
export function dueInstant(value: string): Date {
  if (value.length <= 10) {
    const d = parseKey(value);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return new Date(value);
}

/** Combines a date key and optional HH:MM into a local Date. */
export function combine(dateStr: string, time?: string): Date {
  const d = parseKey(dateStr);
  if (time) {
    const [h, m] = time.split(":").map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  }
  return d;
}

export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function formatHours(total: number, digits = 1): string {
  return `${(total / 60).toFixed(digits)}h`;
}

export function shortDate(key: string): string {
  return parseKey(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function longDate(key: string): string {
  return parseKey(key).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function formatClock(t?: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${period}`;
}
