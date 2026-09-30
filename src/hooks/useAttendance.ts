"use client";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { Course } from "@/types";
import { AttendanceStats, computeAttendance } from "@/lib/attendance";

export function useAttendance(courses: Course[], defaultThreshold: number) {
  const records = useLiveQuery(() => db.attendance.toArray());
  return useMemo(() => {
    const all = records ?? [];
    const stats = new Map<number, AttendanceStats>();
    for (const c of courses) {
      stats.set(c.id!, computeAttendance(c, all.filter((r) => r.courseId === c.id), defaultThreshold));
    }
    return { loading: records === undefined, records: all, stats };
  }, [records, courses, defaultThreshold]);
}
