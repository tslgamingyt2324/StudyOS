"use client";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { buildEvents, UnifiedEvent } from "@/lib/calendar";
import { useCourses } from "@/hooks/useCourses";

/** Unified events (classes, exams, deadlines, routine, study, custom) for a date range. */
export function useCalendar(from: Date, to: Date) {
  const { courses, currentCourses, loading: cl } = useCourses();
  const exams = useLiveQuery(() => db.exams.toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const routine = useLiveQuery(() => db.routineItems.toArray());
  const sessions = useLiveQuery(() => db.studySessions.toArray());
  const events = useLiveQuery(() => db.calendarEvents.toArray());
  const fromMs = from.getTime(), toMs = to.getTime();

  return useMemo(() => {
    const loading = cl || !exams || !tasks || !routine || !sessions || !events;
    const list: UnifiedEvent[] = loading
      ? []
      : buildEvents({
          from: new Date(fromMs), to: new Date(toMs), courses: currentCourses, allCourses: courses,
          exams: exams!, tasks: tasks!, routine: routine!, sessions: sessions!, events: events!,
        });
    return { loading, events: list };
  }, [cl, exams, tasks, routine, sessions, events, currentCourses, courses, fromMs, toMs]);
}
