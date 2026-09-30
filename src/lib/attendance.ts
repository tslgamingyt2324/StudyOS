import { AttendanceRecord, Course } from "@/types";

/**
 * Attendance model
 * ----------------
 * - Present / Absent count toward the percentage.
 * - Excused classes are EXCLUDED from both the numerator and the denominator:
 *   they neither help nor hurt. (Consistent everywhere in the app.)
 * - percentage = present / (present + absent)
 * - A course may carry a starting `attendanceBaseline` for classes held before
 *   the student began logging; logged records are added on top of it.
 */
export interface AttendanceStats {
  present: number;
  absent: number;
  excused: number;
  /** Classes that count: present + absent. */
  total: number;
  /** 0–100, or null when nothing has been counted yet. */
  percentage: number | null;
  required: number;
  /** Most additional classes that can be missed while staying ≥ required. */
  maxMissable: number;
  /** Consecutive classes that must be attended to get back to `required` (0 if already there). */
  neededToReach: number;
  status: "none" | "safe" | "warning" | "risk";
}

export function attendanceTotals(course: Pick<Course, "attendanceBaseline">, records: AttendanceRecord[]) {
  let present = course.attendanceBaseline?.present ?? 0;
  let absent = course.attendanceBaseline?.absent ?? 0;
  let excused = course.attendanceBaseline?.excused ?? 0;
  for (const r of records) {
    if (r.status === "Present") present++;
    else if (r.status === "Absent") absent++;
    else excused++;
  }
  return { present, absent, excused };
}

export function requiredFor(course: Pick<Course, "requiredAttendance">, defaultThreshold: number): number {
  const r = course.requiredAttendance ?? defaultThreshold;
  return Math.min(100, Math.max(0, r));
}

/** Percentage after hypothetically adding `present` and `absent` classes. */
export function project(present: number, absent: number, addPresent: number, addAbsent: number): number | null {
  const total = present + absent + addPresent + addAbsent;
  if (total <= 0) return null;
  return ((present + addPresent) / total) * 100;
}

/** Largest m ≥ 0 such that present / (total + m) ≥ required. */
export function maxMissable(present: number, absent: number, required: number): number {
  const total = present + absent;
  const req = required / 100;
  if (req <= 0) return Infinity;
  if (present === 0) return 0;
  // floor with a tiny epsilon so exact boundaries (e.g. 7/10 at 70%) count.
  const m = Math.floor(present / req - total + 1e-9);
  return Math.max(0, m);
}

/** Smallest n ≥ 0 such that (present + n) / (total + n) ≥ required. */
export function classesNeeded(present: number, absent: number, required: number): number {
  const total = present + absent;
  const req = required / 100;
  if (total === 0 || present / total >= req - 1e-12) return 0;
  if (req >= 1) return Infinity; // 100% can never be recovered once a class is missed
  return Math.max(0, Math.ceil((req * total - present) / (1 - req) - 1e-9));
}

export function computeAttendance(
  course: Pick<Course, "attendanceBaseline" | "requiredAttendance">,
  records: AttendanceRecord[],
  defaultThreshold: number
): AttendanceStats {
  const { present, absent, excused } = attendanceTotals(course, records);
  const total = present + absent;
  const required = requiredFor(course, defaultThreshold);
  const percentage = total > 0 ? (present / total) * 100 : null;
  const missable = maxMissable(present, absent, required);
  const needed = classesNeeded(present, absent, required);

  let status: AttendanceStats["status"] = "none";
  if (percentage !== null) {
    if (percentage < required) status = "risk";
    else if (percentage < required + 5 || missable <= 1) status = "warning";
    else status = "safe";
  }
  return { present, absent, excused, total, percentage, required, maxMissable: missable, neededToReach: needed, status };
}

export interface Projection {
  label: string;
  percentage: number | null;
}

/** "If you miss the next 2 → 78.3%" style scenarios. */
export function projections(stats: Pick<AttendanceStats, "present" | "absent">): Projection[] {
  const { present, absent } = stats;
  return [
    { label: "Miss the next 1 class", percentage: project(present, absent, 0, 1) },
    { label: "Miss the next 2 classes", percentage: project(present, absent, 0, 2) },
    { label: "Attend the next 2 classes", percentage: project(present, absent, 2, 0) },
    { label: "Attend the next 4 classes", percentage: project(present, absent, 4, 0) },
  ];
}

export function attendanceMessage(stats: AttendanceStats): string {
  if (stats.total === 0) return "No classes counted yet";
  if (stats.status === "risk") {
    return stats.neededToReach === Infinity
      ? `Below ${stats.required}% — cannot be recovered`
      : `Attend the next ${stats.neededToReach} class${stats.neededToReach === 1 ? "" : "es"} to reach ${stats.required}%`;
  }
  if (stats.maxMissable === 0) return `Don't miss the next class — you're at the ${stats.required}% line`;
  return `You can miss ${stats.maxMissable} more class${stats.maxMissable === 1 ? "" : "es"}`;
}
