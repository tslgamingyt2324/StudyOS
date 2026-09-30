import { Course, Exam, Goal, StudySession } from "@/types";
import { addDays, dateKey, daysBetween, formatMinutes, parseKey, startOfWeek } from "@/lib/dates";

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Minimum data before we are willing to describe behaviour. */
export const MIN_SESSIONS_FOR_PATTERNS = 8;
export const MIN_DAYS_FOR_PATTERNS = 4;

export const completed = (sessions: StudySession[]) => sessions.filter((s) => s.completed && s.actualMinutes > 0);

export function minutesByDay(sessions: StudySession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of completed(sessions)) {
    const k = dateKey(s.startedAt);
    map.set(k, (map.get(k) ?? 0) + s.actualMinutes);
  }
  return map;
}

export function sumMinutes(sessions: StudySession[]): number {
  return completed(sessions).reduce((t, s) => t + s.actualMinutes, 0);
}

export function sessionsBetween(sessions: StudySession[], fromKey: string, toKey: string): StudySession[] {
  return completed(sessions).filter((s) => {
    const k = dateKey(s.startedAt);
    return k >= fromKey && k <= toKey;
  });
}

/**
 * Current streak = consecutive study days. If nothing has been studied yet
 * TODAY the streak is still alive as long as yesterday was studied — the day
 * is not over. Best streak is the longest run anywhere in history.
 */
export function computeStreaks(byDay: Map<string, number>, today = new Date()): { current: number; best: number } {
  const days = [...byDay.keys()].sort();
  let best = 0, run = 0, prev: Date | null = null;
  for (const k of days) {
    const d = parseKey(k);
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let cursor = today;
  if (!byDay.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  let current = 0;
  while (byDay.has(dateKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best };
}

export function byCourse(sessions: StudySession[]): Map<number | "none", number> {
  const map = new Map<number | "none", number>();
  for (const s of completed(sessions)) {
    const k = s.courseId ?? "none";
    map.set(k, (map.get(k) ?? 0) + s.actualMinutes);
  }
  return map;
}

export function byActivity(sessions: StudySession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of completed(sessions)) {
    const k = s.isQuickStudy ? "Quick Study" : s.studyType ?? "Other";
    map.set(k, (map.get(k) ?? 0) + s.actualMinutes);
  }
  return map;
}

export function byWeekday(sessions: StudySession[]): number[] {
  const arr = Array(7).fill(0) as number[];
  for (const s of completed(sessions)) arr[new Date(s.startedAt).getDay()] += s.actualMinutes;
  return arr;
}

export function byMonth(sessions: StudySession[], months = 6, today = new Date()): { key: string; label: string; minutes: number }[] {
  const out: { key: string; label: string; minutes: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(undefined, { month: "short" }), minutes: 0 });
  }
  for (const s of completed(sessions)) {
    const d = new Date(s.startedAt);
    const row = out.find((r) => r.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (row) row.minutes += s.actualMinutes;
  }
  return out;
}

export function lastNDays(byDay: Map<string, number>, n: number, today = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(today, -(n - 1 - i));
    const key = dateKey(d);
    return { key, date: d, minutes: byDay.get(key) ?? 0 };
  });
}

/** Hour-of-day buckets (0–23) weighted by minutes studied. */
export function byHour(sessions: StudySession[]): number[] {
  const arr = Array(24).fill(0) as number[];
  for (const s of completed(sessions)) arr[new Date(s.startedAt).getHours()] += s.actualMinutes;
  return arr;
}

export interface StudySummary {
  totalMinutes: number;
  sessionCount: number;
  avgSessionMinutes: number;
  longestSessionMinutes: number;
  activeDays: number;
  currentStreak: number;
  bestStreak: number;
  /** null until there is enough history to say. */
  mostProductiveDay: string | null;
  mostProductiveTime: string | null;
  goalDaysMet: number;
  goalCompletionRate: number; // % of active days that met the daily goal
}

function formatHourRange(startHour: number, span = 3): string {
  const f = (h: number) => {
    const hh = ((h % 24) + 24) % 24;
    return `${hh % 12 === 0 ? 12 : hh % 12} ${hh >= 12 ? "PM" : "AM"}`;
  };
  return `${f(startHour)} – ${f(startHour + span)}`;
}

export function summarize(sessions: StudySession[], dailyGoalMinutes: number, today = new Date()): StudySummary {
  const done = completed(sessions);
  const byDay = minutesByDay(done);
  const total = sumMinutes(done);
  const { current, best } = computeStreaks(byDay, today);
  const enough = done.length >= MIN_SESSIONS_FOR_PATTERNS && byDay.size >= MIN_DAYS_FOR_PATTERNS;

  let mostProductiveDay: string | null = null;
  let mostProductiveTime: string | null = null;
  if (enough) {
    const wd = byWeekday(done);
    mostProductiveDay = WEEKDAY_LONG[wd.indexOf(Math.max(...wd))];
    const hours = byHour(done);
    let bestStart = 0, bestVal = -1;
    for (let h = 0; h < 24; h++) {
      const v = hours[h] + hours[(h + 1) % 24] + hours[(h + 2) % 24];
      if (v > bestVal) { bestVal = v; bestStart = h; }
    }
    mostProductiveTime = formatHourRange(bestStart);
  }

  const goalDaysMet = [...byDay.values()].filter((m) => m >= dailyGoalMinutes).length;
  return {
    totalMinutes: total,
    sessionCount: done.length,
    avgSessionMinutes: done.length ? total / done.length : 0,
    longestSessionMinutes: done.reduce((m, s) => Math.max(m, s.actualMinutes), 0),
    activeDays: byDay.size,
    currentStreak: current,
    bestStreak: best,
    mostProductiveDay,
    mostProductiveTime,
    goalDaysMet,
    goalCompletionRate: byDay.size ? Math.round((goalDaysMet / byDay.size) * 100) : 0,
  };
}

export interface Insight {
  id: string;
  tone: "good" | "info" | "warn";
  text: string;
}

/**
 * Rule-based insights computed straight from the user's own data. There is no
 * model or external service involved; each rule states the threshold it needs.
 */
export function buildInsights(input: {
  sessions: StudySession[];
  courses: Course[]; // current-semester courses
  exams: Exam[];
  goals?: { goal: Goal; percent: number }[];
  dailyGoalMinutes: number;
  weekStartsOn?: number;
  today?: Date;
}): Insight[] {
  const today = input.today ?? new Date();
  const wso = input.weekStartsOn ?? 0;
  const out: Insight[] = [];
  const done = completed(input.sessions);

  // 1. Week-over-week — needs a meaningful prior week (≥ 1h) to compare against.
  const thisStart = startOfWeek(today, wso);
  const prevStart = addDays(thisStart, -7);
  const thisMin = sumMinutes(sessionsBetween(done, dateKey(thisStart), dateKey(today)));
  // Compare like-for-like: only the days of last week that have elapsed this week.
  const elapsed = daysBetween(thisStart, today);
  const prevSame = sumMinutes(sessionsBetween(done, dateKey(prevStart), dateKey(addDays(prevStart, elapsed))));
  if (prevSame >= 60 && thisMin > 0) {
    const pct = Math.round(((thisMin - prevSame) / prevSame) * 100);
    if (Math.abs(pct) >= 5) {
      out.push({
        id: "wow", tone: pct > 0 ? "good" : "info",
        text: pct > 0
          ? `You've studied ${pct}% more than at this point last week.`
          : `You've studied ${Math.abs(pct)}% less than at this point last week.`,
      });
    }
  }

  // 2. Peak time — needs enough sessions AND days.
  const byDay = minutesByDay(done);
  if (done.length >= MIN_SESSIONS_FOR_PATTERNS && byDay.size >= MIN_DAYS_FOR_PATTERNS) {
    const s = summarize(done, input.dailyGoalMinutes, today);
    if (s.mostProductiveTime) out.push({ id: "peak", tone: "info", text: `Most of your study time falls between ${s.mostProductiveTime}.` });
  }

  // 3. Under-studied course — needs ≥ 2 courses, ≥ 5h total logged against them.
  const perCourse = byCourse(done);
  const rows = input.courses.map((c) => ({ c, m: perCourse.get(c.id!) ?? 0 }));
  const totalOnCourses = rows.reduce((t, r) => t + r.m, 0);
  if (rows.length >= 2 && totalOnCourses >= 300) {
    const avg = totalOnCourses / rows.length;
    const lowest = [...rows].sort((a, b) => a.m - b.m)[0];
    if (lowest.m < avg * 0.5) {
      out.push({ id: "neglect", tone: "warn", text: `${lowest.c.code} has received far less study time (${formatMinutes(lowest.m)}) than your other courses.` });
    }
  }

  // 4. Study goal — today's progress (only meaningful once something is logged).
  const todayMin = byDay.get(dateKey(today)) ?? 0;
  if (todayMin > 0 && todayMin < input.dailyGoalMinutes) {
    out.push({ id: "today-goal", tone: "info", text: `Your daily study goal is ${Math.round((todayMin / input.dailyGoalMinutes) * 100)}% complete.` });
  } else if (todayMin >= input.dailyGoalMinutes && input.dailyGoalMinutes > 0) {
    out.push({ id: "today-goal", tone: "good", text: "You've reached today's study goal." });
  }

  // 5. Next exam.
  const upcoming = input.exams
    .map((e) => ({ e, d: daysBetween(today, parseKey(e.date)) }))
    .filter((x) => x.d >= 0)
    .sort((a, b) => a.d - b.d)[0];
  if (upcoming) {
    const course = input.courses.find((c) => c.id === upcoming.e.courseId);
    out.push({
      id: "next-exam", tone: upcoming.d <= 3 ? "warn" : "info",
      text: `Your next exam${course ? ` (${course.code})` : ""} is ${upcoming.d === 0 ? "today" : upcoming.d === 1 ? "tomorrow" : `in ${upcoming.d} days`}.`,
    });
  }

  // 6. Goals that are well underway.
  for (const g of input.goals ?? []) {
    if (g.goal.status === "Active" && g.percent >= 70 && g.percent < 100 && g.goal.metric === "study_hours") {
      out.push({ id: `goal-${g.goal.id}`, tone: "good", text: `"${g.goal.title}" is ${Math.round(g.percent)}% complete.` });
      break;
    }
  }
  return out;
}
