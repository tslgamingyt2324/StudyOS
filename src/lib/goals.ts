import { Course, Goal, Grade, StudySession, Task } from "@/types";
import { dateKey } from "@/lib/dates";

export interface GoalContext {
  cgpa: number;
  courses: Course[];
  sessions: StudySession[];
  tasks: Task[];
  gradeScale: Record<Grade, number>;
  /** courseId → attendance percentage (null when no data). */
  attendanceByCourse: Map<number, number | null>;
}

export interface GoalProgress {
  current: number;
  target: number;
  /** 0–100, clamped. */
  percent: number;
  unit: string;
  /** Human "87h / 120h" style text. */
  text: string;
  achieved: boolean;
  /** true when progress is computed from other data rather than typed in. */
  derived: boolean;
  note?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

function inWindow(iso: string, goal: Goal): boolean {
  const day = dateKey(iso);
  if (day < goal.startDate) return false;
  if (goal.deadline && day > goal.deadline) return false;
  return true;
}

export function computeGoalProgress(goal: Goal, ctx: GoalContext): GoalProgress {
  switch (goal.metric) {
    case "cgpa": {
      const start = goal.startValue ?? 0;
      const span = goal.target - start;
      const percent = span > 0 ? clamp(((ctx.cgpa - start) / span) * 100) : clamp((ctx.cgpa / goal.target) * 100);
      return {
        current: ctx.cgpa, target: goal.target, percent, unit: "CGPA", derived: true,
        text: `${ctx.cgpa.toFixed(2)} / ${goal.target.toFixed(2)}`,
        achieved: ctx.cgpa >= goal.target,
      };
    }
    case "study_hours": {
      const minutes = ctx.sessions
        .filter((s) => s.completed && inWindow(s.startedAt, goal) && (!goal.courseId || s.courseId === goal.courseId))
        .reduce((sum, s) => sum + s.actualMinutes, 0);
      const hours = minutes / 60;
      return {
        current: hours, target: goal.target, percent: clamp((hours / goal.target) * 100), unit: "h", derived: true,
        text: `${hours.toFixed(hours < 10 ? 1 : 0)}h / ${goal.target}h`, achieved: hours >= goal.target,
      };
    }
    case "course_grade": {
      const course = ctx.courses.find((c) => c.id === goal.courseId);
      const graded = course && course.grade ? ctx.gradeScale[course.grade] : undefined;
      if (graded === undefined) {
        return {
          current: 0, target: goal.target, percent: 0, unit: "GP", derived: true,
          text: `Target ${goal.target.toFixed(2)}`, achieved: false, note: "Awaiting your final grade",
        };
      }
      return {
        current: graded, target: goal.target, percent: clamp((graded / goal.target) * 100), unit: "GP", derived: true,
        text: `${course!.grade} (${graded.toFixed(2)}) / ${goal.target.toFixed(2)}`, achieved: graded >= goal.target,
      };
    }
    case "attendance": {
      const pct = (goal.courseId !== undefined ? ctx.attendanceByCourse.get(goal.courseId) : null) ?? null;
      if (pct === null) {
        return { current: 0, target: goal.target, percent: 0, unit: "%", derived: true, text: `Target ${goal.target}%`, achieved: false, note: "No attendance logged yet" };
      }
      return {
        current: pct, target: goal.target, percent: clamp((pct / goal.target) * 100), unit: "%", derived: true,
        text: `${pct.toFixed(1)}% / ${goal.target}%`, achieved: pct >= goal.target,
      };
    }
    case "tasks_completed": {
      const done = ctx.tasks.filter(
        (t) => t.status === "Completed" && t.completedAt && inWindow(t.completedAt, goal) && (!goal.courseId || t.courseId === goal.courseId)
      ).length;
      return {
        current: done, target: goal.target, percent: clamp((done / goal.target) * 100), unit: "tasks", derived: true,
        text: `${done} / ${goal.target} tasks`, achieved: done >= goal.target,
      };
    }
    default: {
      const cur = goal.manualCurrent ?? 0;
      const unit = goal.unit ?? "";
      return {
        current: cur, target: goal.target, percent: clamp((cur / goal.target) * 100), unit, derived: false,
        text: `${cur}${unit ? " " + unit : ""} / ${goal.target}${unit ? " " + unit : ""}`, achieved: cur >= goal.target,
      };
    }
  }
}

/** A goal is "behind schedule" if its progress lags the share of time elapsed by > 15 points. */
export function isBehindSchedule(goal: Goal, progress: GoalProgress, today = new Date()): boolean {
  if (!goal.deadline || goal.status !== "Active" || progress.achieved) return false;
  const start = new Date(goal.startDate + "T00:00:00").getTime();
  const end = new Date(goal.deadline + "T23:59:59").getTime();
  if (end <= start) return false;
  const elapsed = Math.min(1, Math.max(0, (today.getTime() - start) / (end - start)));
  return progress.percent < elapsed * 100 - 15;
}
