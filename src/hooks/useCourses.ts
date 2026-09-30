"use client";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";

/** Courses + semesters, with the current semester's courses pre-filtered. */
export function useCourses() {
  const courses = useLiveQuery(() => db.courses.toArray());
  const semesters = useLiveQuery(() => db.semesters.toArray());
  return useMemo(() => {
    const all = courses ?? [];
    const sems = semesters ?? [];
    const current = sems.find((s) => s.isCurrent);
    return {
      loading: courses === undefined || semesters === undefined,
      courses: all,
      semesters: sems,
      currentSemester: current,
      currentCourses: all.filter((c) => c.semesterId === current?.id),
      byId: (id?: number) => all.find((c) => c.id === id),
      semesterLabel: (id?: number) => sems.find((s) => s.id === id)?.label ?? "—",
    };
  }, [courses, semesters]);
}
