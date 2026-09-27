import Dexie, { type Table } from "dexie";
import {
  Semester, Course, RoutineItem, Task, StudySession, AppSettings, DEFAULT_GRADE_SCALE,
  Exam, ActiveTimer, Grade,
} from "@/types";

export class NaffizDB extends Dexie {
  semesters!: Table<Semester, number>;
  courses!: Table<Course, number>;
  routineItems!: Table<RoutineItem, number>;
  tasks!: Table<Task, number>;
  studySessions!: Table<StudySession, number>;
  settings!: Table<AppSettings, number>;
  exams!: Table<Exam, number>;
  activeTimer!: Table<ActiveTimer, number>;

  constructor() {
    super("naffiz-os-db");
    this.version(1).stores({
      semesters: "++id, term, year, isCurrent",
      courses: "++id, code, semesterId, gpaCounting, isRetake",
      routineItems: "++id, category, order",
      tasks: "++id, courseId, status, deadline",
      studySessions: "++id, courseId, startedAt",
      settings: "++id",
    });
    // v2 is additive — existing installs keep every row they already have.
    this.version(2).stores({
      semesters: "++id, term, year, isCurrent",
      courses: "++id, code, semesterId, gpaCounting, isRetake",
      routineItems: "++id, category, order",
      tasks: "++id, courseId, status, deadline",
      studySessions: "++id, courseId, startedAt",
      settings: "++id",
      exams: "++id, courseId, date",
      activeTimer: "id",
    }).upgrade(async (tx) => {
      // Backfill new settings fields for anyone upgrading from v1.
      const s = await tx.table("settings").toCollection().first();
      if (s) {
        await tx.table("settings").update(s.id, {
          semesterNumber: s.semesterNumber ?? 3,
          remindStudyGoal: s.remindStudyGoal ?? false,
          remindUpcomingClass: s.remindUpcomingClass ?? false,
          remindDeadlines: s.remindDeadlines ?? false,
          remindExams: s.remindExams ?? false,
        });
      }
    });
    // ---------------------------------------------------------------------
    // v3 — introduces the AUTHORITATIVE ACADEMIC PROFILE fields
    // (officialCGPA / officialCompletedCredits / degreeCredits). This is a
    // Dexie schema migration, so it is GUARANTEED by Dexie to run exactly
    // once per browser database, unlike a hand-rolled "dataVersion" flag
    // that a bug elsewhere could skip. This is what makes the official
    // CGPA/credits numbers a real single source of truth instead of a
    // value recalculated (and sometimes miscalculated) from course rows.
    // ---------------------------------------------------------------------
    this.version(3).stores({
      semesters: "++id, term, year, isCurrent",
      courses: "++id, code, semesterId, gpaCounting, isRetake",
      routineItems: "++id, category, order",
      tasks: "++id, courseId, status, deadline",
      studySessions: "++id, courseId, startedAt",
      settings: "++id",
      exams: "++id, courseId, date",
      activeTimer: "id",
    }).upgrade(async (tx) => {
      const s = await tx.table("settings").toCollection().first();
      if (s) {
        await tx.table("settings").update(s.id, {
          // Verified against the official NSU transcript — see PART 1/5 of
          // the source-of-truth spec. Only backfilled if missing so a
          // future in-app edit (once semester 3 posts real grades) is
          // never clobbered by this migration re-running.
          officialCGPA: s.officialCGPA ?? 2.70,
          officialCompletedCredits: s.officialCompletedCredits ?? 22,
          degreeCredits: s.degreeCredits ?? 130,
        });
      }
    });
  }
}

export const db = new NaffizDB();

// Bump this whenever normalizeAcademicData()'s one-time settings backfill
// below needs to run again on devices that already have data saved from an
// earlier version. (The unconditional dedupe/schedule-repair steps in that
// same function always run, on every launch, regardless of this number.)
export const CURRENT_DATA_VERSION = 3;

// ---------------------------------------------------------------------------
// Canonical "golden record" definitions for Naffiz's real NSU academic
// history. These are verified transcript facts (PART 5/6/8/29 of the
// source-of-truth spec), used by normalizeAcademicData() below to dedupe
// and repair course rows regardless of what state they're already in.
// ---------------------------------------------------------------------------
interface GoldenCourse {
  code: string;
  title: string;
  credits: number;
  faculty: string;
  section: string;
  room?: string;
  isRetake: boolean;
  grade: Grade;
  status: Course["status"];
  schedule: Course["schedule"];
  retakeTargetGrade?: Grade;
  retakePlannedSemester?: string;
}

const SPRING_2026: GoldenCourse[] = [
  { code: "CSE115", title: "Programming Language", credits: 3, faculty: "MSRb", section: "5", isRetake: false, grade: "C", status: "Completed", schedule: [] },
  { code: "CSE115L", title: "Programming Language Lab", credits: 1, faculty: "MSRb", section: "5", isRetake: false, grade: "C+", status: "Completed", schedule: [] },
  { code: "ENG102", title: "Introduction to Composition", credits: 3, faculty: "KSS", section: "14", isRetake: false, grade: "B+", status: "Completed", schedule: [] },
  { code: "MAT116", title: "Pre-Calculus", credits: 3, faculty: "ALQ", section: "14", isRetake: false, grade: "C", status: "Completed", schedule: [] },
];

const SUMMER_2026: GoldenCourse[] = [
  { code: "CSE173", title: "Discrete Mathematics", credits: 3, faculty: "SfT", section: "14", isRetake: false, grade: "B", status: "Completed", schedule: [] },
  { code: "ENG103", title: "Intermediate Composition", credits: 3, faculty: "STO", section: "52", isRetake: false, grade: "A-", status: "Completed", schedule: [] },
  { code: "POL101", title: "Introduction to Political Science", credits: 3, faculty: "AKHN", section: "48", isRetake: false, grade: "B+", status: "Completed", schedule: [] },
  { code: "SOC101", title: "Introduction to Sociology", credits: 3, faculty: "ZIM", section: "49", isRetake: false, grade: "C-", status: "Completed", schedule: [], retakeTargetGrade: "A", retakePlannedSemester: "Future" },
];

// Day codes: RA = Thursday & Saturday, MW = Monday & Wednesday. There is NO
// class on Sunday, Tuesday, or Friday — see PART 8/16 of the spec. Retake
// linkage (originalCourseId) is wired up to the matching Spring row in
// normalizeAcademicData() below, since it needs that row's real id.
const FALL_2026: GoldenCourse[] = [
  { code: "BIO103", title: "Biology I", credits: 3, faculty: "LTB", section: "49", room: "NAC413", isRetake: false, grade: "", status: "In Progress", schedule: [{ days: ["Thursday", "Saturday"], startTime: "08:00", endTime: "09:30" }] },
  { code: "CHE101", title: "General Chemistry", credits: 3, faculty: "NKA", section: "28", room: "SAC401", isRetake: false, grade: "", status: "In Progress", schedule: [{ days: ["Monday", "Wednesday"], startTime: "16:20", endTime: "17:50" }] },
  { code: "CSE115", title: "Programming Language", credits: 3, faculty: "AKR", section: "14", room: "LIB609", isRetake: true, grade: "", status: "In Progress", schedule: [{ days: ["Thursday", "Saturday"], startTime: "16:20", endTime: "17:50" }], retakeTargetGrade: "A" },
  { code: "CSE115L", title: "Programming Language Lab", credits: 1, faculty: "TnS1", section: "11", room: "LIB603", isRetake: true, grade: "", status: "In Progress", schedule: [{ days: ["Monday", "Wednesday"], startTime: "13:00", endTime: "14:30" }], retakeTargetGrade: "A" },
];

// ---------------------------------------------------------------------------
// One-time seed of Naffiz's real NSU academic record (matches official
// "Grade History" transcript: 22.00 credits completed, 2.70 CGPA).
//
// IMPORTANT: the empty-check and the writes now happen INSIDE a single
// transaction. Next.js dev mode (React Strict Mode) intentionally invokes
// effects twice, which previously caused two near-simultaneous calls to
// both see "0 rows" before either had finished writing — seeding the whole
// dataset twice (the "BIO103 BIO103, CSE115 CSE115" duplicate bug).
// IndexedDB serializes read-write transactions that touch the same table,
// so doing the check inside the transaction makes this atomic.
// ---------------------------------------------------------------------------
export async function seedIfEmpty() {
  await db.transaction(
    "rw",
    [db.semesters, db.courses, db.routineItems, db.settings],
    async () => {
      const count = await db.settings.count();
      if (count > 0) return; // already seeded — guaranteed accurate now

      const springId = await db.semesters.add({
        term: "Spring", year: 2026, label: "Spring 2026", isCurrent: false, registeredCredits: 10,
      });
      const summerId = await db.semesters.add({
        term: "Summer", year: 2026, label: "Summer 2026", isCurrent: false, registeredCredits: 12,
      });
      const fallId = await db.semesters.add({
        term: "Fall", year: 2026, label: "Fall 2026", isCurrent: true, registeredCredits: 10,
      });

      const idByCode = new Map<string, number>();

      for (const g of SPRING_2026) {
        const id = await db.courses.add({
          code: g.code, title: g.title, credits: g.credits, faculty: g.faculty, section: g.section,
          semesterId: springId, schedule: g.schedule, gpaCounting: true, degreeCredit: true, isRetake: false,
          grade: g.grade, status: g.status,
        });
        idByCode.set(`spring::${g.code}`, id);
      }

      for (const g of SUMMER_2026) {
        await db.courses.add({
          code: g.code, title: g.title, credits: g.credits, faculty: g.faculty, section: g.section,
          semesterId: summerId, schedule: g.schedule, gpaCounting: true, degreeCredit: true, isRetake: false,
          grade: g.grade, status: g.status,
          retakeTargetGrade: g.retakeTargetGrade, retakePlannedSemester: g.retakePlannedSemester,
        });
      }

      for (const g of FALL_2026) {
        await db.courses.add({
          code: g.code, title: g.title, credits: g.credits, faculty: g.faculty, section: g.section, room: g.room,
          semesterId: fallId, gpaCounting: true, degreeCredit: true, isRetake: g.isRetake,
          originalCourseId: g.isRetake ? idByCode.get(`spring::${g.code}`) : undefined,
          retakeTargetGrade: g.retakeTargetGrade,
          grade: g.grade, status: g.status, schedule: g.schedule,
        });
      }

      // A few starter routine blocks around the real Fall 2026 timetable
      await db.routineItems.bulkAdd([
        { title: "Deep work: DSA practice", category: "Study", startTime: "19:00", endTime: "20:30", daysOfWeek: [0, 1, 2, 3, 4], priority: "High", completed: false, completedDates: [], order: 0 },
        { title: "Wind down / sleep", category: "Sleep", startTime: "23:30", endTime: "07:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], priority: "Medium", completed: false, completedDates: [], order: 1 },
      ]);

      await db.settings.add({
        userName: "Naffiz",
        university: "North South University",
        department: "Computer Science & Engineering",
        currentSemesterId: fallId,
        gradeScale: DEFAULT_GRADE_SCALE,
        attendanceThreshold: 70,
        retakeReplacesOldGrade: true,
        retakeCreditCountsOnce: true,
        theme: "system",
        reducedMotion: false,
        targetCGPA: 3.5,
        dailyStudyGoalMinutes: 240,
        semesterNumber: 3,
        dataVersion: CURRENT_DATA_VERSION,
        officialCGPA: 2.70,
        officialCompletedCredits: 22,
        degreeCredits: 130,
        remindStudyGoal: false,
        remindUpcomingClass: false,
        remindDeadlines: false,
        remindExams: false,
      });
    }
  );
}

// ---------------------------------------------------------------------------
// Safe, always-on dedupe: removes accidental duplicate ROWS while never
// treating a legitimate retake attempt as a duplicate of its original.
//
// Identity key is (semesterId + code) — NOT (code + semesterId + faculty +
// section) like the original version. The old key failed to catch
// duplicates whose faculty/section differed slightly (e.g. re-seeded with a
// typo'd section), and there is no legitimate reason for the same course
// code to appear twice within the SAME semester/enrollment. A retake in a
// LATER semester (different semesterId) is a different key entirely, so
// Spring CSE115 + Fall CSE115 both survive untouched (PART 12).
//
// When duplicates are found, the row that looks most "complete" is kept
// (has a schedule for a current course, or just the lowest id as a
// tiebreaker) rather than always blindly keeping the first insert.
// Safe to run on every launch — it's a no-op once data is clean.
// ---------------------------------------------------------------------------
export async function dedupeCourses() {
  await db.transaction("rw", [db.courses], async () => {
    const all = await db.courses.toArray();
    const groups = new Map<string, Course[]>();
    for (const c of all) {
      const key = `${c.semesterId}::${c.code}`;
      const arr = groups.get(key) ?? [];
      arr.push(c);
      groups.set(key, arr);
    }

    const toDelete: number[] = [];
    for (const [, group] of groups) {
      if (group.length <= 1) continue;
      const sorted = [...group].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
      // Prefer a row that already has a non-empty schedule (more "complete"
      // record for a current-semester course); otherwise keep the earliest.
      const withSchedule = sorted.find((c) => (c.schedule ?? []).length > 0);
      const keeper = withSchedule ?? sorted[0];
      for (const c of sorted) {
        if (c.id !== keeper.id) toDelete.push(c.id!);
      }
    }
    if (toDelete.length) await db.courses.bulkDelete(toDelete);
  });

  await db.transaction("rw", [db.semesters], async () => {
    const all = await db.semesters.toArray();
    const seen = new Map<string, number>();
    const toDelete: number[] = [];
    for (const s of all.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
      const key = `${s.term}::${s.year}`;
      if (seen.has(key)) toDelete.push(s.id!);
      else seen.set(key, s.id!);
    }
    if (toDelete.length) await db.semesters.bulkDelete(toDelete);

    // Exactly one semester should ever be "current" — Fall 2026.
    const remaining = await db.semesters.toArray();
    const fall = remaining.find((s) => s.term === "Fall" && s.year === 2026);
    for (const s of remaining) {
      const shouldBeCurrent = fall ? s.id === fall.id : s.isCurrent;
      if (s.isCurrent !== shouldBeCurrent) {
        await db.semesters.update(s.id!, { isCurrent: shouldBeCurrent });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Always-on schedule/room self-heal for the current semester's 4 courses.
// There is no UI anywhere in the app that lets the schedule or room be
// edited, so it is always safe to reassert these exact values on every
// launch — this is what guarantees the Sunday/today's-classes bug (PART 9)
// can never come back, no matter what bad schedule data is already sitting
// in someone's IndexedDB. Grade is deliberately NOT touched here: that IS
// user-editable (course detail page), so it's only corrected once, in
// normalizeAcademicData() below, guarded by dataVersion.
// ---------------------------------------------------------------------------
export async function repairCurrentSemesterSchedule() {
  await db.transaction("rw", [db.courses, db.semesters], async () => {
    const semesters = await db.semesters.toArray();
    const fallId = semesters.find((s) => s.term === "Fall" && s.year === 2026)?.id;
    if (!fallId) return;

    for (const g of FALL_2026) {
      const course = await db.courses.where({ semesterId: fallId, code: g.code }).first();
      if (!course) continue;
      const needsFix =
        JSON.stringify(course.schedule) !== JSON.stringify(g.schedule) ||
        course.room !== g.room ||
        course.credits !== g.credits;
      if (needsFix) {
        await db.courses.update(course.id!, { schedule: g.schedule, room: g.room, credits: g.credits });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// One-time (per dataVersion) repair of everything else that must match the
// official transcript: historical grades/flags, current-semester retake
// linkage/flags, and the authoritative settings.officialCGPA /
// officialCompletedCredits / degreeCredits fields.
//
// Gated by settings.dataVersion (unlike dedupeCourses/repairCurrentSemesterSchedule
// above, which always run) because these fields ARE user-editable elsewhere
// in the app (grade dropdown, "Is a retake" checkbox) — once this has run
// once on a device, a later intentional edit must stick, not get silently
// reverted on the next launch.
// ---------------------------------------------------------------------------
export async function fixKnownDataIssues() {
  await db.transaction("rw", [db.courses, db.semesters, db.settings], async () => {
    const settings = await db.settings.toCollection().first();
    if (!settings) return; // nothing seeded yet — seedIfEmpty will write correct data directly
    if ((settings.dataVersion ?? 1) >= CURRENT_DATA_VERSION) return; // already corrected

    const semesters = await db.semesters.toArray();
    const springId = semesters.find((s) => s.term === "Spring" && s.year === 2026)?.id;
    const summerId = semesters.find((s) => s.term === "Summer" && s.year === 2026)?.id;
    const fallId = semesters.find((s) => s.term === "Fall" && s.year === 2026)?.id;

    const patchByCode = async (semesterId: number | undefined, golden: GoldenCourse[], extra?: (g: GoldenCourse) => Partial<Course>) => {
      if (!semesterId) return;
      for (const g of golden) {
        const course = await db.courses.where({ semesterId, code: g.code }).first();
        if (!course) continue;
        await db.courses.update(course.id!, {
          grade: g.grade,
          gpaCounting: true,
          degreeCredit: true,
          status: g.status,
          ...(extra ? extra(g) : {}),
        });
      }
    };

    // Spring 2026 — official TGPA 2.42 requires ALL four courses to count.
    await patchByCode(springId, SPRING_2026);

    // Summer 2026 — official TGPA 2.93 / cumulative CGPA 2.70.
    await patchByCode(summerId, SUMMER_2026, (g) => ({
      retakeTargetGrade: g.retakeTargetGrade,
      retakePlannedSemester: g.retakePlannedSemester,
    }));

    // Fall 2026 (current) — correct retake linkage/flags. Schedule/room are
    // handled unconditionally by repairCurrentSemesterSchedule(), not here.
    if (fallId) {
      const springCse115 = springId ? await db.courses.where({ semesterId: springId, code: "CSE115" }).first() : undefined;
      const springCse115L = springId ? await db.courses.where({ semesterId: springId, code: "CSE115L" }).first() : undefined;

      for (const g of FALL_2026) {
        const course = await db.courses.where({ semesterId: fallId, code: g.code }).first();
        if (!course) continue;
        const originalCourseId = g.code === "CSE115" ? springCse115?.id : g.code === "CSE115L" ? springCse115L?.id : undefined;
        await db.courses.update(course.id!, {
          isRetake: g.isRetake,
          gpaCounting: true,
          degreeCredit: true,
          ...(g.isRetake ? { retakeTargetGrade: g.retakeTargetGrade, originalCourseId } : {}),
        });
      }
    }

    await db.settings.update(settings.id!, {
      dataVersion: CURRENT_DATA_VERSION,
      dailyStudyGoalMinutes: settings.dailyStudyGoalMinutes ?? 240,
      semesterNumber: settings.semesterNumber ?? 3,
      // Authoritative academic profile — verified transcript values. Only
      // written here (once) if somehow still missing; the Dexie v3
      // upgrade() above is the primary path that backfills these.
      officialCGPA: settings.officialCGPA ?? 2.70,
      officialCompletedCredits: settings.officialCompletedCredits ?? 22,
      degreeCredits: settings.degreeCredits ?? 130,
    });
  });
}

/** Runs the full self-healing pipeline in the right order. Call once on app boot. */
export async function runDataMigrations() {
  await seedIfEmpty();
  await dedupeCourses();
  await repairCurrentSemesterSchedule();
  await fixKnownDataIssues();
}
