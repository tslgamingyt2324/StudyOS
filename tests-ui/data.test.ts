import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import { db, runDataMigrations, deleteAllData } from "@/db/db";
import { deleteCourseCascade, setAttendance, setCurrentSemester } from "@/db/actions";
import { exportBackupObject, restoreBackup } from "@/db/backupIo";
import { validateBackup } from "@/lib/backup";
import { resetDb, seedRich } from "./seed";

const LEGACY = "naffiz-os-db";

describe("first run", () => {
  beforeEach(resetDb);
  it("creates one default settings row with no personal data", async () => {
    await runDataMigrations(); await runDataMigrations(); // idempotent
    const all = await db.settings.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].userName).toBe("");
    expect(await db.courses.count()).toBe(0);
  });
});

describe("upgrade from the previous app version", () => {
  beforeEach(async () => { await resetDb(); await Dexie.delete(LEGACY); });

  it("copies every row across once, preserves ids, fills new settings, leaves the old DB intact", async () => {
    const old = new Dexie(LEGACY);
    old.version(1).stores({ semesters: "++id, term, year, isCurrent", courses: "++id, code, semesterId, gpaCounting, isRetake", routineItems: "++id, category, order", tasks: "++id, courseId, status, deadline", studySessions: "++id, courseId, startedAt", settings: "++id" });
    old.version(2).stores({ exams: "++id, courseId, date", activeTimer: "id" });
    await old.open();
    await old.table("semesters").add({ id: 7, term: "Fall", year: 2026, label: "Fall 2026", isCurrent: true, registeredCredits: 9 });
    await old.table("courses").add({ id: 42, code: "CSE115", title: "PL", credits: 3, semesterId: 7, schedule: [], gpaCounting: true, degreeCredit: true, isRetake: false, grade: "", status: "In Progress", faculty: "", section: "" });
    await old.table("settings").add({ userName: "Legacy User", officialCGPA: 2.9, officialCompletedCredits: 22, degreeCredits: 130, gradeScale: { A: 4 }, attendanceThreshold: 70, retakeReplacesOldGrade: true, retakeCreditCountsOnce: true, theme: "dark", reducedMotion: false, dailyStudyGoalMinutes: 240, semesterNumber: 4, remindStudyGoal: false, remindUpcomingClass: false, remindDeadlines: false, remindExams: false });
    await old.table("studySessions").add({ mode: "Custom", plannedMinutes: 30, actualMinutes: 30, startedAt: new Date().toISOString(), completed: true });
    old.close();

    await runDataMigrations();
    expect((await db.courses.get(42))?.code).toBe("CSE115");
    expect((await db.semesters.get(7))?.isCurrent).toBe(true);
    expect(await db.studySessions.count()).toBe(1);
    const s = (await db.settings.toCollection().first())!;
    expect(s.userName).toBe("Legacy User");
    expect(s.officialCGPA).toBe(2.9);
    expect(s.dashboardLayout?.order.length).toBeGreaterThan(5);
    expect(await Dexie.exists(LEGACY)).toBe(true); // never modified or deleted

    await runDataMigrations();                 // running again must not duplicate anything
    expect(await db.courses.count()).toBe(1);
    expect(await db.settings.count()).toBe(1);
  });
});

describe("actions", () => {
  it("attendance keeps one record per course per day", async () => {
    const { c1 } = await seedRich();
    await setAttendance(c1, "2026-01-05", "Absent");
    await setAttendance(c1, "2026-01-05", "Present");
    const rows = await db.attendance.where({ courseId: c1, date: "2026-01-05" }).toArray();
    expect(rows).toHaveLength(1); expect(rows[0].status).toBe("Present");
  });

  it("deleting a course cascades correctly and keeps the student's own work", async () => {
    const { c1 } = await seedRich();
    const tasksBefore = await db.tasks.count(), notesBefore = await db.notes.count(), sessBefore = await db.studySessions.count();
    await deleteCourseCascade(c1);
    expect(await db.courses.get(c1)).toBeUndefined();
    expect(await db.exams.where("courseId").equals(c1).count()).toBe(0);
    expect(await db.attendance.where("courseId").equals(c1).count()).toBe(0);
    expect(await db.tasks.count()).toBe(tasksBefore);       // kept, detached
    expect(await db.notes.count()).toBe(notesBefore);
    expect(await db.studySessions.count()).toBe(sessBefore);
    expect((await db.tasks.toArray()).some((t) => t.courseId === c1)).toBe(false);
  });

  it("setCurrentSemester leaves exactly one current semester", async () => {
    const { prevId } = await seedRich();
    await setCurrentSemester(prevId);
    const cur = (await db.semesters.toArray()).filter((s) => s.isCurrent);
    expect(cur.map((s) => s.id)).toEqual([prevId]);
  });
});

describe("backup & restore", () => {
  it("round-trips a full database and is byte-for-byte equivalent afterwards", async () => {
    await seedRich();
    const file = await exportBackupObject();
    const parsed = JSON.parse(JSON.stringify(file));
    const check = validateBackup(parsed);
    expect(check.ok).toBe(true);
    const before = { courses: await db.courses.toArray(), notes: await db.notes.toArray(), sessions: await db.studySessions.toArray(), att: await db.attendance.toArray() };
    await db.courses.clear(); await db.notes.clear(); await db.tasks.clear();
    await restoreBackup(check);
    expect(await db.courses.toArray()).toEqual(before.courses);
    expect(await db.notes.toArray()).toEqual(before.notes);
    expect(await db.studySessions.toArray()).toEqual(before.sessions);
    expect(await db.attendance.toArray()).toEqual(before.att);
    expect(await db.settings.count()).toBe(1);
  });

  it("a failed restore rolls back and leaves existing data untouched", async () => {
    await seedRich();
    const coursesBefore = await db.courses.toArray();
    const bad = validateBackup({ format: "studyos-backup", version: 2, data: {
      semesters: [{ id: 1, label: "A", term: "Fall", year: 2026 }],
      courses: [{ id: 5, code: "X", semesterId: 1, credits: 3 }, { id: 5, code: "Y", semesterId: 1, credits: 3 }], // duplicate primary key
    } });
    expect(bad.ok).toBe(true);                 // shape is fine…
    await expect(restoreBackup(bad)).rejects.toBeTruthy(); // …but the write fails
    expect(await db.courses.toArray()).toEqual(coursesBefore);
    expect(await db.notes.count()).toBe(1);
  });

  it("restores a legacy (pre-2.0) backup and backfills settings", async () => {
    await resetDb();
    const check = validateBackup({ exportedAt: "2026-01-01T00:00:00Z",
      semesters: [{ id: 1, label: "Fall 2025", term: "Fall", year: 2025, isCurrent: true, registeredCredits: 9 }],
      courses: [{ id: 1, code: "CSE115", semesterId: 1, credits: 3, schedule: [] }],
      settings: [{ id: 1, userName: "Old", gradeScale: { A: 4 }, attendanceThreshold: 70, officialCGPA: 3, officialCompletedCredits: 10, degreeCredits: 130 }] });
    expect(check.ok).toBe(true); expect(check.legacy).toBe(true);
    await restoreBackup(check);
    const s = (await db.settings.toCollection().first())!;
    expect(s.userName).toBe("Old"); expect(s.dashboardLayout).toBeTruthy(); expect(await db.notes.count()).toBe(0);
  });
});

describe("reset", () => {
  it("deleteAllData removes the current and previous databases and app localStorage", async () => {
    await seedRich();
    const old = new Dexie(LEGACY); old.version(1).stores({ settings: "++id" }); await old.open(); await old.table("settings").add({ a: 1 }); old.close();
    localStorage.setItem("studyos:theme", "dark"); localStorage.setItem("other", "keep");
    await deleteAllData();
    expect(await Dexie.exists("studyos-db")).toBe(false);
    expect(await Dexie.exists(LEGACY)).toBe(false);
    expect(localStorage.getItem("studyos:theme")).toBeNull();
    expect(localStorage.getItem("other")).toBe("keep");
    await db.open(); // leave a usable db for later files
  });
});
