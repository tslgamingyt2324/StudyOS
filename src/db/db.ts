import Dexie, { type Table } from "dexie";
import {
  Semester, Course, RoutineItem, Task, StudySession, AppSettings, DEFAULT_GRADE_SCALE,
  Exam, ActiveTimer, AttendanceRecord, Note, Goal, CalendarEvent, PlannedCourse, AchievementUnlock,
  DEFAULT_DASHBOARD_ORDER,
} from "@/types";

export const DB_NAME = "studyos-db";
/** Name of the database used by releases before StudyOS 2.0. It is only ever
 *  READ (never modified or deleted) so an existing install's data is copied
 *  across exactly once and the original stays available as a safety net. */
const PREVIOUS_DB_NAME = "naffiz-os-db";

export class StudyOSDB extends Dexie {
  semesters!: Table<Semester, number>;
  courses!: Table<Course, number>;
  routineItems!: Table<RoutineItem, number>;
  tasks!: Table<Task, number>;
  studySessions!: Table<StudySession, number>;
  settings!: Table<AppSettings, number>;
  exams!: Table<Exam, number>;
  activeTimer!: Table<ActiveTimer, number>;
  attendance!: Table<AttendanceRecord, number>;
  notes!: Table<Note, number>;
  goals!: Table<Goal, number>;
  calendarEvents!: Table<CalendarEvent, number>;
  plannedCourses!: Table<PlannedCourse, number>;
  achievements!: Table<AchievementUnlock, string>;

  constructor() {
    super(DB_NAME);
    // Version history is kept identical to the original app so a database
    // carried over from it upgrades through the same steps.
    this.version(1).stores({
      semesters: "++id, term, year, isCurrent",
      courses: "++id, code, semesterId, gpaCounting, isRetake",
      routineItems: "++id, category, order",
      tasks: "++id, courseId, status, deadline",
      studySessions: "++id, courseId, startedAt",
      settings: "++id",
    });
    this.version(2).stores({
      exams: "++id, courseId, date",
      activeTimer: "id",
    });
    this.version(3).stores({});
    // v4 — StudyOS 2.0. Purely additive: new tables + new indexes. No row in
    // any existing table is modified or removed.
    this.version(4).stores({
      tasks: "++id, courseId, status, deadline, examId",
      attendance: "++id, courseId, date, [courseId+date]",
      notes: "++id, courseId, pinned, archived, updatedAt, *tags",
      goals: "++id, type, status, courseId",
      calendarEvents: "++id, date, courseId",
      plannedCourses: "++id, [year+term], code",
      achievements: "key",
    });
  }
}

export const db = new StudyOSDB();

export function defaultSettings(): AppSettings {
  return {
    userName: "",
    university: "",
    department: "",
    gradeScale: DEFAULT_GRADE_SCALE,
    attendanceThreshold: 70,
    retakeReplacesOldGrade: true,
    retakeCreditCountsOnce: true,
    theme: "system",
    reducedMotion: false,
    dailyStudyGoalMinutes: 120,
    semesterNumber: 1,
    officialCGPA: 0,
    officialCompletedCredits: 0,
    degreeCredits: 120,
    remindStudyGoal: false,
    remindUpcomingClass: false,
    remindDeadlines: false,
    remindExams: false,
    dashboardLayout: { order: DEFAULT_DASHBOARD_ORDER, hidden: [] },
    creditsPerSemester: 15,
    classReminderMinutes: 15,
    studyReminderHour: 18,
  };
}

/** Copies every row from the pre-2.0 database into this one, once. */
async function importPreviousDatabase(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  if ((await db.settings.count()) > 0) return; // already initialised
  if (!(await Dexie.exists(PREVIOUS_DB_NAME))) return;

  const old = new Dexie(PREVIOUS_DB_NAME);
  try {
    await old.open(); // dynamic mode: reads whatever schema is on disk
    const names = old.tables.map((t) => t.name);
    const carried = [
      "semesters", "courses", "routineItems", "tasks", "studySessions",
      "settings", "exams", "activeTimer",
    ] as const;

    // 1. READ everything first. IndexedDB transactions auto-commit as soon as
    //    you await a request from a *different* database, so the old database
    //    must never be touched from inside the write transaction below.
    const rowsByTable = new Map<string, unknown[]>();
    for (const name of carried) {
      if (names.includes(name)) rowsByTable.set(name, await old.table(name).toArray());
    }

    // 2. WRITE in one atomic transaction: all rows arrive or none do.
    await db.transaction("rw", carried.map((n) => db.table(n)), async () => {
      if ((await db.settings.count()) > 0) return; // lost a race with another tab
      for (const [name, rows] of rowsByTable) {
        if (rows.length) await db.table(name).bulkPut(rows);
      }
      // Fill in the fields the newer settings model expects, without
      // overwriting anything the user already had.
      const s = await db.settings.toCollection().first();
      if (s?.id !== undefined) {
        const d = defaultSettings();
        await db.settings.update(s.id, {
          dashboardLayout: s.dashboardLayout ?? d.dashboardLayout,
          creditsPerSemester: s.creditsPerSemester ?? d.creditsPerSemester,
          classReminderMinutes: s.classReminderMinutes ?? d.classReminderMinutes,
          studyReminderHour: s.studyReminderHour ?? d.studyReminderHour,
        });
      }
    });
  } catch (err) {
    // Never block startup because the old database is unreadable.
    console.warn("StudyOS: could not import previous data", err);
  } finally {
    old.close();
  }
}

/** Creates the single settings row on a truly fresh install. */
async function ensureSettings(): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    if ((await db.settings.count()) === 0) await db.settings.add(defaultSettings());
  });
}

/** Repairs settings rows that predate 2.0 (idempotent; never overwrites). */
async function backfillSettings(): Promise<void> {
  const s = await db.settings.toCollection().first();
  if (!s?.id) return;
  const d = defaultSettings();
  const patch: Partial<AppSettings> = {};
  if (!s.dashboardLayout) patch.dashboardLayout = d.dashboardLayout;
  if (s.creditsPerSemester === undefined) patch.creditsPerSemester = d.creditsPerSemester;
  if (s.classReminderMinutes === undefined) patch.classReminderMinutes = d.classReminderMinutes;
  if (s.studyReminderHour === undefined) patch.studyReminderHour = d.studyReminderHour;
  if (Object.keys(patch).length) await db.settings.update(s.id, patch);
}

/**
 * Removes accidental duplicate course rows. Identity is (semester + code) — a
 * retake in a LATER semester is a different key, so it is never touched.
 */
export async function dedupeCourses(): Promise<void> {
  await db.transaction("rw", db.courses, async () => {
    const all = await db.courses.toArray();
    const groups = new Map<string, Course[]>();
    for (const c of all) {
      const key = `${c.semesterId}::${c.code}`;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    const toDelete: number[] = [];
    for (const group of groups.values()) {
      if (group.length <= 1) continue;
      const sorted = [...group].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
      const keeper = sorted.find((c) => (c.schedule ?? []).length > 0) ?? sorted[0];
      for (const c of sorted) if (c.id !== keeper.id) toDelete.push(c.id!);
    }
    if (toDelete.length) await db.courses.bulkDelete(toDelete);
  });
}

/** Guarantees exactly one current semester when any semester exists. */
export async function normalizeCurrentSemester(): Promise<void> {
  await db.transaction("rw", db.semesters, db.settings, async () => {
    const all = await db.semesters.toArray();
    if (all.length === 0) return;
    const current = all.filter((s) => s.isCurrent);
    if (current.length === 1) return;
    const keep = current.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0] ?? all.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    for (const s of all) {
      const should = s.id === keep.id;
      if (s.isCurrent !== should) await db.semesters.update(s.id!, { isCurrent: should });
    }
    const st = await db.settings.toCollection().first();
    if (st?.id) await db.settings.update(st.id, { currentSemesterId: keep.id });
  });
}

/** Runs the boot pipeline once per app launch. Safe to call repeatedly. */
export async function runDataMigrations(): Promise<void> {
  await importPreviousDatabase();
  await ensureSettings();
  await backfillSettings();
  await dedupeCourses();
  await normalizeCurrentSemester();
}

/** Permanently deletes every StudyOS database on this device, including the
 *  pre-2.0 one (otherwise it would be re-imported on the next launch). */
export async function deleteAllData(): Promise<void> {
  db.close();
  await Dexie.delete(DB_NAME);
  await Dexie.delete(PREVIOUS_DB_NAME);
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("studyos:")).forEach((k) => localStorage.removeItem(k));
  } catch { /* storage blocked */ }
}

/** All user tables, in the order they are exported / restored. */
export const BACKUP_TABLES = [
  "semesters", "courses", "routineItems", "tasks", "studySessions", "settings", "exams",
  "attendance", "notes", "goals", "calendarEvents", "plannedCourses", "achievements",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];
