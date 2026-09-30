import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeAttendance, projections, maxMissable, classesNeeded, project,
} from "../src/lib/attendance";
import { computeGoalProgress, isBehindSchedule } from "../src/lib/goals";
import { computeStreaks, buildInsights, summarize, minutesByDay } from "../src/lib/stats";
import { dateKey, daysBetween, dueInstant, monthGrid, parseKey } from "../src/lib/dates";
import { deadlineLabel } from "../src/lib/utils";
import { buildReminders, buildAlerts } from "../src/lib/alerts";
import { renderMarkdown } from "../src/lib/markdown";
import { buildEvents } from "../src/lib/calendar";
import { calculateGPA, requiredFutureGPA } from "../src/lib/gpa";
import { estimateGraduation, nextTerm } from "../src/lib/degree";
import { DEFAULT_GRADE_SCALE, type Course, type StudySession, type AttendanceRecord } from "../src/types";

const rec = (status: AttendanceRecord["status"], n = 1): AttendanceRecord[] =>
  Array.from({ length: n }, (_, i) => ({ courseId: 1, date: `2026-01-${String(i + 1).padStart(2, "0")}`, status }));

// ---------------- Attendance ----------------
test("attendance: spec example 18 present / 3 absent → 85.7%", () => {
  const a = computeAttendance({}, [...rec("Present", 18), ...rec("Absent", 3)], 70);
  assert.equal(a.total, 21);
  assert.ok(Math.abs(a.percentage! - 85.714) < 0.01);
  assert.equal(a.status, "safe");
});
test("attendance: spec projections 78.3% / 88.0%", () => {
  assert.ok(Math.abs(project(18, 3, 0, 2)! - 78.26) < 0.01);
  assert.ok(Math.abs(project(18, 3, 4, 0)! - 88.0) < 0.01);
  const p = projections({ present: 18, absent: 3 });
  assert.equal(p.length, 4);
});
test("attendance: max missable at exact boundary", () => {
  // 7 present of 10 at 70% → already on the line, cannot miss any more.
  assert.equal(maxMissable(7, 3, 70), 0);
  // 18/21 at 70%: 18/0.7 = 25.71 → 25 − 21 = 4 more misses (18/25 = 72%).
  assert.equal(maxMissable(18, 3, 70), 4);
  assert.ok(project(18, 3, 0, 4)! >= 70);
  assert.ok(project(18, 3, 0, 5)! < 70);
});
test("attendance: classes needed to recover", () => {
  // 5/10 = 50% → need (0.7*10 − 5)/0.3 = 6.67 → 7; verify 12/17 ≥ 70%, 11/16 < 70%.
  assert.equal(classesNeeded(5, 5, 70), 7);
  assert.ok(project(5, 5, 7, 0)! >= 70);
  assert.ok(project(5, 5, 6, 0)! < 70);
  assert.equal(classesNeeded(9, 1, 70), 0);
});
test("attendance: excused classes are neutral", () => {
  const withExcused = computeAttendance({}, [...rec("Present", 7), ...rec("Absent", 3), ...rec("Excused", 5)], 70);
  const without = computeAttendance({}, [...rec("Present", 7), ...rec("Absent", 3)], 70);
  assert.equal(withExcused.percentage, without.percentage);
  assert.equal(withExcused.excused, 5);
  assert.equal(withExcused.total, 10);
});
test("attendance: baseline + records combine; per-course requirement overrides", () => {
  const a = computeAttendance({ attendanceBaseline: { present: 10, absent: 2, excused: 0 }, requiredAttendance: 80 }, rec("Present", 2), 70);
  assert.equal(a.present, 12); assert.equal(a.required, 80);
  assert.ok(Math.abs(a.percentage! - (12 / 14) * 100) < 1e-9);
});
test("attendance: empty and 100% edge cases don't crash", () => {
  const e = computeAttendance({}, [], 70);
  assert.equal(e.percentage, null); assert.equal(e.status, "none");
  assert.equal(classesNeeded(3, 1, 100), Infinity);
  assert.equal(maxMissable(0, 0, 70), 0);
});
test("attendance: below threshold is risk", () => {
  assert.equal(computeAttendance({}, [...rec("Present", 6), ...rec("Absent", 4)], 70).status, "risk");
});

// ---------------- Dates & deadlines ----------------
test("dateKey uses LOCAL day, not UTC", () => {
  const d = new Date(2026, 5, 1, 0, 30); // 00:30 local
  assert.equal(dateKey(d), "2026-06-01");
  assert.equal(dateKey(d.toISOString()), "2026-06-01");
});
test("daysBetween is calendar-based", () => {
  assert.equal(daysBetween(new Date(2026, 0, 1, 23, 59), new Date(2026, 0, 2, 0, 1)), 1);
});
test("deadlineLabel: today / tomorrow / overdue / later", () => {
  const now = new Date(2026, 9, 5, 10, 0);
  assert.equal(deadlineLabel("2026-10-05T18:00", now).label, "Due today");
  assert.equal(deadlineLabel("2026-10-06T09:00", now).label, "Due tomorrow");
  assert.equal(deadlineLabel("2026-10-05T09:00", now).urgency, "overdue");
  assert.equal(deadlineLabel("2026-10-05", now).label, "Due today"); // date-only = end of day
  assert.equal(deadlineLabel("2026-10-20", now).label, "15 days left");
  assert.equal(deadlineLabel(undefined, now).urgency, "none");
});
test("monthGrid has 42 days starting on the configured weekday", () => {
  const g = monthGrid(new Date(2026, 9, 15), 6);
  assert.equal(g.length, 42); assert.equal(g[0].getDay(), 6);
});

// ---------------- Stats ----------------
const sess = (id: number, when: Date, minutes: number, courseId = 1): StudySession => ({
  id, courseId, mode: "Custom", plannedMinutes: minutes, actualMinutes: minutes,
  startedAt: when.toISOString(), completed: true,
});
test("streaks: alive through yesterday, best across history", () => {
  const today = new Date(2026, 9, 10, 12);
  const days = [3, 4, 5, 6, 7, 8, 9].map((d) => sess(d, new Date(2026, 9, d, 20), 30)); // 3..9 (7 days), none today
  const byDay = minutesByDay(days);
  const s = computeStreaks(byDay, today);
  assert.equal(s.current, 7); assert.equal(s.best, 7);
  const gap = computeStreaks(minutesByDay([sess(1, new Date(2026, 9, 1), 30), sess(2, new Date(2026, 9, 9), 30)]), today);
  assert.equal(gap.current, 1); assert.equal(gap.best, 1);
});
test("summary withholds behavioural claims on tiny datasets", () => {
  const s = summarize([sess(1, new Date(2026, 9, 9, 20), 40)], 120, new Date(2026, 9, 10));
  assert.equal(s.mostProductiveDay, null); assert.equal(s.mostProductiveTime, null);
});
test("summary reports patterns once enough data exists", () => {
  const list = Array.from({ length: 10 }, (_, i) => sess(i, new Date(2026, 9, 1 + i, 19, 30), 45));
  const s = summarize(list, 120, new Date(2026, 9, 11));
  assert.ok(s.mostProductiveDay); assert.match(s.mostProductiveTime!, /PM/);
  assert.equal(s.sessionCount, 10);
});
test("insights: no peak-time claim with few sessions; week-over-week only with a real baseline", () => {
  const today = new Date(2026, 9, 14, 12); // Wed
  const few = buildInsights({ sessions: [sess(1, new Date(2026, 9, 13, 20), 30)], courses: [], exams: [], dailyGoalMinutes: 120, today });
  assert.ok(!few.some((i) => i.id === "peak" || i.id === "wow"));
  const prior = [4, 5, 6].map((d, i) => sess(i, new Date(2026, 9, d, 20), 60)); // last week
  const cur = [11, 12].map((d, i) => sess(10 + i, new Date(2026, 9, d, 20), 120)); // 240m vs 180m last week
  const ins = buildInsights({ sessions: [...prior, ...cur], courses: [], exams: [], dailyGoalMinutes: 120, today, weekStartsOn: 0 });
  const wow = ins.find((i) => i.id === "wow");
  assert.ok(wow); assert.match(wow!.text, /33% more/);
  // An unchanged week is not an insight.
  const flat = [11, 12].map((d, i) => sess(20 + i, new Date(2026, 9, d, 20), 90)); // 180m == 180m
  assert.ok(!buildInsights({ sessions: [...prior, ...flat], courses: [], exams: [], dailyGoalMinutes: 120, today, weekStartsOn: 0 }).some((i) => i.id === "wow"));
});

// ---------------- Goals ----------------
const baseCtx = { cgpa: 3.0, courses: [] as Course[], sessions: [] as StudySession[], tasks: [], gradeScale: DEFAULT_GRADE_SCALE, attendanceByCourse: new Map<number, number | null>() };
test("goals: study hours derive from sessions within window (87h/120h = 72.5%)", () => {
  const sessions = [sess(1, new Date(2026, 9, 2, 10), 87 * 60), sess(2, new Date(2026, 7, 1, 10), 500 * 60)];
  const p = computeGoalProgress(
    { title: "g", type: "Study", metric: "study_hours", target: 120, startDate: "2026-10-01", status: "Active", createdAt: "" },
    { ...baseCtx, sessions }
  );
  assert.equal(p.current, 87); assert.equal(p.percent, 72.5); assert.equal(p.text, "87h / 120h");
});
test("goals: cgpa uses baseline; course grade waits for a grade; manual is typed", () => {
  const cg = computeGoalProgress({ title: "", type: "Academic", metric: "cgpa", target: 3.2, startValue: 2.7, startDate: "2026-01-01", status: "Active", createdAt: "" }, { ...baseCtx, cgpa: 2.95 });
  assert.equal(Math.round(cg.percent), 50);
  const course = { id: 5, code: "CSE115", grade: "" } as Course;
  const pending = computeGoalProgress({ title: "", type: "Course", metric: "course_grade", courseId: 5, target: 4, startDate: "", status: "Active", createdAt: "" }, { ...baseCtx, courses: [course] });
  assert.equal(pending.percent, 0); assert.ok(pending.note);
  const graded = computeGoalProgress({ title: "", type: "Course", metric: "course_grade", courseId: 5, target: 4, startDate: "", status: "Active", createdAt: "" }, { ...baseCtx, courses: [{ ...course, grade: "A" } as Course] });
  assert.equal(graded.achieved, true);
  const manual = computeGoalProgress({ title: "", type: "Personal", metric: "manual", target: 10, manualCurrent: 4, unit: "books", startDate: "", status: "Active", createdAt: "" }, baseCtx);
  assert.equal(manual.percent, 40); assert.equal(manual.derived, false);
});
test("goals: behind-schedule detection", () => {
  const g = { title: "", type: "Study" as const, metric: "study_hours" as const, target: 100, startDate: "2026-10-01", deadline: "2026-10-31", status: "Active" as const, createdAt: "" };
  const prog = { current: 10, target: 100, percent: 10, unit: "h", text: "", achieved: false, derived: true };
  assert.equal(isBehindSchedule(g, prog, new Date(2026, 9, 20)), true);
  assert.equal(isBehindSchedule(g, { ...prog, percent: 70 }, new Date(2026, 9, 20)), false);
});

// ---------------- Reminders & alerts ----------------
test("reminders respect settings and fire with stable ids", () => {
  const now = new Date(2026, 9, 5, 15, 50); // Monday
  const course = { id: 1, code: "CSE115", room: "LIB609", schedule: [{ days: ["Monday"], startTime: "16:05", endTime: "17:00" }] } as unknown as Course;
  const on = { dailyStudyGoalMinutes: 120, studyReminderHour: 18, remindStudyGoal: false, remindUpcomingClass: true, remindDeadlines: false, remindExams: false, classReminderMinutes: 15 };
  const r = buildReminders({ now, settings: on, courses: [course], tasks: [], exams: [], todayStudyMinutes: 0 });
  assert.equal(r.length, 1); assert.match(r[0].body, /starts in 15 minute/);
  const off = buildReminders({ now, settings: { ...on, remindUpcomingClass: false }, courses: [course], tasks: [], exams: [], todayStudyMinutes: 0 });
  assert.equal(off.length, 0);
});
test("reminders: exam at 3/1/0 days, deadline within 24h, study goal remaining", () => {
  const now = new Date(2026, 9, 5, 19, 0);
  const s = { dailyStudyGoalMinutes: 120, studyReminderHour: 18, remindStudyGoal: true, remindUpcomingClass: false, remindDeadlines: true, remindExams: true, classReminderMinutes: 15 };
  const r = buildReminders({
    now, settings: s, courses: [{ id: 1, code: "SOC101", schedule: [] } as unknown as Course],
    tasks: [{ id: 9, title: "Essay", category: "Assignment", courseId: 1, deadline: "2026-10-06T09:00", status: "Not started", priority: "High", createdAt: "" }],
    exams: [{ id: 4, courseId: 1, title: "Midterm", examType: "Midterm", date: "2026-10-08", preparationPct: 10 }],
    todayStudyMinutes: 45,
  });
  assert.equal(r.length, 3);
  assert.ok(r.some((x) => /75m|1h 15m/.test(x.body)));
  assert.ok(r.some((x) => /in 3 days/.test(x.body)));
});
test("alerts: ordering puts overdue/critical first", () => {
  const now = new Date(2026, 9, 5, 12, 0);
  const a = buildAlerts({
    now, settings: { dailyStudyGoalMinutes: 60, studyReminderHour: 18 }, courses: [{ id: 1, code: "ENG105", schedule: [] } as unknown as Course],
    tasks: [
      { id: 1, title: "Later", category: "Task", courseId: 1, deadline: "2026-10-06T10:00", status: "Not started", priority: "Low", createdAt: "" },
      { id: 2, title: "Late", category: "Task", courseId: 1, deadline: "2026-10-04T10:00", status: "Not started", priority: "Low", createdAt: "" },
    ],
    exams: [], attendance: new Map(), todayStudyMinutes: 0,
  });
  assert.equal(a[0].level, "bad"); assert.match(a[0].text, /overdue/);
});

// ---------------- Markdown ----------------
test("markdown escapes HTML and renders basics", () => {
  const html = renderMarkdown("# Title\n<script>alert(1)</script>\n- [x] done\n- item\n**b** *i* `c`");
  assert.ok(!html.includes("<script>")); assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<h1>Title</h1>")); assert.ok(html.includes("<strong>b</strong>"));
  assert.ok(html.includes('class="task done"'));
});

// ---------------- Calendar ----------------
test("calendar expands class schedule and merges all sources", () => {
  const course = { id: 1, code: "CSE115", title: "PL", room: "R1", schedule: [{ days: ["Monday", "Wednesday"], startTime: "09:00", endTime: "10:30" }] } as unknown as Course;
  const from = new Date(2026, 9, 5); const to = new Date(2026, 9, 11); // Mon..Sun
  const ev = buildEvents({
    from, to, courses: [course], allCourses: [course],
    exams: [{ id: 1, courseId: 1, title: "Quiz 1", examType: "Quiz", date: "2026-10-07", preparationPct: 0 }],
    tasks: [{ id: 1, title: "HW", category: "Assignment", courseId: 1, deadline: "2026-10-08T23:00", status: "Not started", priority: "High", createdAt: "" }],
    routine: [], sessions: [], events: [{ id: 1, title: "Club", kind: "General", date: "2026-10-09", allDay: true }],
  });
  assert.equal(ev.filter((e) => e.source === "class").length, 2);
  assert.equal(ev.filter((e) => e.source === "exam").length, 1);
  assert.equal(ev.filter((e) => e.source === "task").length, 1);
  assert.equal(ev.filter((e) => e.source === "event").length, 1);
  assert.equal(new Set(ev.map((e) => e.uid)).size, ev.length);
});

// ---------------- Existing GPA engine must be unchanged ----------------
test("GPA: retake replaces old grade; credits count once", () => {
  const mk = (id: number, code: string, credits: number, grade: Course["grade"]) => ({ id, code, credits, grade, gpaCounting: true }) as unknown as Course;
  const courses = [mk(1, "CSE115", 3, "C"), mk(2, "ENG102", 3, "B+"), mk(3, "CSE115", 3, "A")];
  const r = calculateGPA(courses, DEFAULT_GRADE_SCALE, { retakeReplacesOldGrade: true, retakeCreditCountsOnce: true });
  assert.ok(Math.abs(r.gpa - (4 * 3 + 3.3 * 3) / 6) < 1e-9);
  const keep = calculateGPA(courses, DEFAULT_GRADE_SCALE, { retakeReplacesOldGrade: false, retakeCreditCountsOnce: true });
  assert.ok(Math.abs(keep.gpa - (2 * 3 + 3.3 * 3 + 4 * 3) / 9) < 1e-9);
  const req = requiredFutureGPA(2.7, 22, 3.5, 108);
  assert.ok(Math.abs(req.required - (3.5 * 130 - 2.7 * 22) / 108) < 1e-9);
});

// ---------------- Degree planner ----------------
test("degree: terms roll Spring→Summer→Fall→next year; graduation estimate", () => {
  assert.deepEqual(nextTerm(2026, "Fall"), { year: 2027, term: "Spring" });
  const e = estimateGraduation({ degreeCredits: 130, completedCredits: 22, currentSemesterNewCredits: 6, plannedFutureCredits: 15, lastPlannedOrCurrent: { year: 2027, term: "Spring" }, creditsPerSemester: 15 });
  assert.equal(e.remainingAfterCurrent, 102);
  assert.equal(e.semestersNeeded, Math.ceil(87 / 15)); // 6 extra terms
  assert.equal(e.label, "Spring 2029");
  assert.ok(parseKey("2026-10-05") instanceof Date && dueInstant("2026-10-05").getHours() === 23);
});

// ---------------- Backup validation ----------------
import { validateBackup, buildBackupFile } from "../src/lib/backup";
test("backup: round-trips a valid current-format file", () => {
  const file = buildBackupFile({
    semesters: [{ id: 1, label: "Fall 2026", term: "Fall", year: 2026, isCurrent: true, registeredCredits: 9 }],
    courses: [{ id: 1, code: "CSE115", semesterId: 1, credits: 3 }],
    attendance: [{ courseId: 1, date: "2026-10-05", status: "Present" }],
    settings: [{ id: 1, gradeScale: { A: 4 } }],
  });
  const c = validateBackup(JSON.parse(JSON.stringify(file)));
  assert.equal(c.ok, true); assert.equal(c.counts.courses, 1); assert.equal(c.legacy, false);
});
test("backup: legacy (top-level tables) files are accepted with a warning", () => {
  const c = validateBackup({ exportedAt: "2026-01-01", semesters: [{ label: "Fall 2025", term: "Fall", year: 2025 }], settings: [{ gradeScale: { A: 4 } }] });
  assert.equal(c.ok, true); assert.equal(c.legacy, true); assert.ok(c.warnings.some((w) => /earlier version/.test(w)));
});
test("backup: rejects garbage, wrong shapes, bad rows and newer formats", () => {
  assert.equal(validateBackup("nope").ok, false);
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup({ hello: "world" }).ok, false);
  assert.equal(validateBackup({ courses: "x" }).ok, false);
  const bad = validateBackup({ attendance: [{ courseId: 1, date: "2026-01-01", status: "Maybe" }] });
  assert.equal(bad.ok, false); assert.match(bad.errors[0], /attendance/);
  assert.equal(validateBackup({ format: "studyos-backup", version: 99, data: {} }).ok, false);
});
