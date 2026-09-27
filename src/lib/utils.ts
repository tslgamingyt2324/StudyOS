import { Course, ClassSchedule, Task } from "@/types";

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
      const aStart = timeToMinutes(a.sched.startTime), aEnd = timeToMinutes(a.sched.endTime);
      const bStart = timeToMinutes(b.sched.startTime), bEnd = timeToMinutes(b.sched.endTime);
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({
          day: a.day,
          courseA: a.course.code,
          courseB: b.course.code,
          overlapStart: a.sched.startTime,
          overlapEnd: a.sched.endTime,
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

const WEEK_ORDER = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** Groups every scheduled class by day of week, Saturday-first (NSU's academic week), each day sorted by start time. */
export function weeklySchedule(courses: Course[]) {
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

export function deadlineLabel(deadline?: string): { label: string; urgency: "overdue" | "today" | "soon" | "later" | "none" } {
  if (!deadline) return { label: "No deadline", urgency: "none" };
  const now = new Date();
  const due = new Date(deadline);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) return { label: "Overdue", urgency: "overdue" };
  if (diffDays === 0) return { label: "Due today", urgency: "today" };
  if (diffDays === 1) return { label: "Due tomorrow", urgency: "soon" };
  if (diffDays <= 5) return { label: `${diffDays} days left`, urgency: "soon" };
  return { label: `${diffDays} days left`, urgency: "later" };
}

export function isOverdue(task: Task): boolean {
  if (!task.deadline || task.status === "Completed") return false;
  return new Date(task.deadline).getTime() < Date.now();
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
