import { AppSettings, Course, Exam, Goal, Task } from "@/types";
import { combine, dateKey, daysBetween, dueInstant, formatMinutes, parseKey } from "@/lib/dates";
import { todaysClasses } from "@/lib/utils";
import { AttendanceStats } from "@/lib/attendance";

export interface Alert {
  id: string;
  level: "bad" | "warn" | "info";
  text: string;
  href?: string;
}

export interface AlertInput {
  now: Date;
  settings: Pick<AppSettings, "dailyStudyGoalMinutes" | "studyReminderHour">;
  courses: Course[]; // current semester
  tasks: Task[];
  exams: Exam[];
  attendance: Map<number, AttendanceStats>;
  todayStudyMinutes: number;
  behindGoals?: Goal[];
}

const rank = { bad: 0, warn: 1, info: 2 } as const;

/** Things worth the student's attention right now, most urgent first. */
export function buildAlerts(input: AlertInput): Alert[] {
  const { now } = input;
  const out: Alert[] = [];
  const code = (id?: number) => input.courses.find((c) => c.id === id)?.code;

  for (const t of input.tasks) {
    if (t.status === "Completed" || !t.deadline) continue;
    const due = dueInstant(t.deadline);
    const days = daysBetween(now, due);
    const who = code(t.courseId);
    const name = `${who ? who + " " : ""}${t.category === "Assignment" ? "assignment" : "task"} "${t.title}"`;
    if (due.getTime() < now.getTime()) out.push({ id: `t-${t.id}`, level: "bad", text: `${name} is overdue`, href: "/planner/tasks" });
    else if (days === 0) out.push({ id: `t-${t.id}`, level: "bad", text: `${name} is due today`, href: "/planner/tasks" });
    else if (days === 1) out.push({ id: `t-${t.id}`, level: "warn", text: `${name} is due tomorrow`, href: "/planner/tasks" });
  }

  for (const e of input.exams) {
    const days = daysBetween(now, parseKey(e.date));
    if (days < 0 || days > 7) continue;
    if (e.preparationPct >= 100) continue;
    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    out.push({
      id: `e-${e.id}`, level: days <= 2 ? "bad" : "warn",
      text: `${code(e.courseId) ?? "Exam"} ${e.title} is ${when} (${e.preparationPct}% prepared)`, href: "/planner/exams",
    });
  }

  for (const c of input.courses) {
    const a = input.attendance.get(c.id!);
    if (!a || a.status === "none" || a.status === "safe") continue;
    out.push({
      id: `a-${c.id}`, level: a.status === "risk" ? "bad" : "warn",
      text: a.status === "risk"
        ? `${c.code} attendance is ${a.percentage!.toFixed(0)}%, below your ${a.required}% requirement`
        : `${c.code} attendance is ${a.percentage!.toFixed(0)}% — close to the ${a.required}% line`,
      href: "/academics/attendance",
    });
  }

  const goal = input.settings.dailyStudyGoalMinutes;
  const hour = input.settings.studyReminderHour ?? 18;
  if (goal > 0 && input.todayStudyMinutes < goal && now.getHours() >= hour) {
    out.push({ id: "study-goal", level: "info", text: `${formatMinutes(goal - input.todayStudyMinutes)} left to reach today's study goal`, href: "/study/timer" });
  }

  for (const g of input.behindGoals ?? []) {
    out.push({ id: `g-${g.id}`, level: "info", text: `Goal "${g.title}" is behind schedule`, href: "/study/goals" });
  }

  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

// ---------------------------------------------------------------------------
// Reminders (things to notify about at a specific moment). Each has a stable
// id so the caller can guarantee it fires at most once.
// ---------------------------------------------------------------------------
export interface Reminder {
  id: string;
  title: string;
  body: string;
  href?: string;
}

export interface ReminderInput extends Omit<AlertInput, "attendance" | "behindGoals"> {
  settings: Pick<
    AppSettings,
    "dailyStudyGoalMinutes" | "studyReminderHour" | "remindStudyGoal" | "remindUpcomingClass" |
    "remindDeadlines" | "remindExams" | "classReminderMinutes"
  >;
}

export function buildReminders(input: ReminderInput): Reminder[] {
  const { now, settings } = input;
  const out: Reminder[] = [];
  const today = dateKey(now);
  const code = (id?: number) => input.courses.find((c) => c.id === id)?.code;

  if (settings.remindUpcomingClass) {
    const lead = settings.classReminderMinutes ?? 15;
    // Only today's classes (matched by weekday), measured from the START time.
    // The class length (90 min) deliberately plays no part in when we remind.
    for (const { course, sched } of todaysClasses(input.courses, now)) {
      const msUntil = combine(today, sched.startTime).getTime() - now.getTime();
      // Due once inside the lead window; never after the class has started (no stale reminders).
      if (msUntil > 0 && msUntil <= lead * 60_000) {
        const mins = Math.max(1, Math.ceil(msUntil / 60_000));
        out.push({
          id: `class-${course.id}-${today}-${sched.startTime}`,
          title: `${course.code} starts soon`,
          body: `${course.code} starts in ${mins} minute${mins === 1 ? "" : "s"}${course.room ? ` · ${course.room}` : ""}`,
          href: "/planner/calendar",
        });
      }
    }
  }

  if (settings.remindDeadlines) {
    for (const t of input.tasks) {
      if (t.status === "Completed" || !t.deadline) continue;
      const hours = (dueInstant(t.deadline).getTime() - now.getTime()) / 3_600_000;
      if (hours > 0 && hours <= 24) {
        const who = code(t.courseId);
        out.push({
          id: `deadline-${t.id}-${t.deadline}`,
          title: "Deadline approaching",
          body: `${who ? who + " " : ""}${t.category === "Assignment" ? "assignment" : "task"} "${t.title}" is due ${daysBetween(now, dueInstant(t.deadline)) === 0 ? "today" : "tomorrow"}.`,
          href: "/planner/tasks",
        });
      }
    }
  }

  if (settings.remindExams) {
    for (const e of input.exams) {
      const days = daysBetween(now, parseKey(e.date));
      if (![3, 1, 0].includes(days)) continue;
      const when = days === 0 ? "today" : days === 1 ? "tomorrow" : "in 3 days";
      out.push({
        id: `exam-${e.id}-${e.date}-${days}`, title: "Exam coming up",
        body: `${code(e.courseId) ?? "Your"} ${e.title} is ${when}.`, href: "/planner/exams",
      });
    }
  }

  if (settings.remindStudyGoal && settings.dailyStudyGoalMinutes > 0) {
    const remaining = settings.dailyStudyGoalMinutes - input.todayStudyMinutes;
    if (remaining > 0 && now.getHours() >= (settings.studyReminderHour ?? 18)) {
      out.push({
        id: `study-${today}`, title: "Study goal",
        body: `You have ${formatMinutes(remaining)} remaining to reach today's study goal.`, href: "/study/timer",
      });
    }
  }
  return out;
}
