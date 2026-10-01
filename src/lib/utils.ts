import { Course, ClassSchedule, Task } from "@/types";
import { daysBetween, dueInstant } from "@/lib/dates";
import { blocksOverlap, classStartMinutes, classEndMinutes, minutesToTime } from "@/lib/classTime";

export function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function formatDate(date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function todayName(date = new Date()): string {
  return DAY_NAMES[date.getDay()];
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

/** Detects overlapping class schedules across all active courses. */
export interface ScheduleConflict {
  day: string;
  courseA: string;
  courseB: string;
  overlapStart: string;
  overlapEnd: string;
}

export function findScheduleConflicts(courses: Course[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const entries: { course: Course; day: string; sched: ClassSchedule }[] = [];

  for (const c of courses) {
    for (const s of c.schedule ?? []) {
      for (const day of s.days) entries.push({ course: c, day, sched: s });
    }
  }

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      if (a.day !== b.day || a.course.id === b.course.id) continue;
      // Uses the full class length (explicit end time, else start + 90 min).
      if (blocksOverlap(a.sched, b.sched)) {
        conflicts.push({
          day: a.day,
          courseA: a.course.code,
          courseB: b.course.code,
          overlapStart: minutesToTime(Math.max(classStartMinutes(a.sched), classStartMinutes(b.sched))),
          overlapEnd: minutesToTime(Math.min(classEndMinutes(a.sched), classEndMinutes(b.sched))),
        });
      }
    }
  }
  return conflicts;
}

export function todaysClasses(courses: Course[], date = new Date()) {
  const day = todayName(date);
  const items: { course: Course; sched: ClassSchedule }[] = [];
  for (const c of courses) {
    for (const s of c.schedule ?? []) {
      if (s.days.includes(day)) items.push({ course: c, sched: s });
    }
  }
  return items.sort((a, b) => timeToMinutes(a.sched.startTime) - timeToMinutes(b.sched.startTime));
}

/** Groups every scheduled class by day of week, starting on `weekStartsOn` (0 = Sunday), each day sorted by start time. */
export function weeklySchedule(courses: Course[], weekStartsOn = 0) {
  const WEEK_ORDER = Array.from({ length: 7 }, (_, i) => DAY_NAMES[(i + weekStartsOn) % 7]);
  const map = new Map<string, { course: Course; sched: ClassSchedule }[]>();
  for (const day of WEEK_ORDER) map.set(day, []);
  for (const c of courses) {
    for (const s of c.schedule ?? []) {
      for (const day of s.days) {
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push({ course: c, sched: s });
      }
    }
  }
  for (const list of map.values()) list.sort((a, b) => timeToMinutes(a.sched.startTime) - timeToMinutes(b.sched.startTime));
  return { order: WEEK_ORDER, map };
}

/** Finds the next class starting from right now, scanning up to 7 days ahead. Returns null if there are no classes at all. */
export function nextClassAcrossWeek(courses: Course[], from = new Date()) {
  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const d = new Date(from);
    d.setDate(d.getDate() + dayOffset);
    const classes = todaysClasses(courses, d);
    for (const item of classes) {
      const classMinutes = timeToMinutes(item.sched.startTime);
      const nowMinutes = dayOffset === 0 ? from.getHours() * 60 + from.getMinutes() : -1;
      if (classMinutes > nowMinutes) {
        const target = new Date(d);
        target.setHours(Math.floor(classMinutes / 60), classMinutes % 60, 0, 0);
        const minutesUntil = Math.round((target.getTime() - from.getTime()) / 60000);
        return { ...item, dayName: todayName(d), dayOffset, minutesUntil };
      }
    }
  }
  return null;
}

export function formatCountdown(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export type Urgency = "overdue" | "today" | "soon" | "later" | "none";

/**
 * Human label + urgency for a task deadline or exam date. Uses CALENDAR days
 * (not 24-hour blocks), so anything due later today reads "Due today" and
 * anything due tomorrow reads "Due tomorrow".
 */
export function deadlineLabel(deadline?: string, now = new Date()): { label: string; urgency: Urgency } {
  if (!deadline) return { label: "No deadline", urgency: "none" };
  const due = dueInstant(deadline);
  if (due.getTime() < now.getTime()) return { label: "Overdue", urgency: "overdue" };
  const days = daysBetween(now, due);
  if (days === 0) return { label: "Due today", urgency: "today" };
  if (days === 1) return { label: "Due tomorrow", urgency: "soon" };
  if (days <= 5) return { label: `${days} days left`, urgency: "soon" };
  return { label: `${days} days left`, urgency: "later" };
}

export function isOverdue(task: Task, now = new Date()): boolean {
  if (!task.deadline || task.status === "Completed") return false;
  return dueInstant(task.deadline).getTime() < now.getTime();
}

// ---- Academic risk engine (transparent rules, no fake AI) -----------------
export type RiskLevel = "good" | "warn" | "bad";

export interface CourseRisk {
  courseId: number;
  code: string;
  level: RiskLevel;
  reasons: string[];
}

export function courseRisk(
  course: Course,
  opts: { overdueTaskCount: number; studyMinutesLast7Days: number; attendancePct?: number; attendanceThreshold: number }
): CourseRisk {
  const reasons: string[] = [];
  let level: RiskLevel = "good";

  if (opts.attendancePct !== undefined && opts.attendancePct < opts.attendanceThreshold) {
    reasons.push(`Attendance ${opts.attendancePct.toFixed(0)}% is below your ${opts.attendanceThreshold}% threshold`);
    level = "bad";
  }
  if (opts.overdueTaskCount > 3) {
    reasons.push(`${opts.overdueTaskCount} overdue tasks`);
    level = "bad";
  } else if (opts.overdueTaskCount > 0) {
    reasons.push(`${opts.overdueTaskCount} overdue task(s)`);
    if (level === "good") level = "warn";
  }
  if (opts.studyMinutesLast7Days < 60 && course.status === "In Progress") {
    reasons.push("Less than 1 hour studied in the last 7 days");
    if (level === "good") level = "warn";
  }
  if (reasons.length === 0) reasons.push("On track — no risk signals detected");

  return { courseId: course.id!, code: course.code, level, reasons };
}
