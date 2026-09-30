import { db, defaultSettings, runDataMigrations } from "@/db/db";
import { dateKey, addDays } from "@/lib/dates";

export async function resetDb() {
  db.close();
  await db.delete();
  await db.open();
}

/** A realistic populated database for smoke tests. */
export async function seedRich() {
  await resetDb();
  await runDataMigrations();
  const s = (await db.settings.toCollection().first())!;
  await db.settings.update(s.id!, { userName: "Ada Lovelace", officialCGPA: 3.1, officialCompletedCredits: 40, degreeCredits: 130, targetCGPA: 3.5, remindExams: true, remindDeadlines: true, remindUpcomingClass: true, remindStudyGoal: true });
  const semId = (await db.semesters.add({ term: "Fall", year: 2026, label: "Fall 2026", isCurrent: true, registeredCredits: 9 })) as number;
  const prevId = (await db.semesters.add({ term: "Summer", year: 2026, label: "Summer 2026", isCurrent: false, registeredCredits: 6 })) as number;
  await db.settings.update(s.id!, { currentSemesterId: semId });
  const today = new Date();
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][today.getDay()];
  const base = { faculty: "Dr X", section: "1", gpaCounting: true, degreeCredit: true, isRetake: false, grade: "" as const, status: "In Progress" as const };
  const c1 = (await db.courses.add({ ...base, code: "CSE115", title: "Programming Language", credits: 3, semesterId: semId, room: "LIB609", schedule: [{ days: [dayName], startTime: "23:00", endTime: "23:50" }], targetGrade: "A", attendanceBaseline: { present: 10, absent: 2, excused: 0 } })) as number;
  const c2 = (await db.courses.add({ ...base, code: "SOC101", title: "Intro Sociology", credits: 3, semesterId: semId, schedule: [{ days: ["Monday", "Wednesday"], startTime: "09:00", endTime: "10:30" }] })) as number;
  const old = (await db.courses.add({ ...base, code: "ENG102", title: "Composition", credits: 3, semesterId: prevId, grade: "C", status: "Completed", schedule: [] })) as number;
  await db.courses.add({ ...base, code: "ENG102", title: "Composition", credits: 3, semesterId: semId, isRetake: true, originalCourseId: old, schedule: [] });
  await db.tasks.bulkAdd([
    { title: "Problem set 3", category: "Assignment", priority: "High", status: "Not started", courseId: c1, deadline: dateKey(addDays(today, 1)) + "T23:00", createdAt: new Date().toISOString(), tags: ["lab"] },
    { title: "Late essay", category: "Task", priority: "Low", status: "Not started", courseId: c2, deadline: dateKey(addDays(today, -2)) + "T10:00", createdAt: new Date().toISOString() },
    { title: "Done thing", category: "Task", priority: "Low", status: "Completed", courseId: c2, completedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  ]);
  await db.exams.add({ courseId: c1, title: "Midterm", examType: "Midterm", date: dateKey(addDays(today, 3)), time: "10:00", preparationPct: 30, location: "Hall 2" });
  const sess = [];
  for (let i = 0; i < 12; i++) {
    const d = addDays(today, -i); d.setHours(19, 30, 0, 0);
    sess.push({ courseId: i % 3 ? c1 : c2, mode: "Custom" as const, plannedMinutes: 45, actualMinutes: 45 + i, startedAt: d.toISOString(), completed: true, studyType: "Revision" as const });
  }
  await db.studySessions.bulkAdd(sess);
  await db.notes.add({ title: "Pointers", body: "# Pointers\n- a\n- [x] b", courseId: c1, tags: ["exam"], pinned: true, archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await db.goals.bulkAdd([
    { title: "Study 120 hours", type: "Study", metric: "study_hours", target: 120, startDate: dateKey(addDays(today, -10)), deadline: dateKey(addDays(today, 20)), status: "Active", createdAt: new Date().toISOString() },
    { title: "CGPA 3.5", type: "Academic", metric: "cgpa", target: 3.5, startValue: 3.0, startDate: dateKey(today), status: "Active", createdAt: new Date().toISOString() },
    { title: "Read books", type: "Personal", metric: "manual", target: 5, manualCurrent: 2, unit: "books", startDate: dateKey(today), status: "Active", createdAt: new Date().toISOString() },
  ]);
  await db.attendance.bulkAdd([{ courseId: c1, date: dateKey(today), status: "Present" }, { courseId: c2, date: dateKey(addDays(today, -1)), status: "Absent" }]);
  await db.calendarEvents.add({ title: "Study group", kind: "Study", date: dateKey(today), startTime: "16:00", endTime: "17:00", allDay: false });
  await db.plannedCourses.bulkAdd([{ term: "Spring", year: 2027, code: "CSE215", title: "Data Structures", credits: 3 }, { term: "Spring", year: 2027, code: "MAT125", title: "Linear Algebra", credits: 3 }]);
  await db.routineItems.add({ title: "Gym", category: "Exercise", startTime: "06:00", endTime: "07:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], priority: "Medium", completed: false, completedDates: [], order: 0 });
  return { semId, prevId, c1, c2 };
}
export { defaultSettings };
