import { db } from "@/db/db";
import { AttendanceStatus, Task } from "@/types";

/**
 * Deletes a course and tidies everything that pointed at it:
 *  - attendance + exams belong to the course, so they go with it;
 *  - tasks, notes and study sessions are kept (your work isn't lost) but detached;
 *  - goals tied to the course are removed (they can no longer be measured);
 *  - a retake that referenced it as its original loses that link.
 */
export async function deleteCourseCascade(courseId: number): Promise<void> {
  await db.transaction(
    "rw",
    [db.courses, db.attendance, db.exams, db.tasks, db.notes, db.studySessions, db.goals, db.calendarEvents, db.activeTimer],
    async () => {
      await db.attendance.where("courseId").equals(courseId).delete();
      await db.exams.where("courseId").equals(courseId).delete();
      await db.goals.where("courseId").equals(courseId).delete();
      await db.tasks.where("courseId").equals(courseId).modify({ courseId: undefined });
      await db.notes.where("courseId").equals(courseId).modify({ courseId: undefined });
      await db.studySessions.where("courseId").equals(courseId).modify({ courseId: undefined });
      await db.calendarEvents.where("courseId").equals(courseId).modify({ courseId: undefined });
      await db.courses.where("originalCourseId").equals(courseId).modify({ originalCourseId: undefined }).catch(() => undefined);
      const active = await db.activeTimer.get(1);
      if (active?.courseId === courseId) await db.activeTimer.update(1, { courseId: undefined });
      await db.courses.delete(courseId);
    }
  );
}

/** One record per course per day: logging again replaces the earlier entry. */
export async function setAttendance(courseId: number, date: string, status: AttendanceStatus, note?: string): Promise<void> {
  await db.transaction("rw", db.attendance, async () => {
    const existing = await db.attendance.where("[courseId+date]").equals([courseId, date]).first();
    if (existing?.id !== undefined) await db.attendance.update(existing.id, { status, note });
    else await db.attendance.add({ courseId, date, status, note });
  });
}

export async function clearAttendance(courseId: number, date: string): Promise<void> {
  await db.attendance.where("[courseId+date]").equals([courseId, date]).delete();
}

export async function toggleTaskDone(t: Task): Promise<void> {
  const done = t.status === "Completed";
  await db.tasks.update(t.id!, {
    status: done ? "Not started" : "Completed",
    completedAt: done ? undefined : new Date().toISOString(),
  });
}

/** Makes `semesterId` the only current semester and points settings at it. */
export async function setCurrentSemester(semesterId: number): Promise<void> {
  await db.transaction("rw", db.semesters, db.settings, async () => {
    for (const s of await db.semesters.toArray()) {
      const should = s.id === semesterId;
      if (s.isCurrent !== should) await db.semesters.update(s.id!, { isCurrent: should });
    }
    const st = await db.settings.toCollection().first();
    if (st?.id) await db.settings.update(st.id, { currentSemesterId: semesterId });
  });
}
