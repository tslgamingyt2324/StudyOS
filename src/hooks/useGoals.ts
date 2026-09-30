"use client";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { AppSettings, Course, Goal, StudySession, Task } from "@/types";
import { computeGoalProgress, GoalProgress, isBehindSchedule } from "@/lib/goals";
import { AttendanceStats } from "@/lib/attendance";

export interface GoalWithProgress { goal: Goal; progress: GoalProgress; behind: boolean }

export function useGoals(input: {
  settings?: AppSettings; courses: Course[]; sessions: StudySession[]; tasks: Task[];
  attendance: Map<number, AttendanceStats>;
}) {
  const goals = useLiveQuery(() => db.goals.toArray());
  return useMemo(() => {
    const rows: GoalWithProgress[] = [];
    if (goals && input.settings) {
      const attendanceByCourse = new Map<number, number | null>();
      input.attendance.forEach((v, k) => attendanceByCourse.set(k, v.percentage));
      for (const goal of goals) {
        const progress = computeGoalProgress(goal, {
          cgpa: input.settings.officialCGPA, courses: input.courses, sessions: input.sessions,
          tasks: input.tasks, gradeScale: input.settings.gradeScale, attendanceByCourse,
        });
        rows.push({ goal, progress, behind: isBehindSchedule(goal, progress) });
      }
    }
    return {
      loading: goals === undefined,
      goals: rows,
      active: rows.filter((r) => r.goal.status === "Active"),
    };
  }, [goals, input.settings, input.courses, input.sessions, input.tasks, input.attendance]);
}
