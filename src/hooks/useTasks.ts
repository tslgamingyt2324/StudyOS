"use client";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { Task } from "@/types";
import { isOverdue } from "@/lib/utils";
import { daysBetween, dueInstant } from "@/lib/dates";

export type TaskFilter = "all" | "today" | "upcoming" | "overdue" | "completed";

export function taskMatches(t: Task, filter: TaskFilter, now = new Date()): boolean {
  switch (filter) {
    case "completed": return t.status === "Completed";
    case "overdue": return isOverdue(t, now);
    case "today": return t.status !== "Completed" && !!t.deadline && daysBetween(now, dueInstant(t.deadline)) === 0 && !isOverdue(t, now);
    case "upcoming": return t.status !== "Completed" && !isOverdue(t, now);
    default: return true;
  }
}

export function useTasks() {
  const tasks = useLiveQuery(() => db.tasks.toArray());
  return useMemo(() => {
    const all = tasks ?? [];
    return {
      loading: tasks === undefined,
      tasks: all,
      open: all.filter((t) => t.status !== "Completed"),
      overdue: all.filter((t) => isOverdue(t)),
    };
  }, [tasks]);
}
