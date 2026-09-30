"use client";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { dateKey } from "@/lib/dates";
import { completed, computeStreaks, minutesByDay, summarize, sumMinutes, sessionsBetween } from "@/lib/stats";
import { addDays, startOfWeek } from "@/lib/dates";

export function useStudySessions() {
  const sessions = useLiveQuery(() => db.studySessions.toArray());
  return useMemo(() => ({
    loading: sessions === undefined,
    sessions: sessions ?? [],
    completed: completed(sessions ?? []),
  }), [sessions]);
}

/** Derived numbers used by the dashboard, goals and reminders. */
export function useStudyStats(dailyGoalMinutes: number, weekStartsOn = 0) {
  const { sessions, loading } = useStudySessions();
  return useMemo(() => {
    const now = new Date();
    const byDay = minutesByDay(sessions);
    const todayKey = dateKey(now);
    const weekStart = dateKey(startOfWeek(now, weekStartsOn));
    const summary = summarize(sessions, dailyGoalMinutes, now);
    return {
      loading,
      sessions,
      byDay,
      summary,
      todayMinutes: byDay.get(todayKey) ?? 0,
      weekMinutes: sumMinutes(sessionsBetween(sessions, weekStart, dateKey(addDays(now, 0)))),
      streak: computeStreaks(byDay, now),
    };
  }, [sessions, loading, dailyGoalMinutes, weekStartsOn]);
}
