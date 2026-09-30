"use client";
import { useEffect, useRef } from "react";
import { db } from "@/db/db";
import { useSettings } from "@/hooks/useSettings";
import { useCourses } from "@/hooks/useCourses";
import { useTasks } from "@/hooks/useTasks";
import { useExams } from "@/hooks/useExams";
import { useStudyStats } from "@/hooks/useStudy";
import { buildReminders, Reminder } from "@/lib/alerts";
import { ACHIEVEMENTS, completedGoalCount } from "@/lib/achievements";
import { dateKey } from "@/lib/dates";
import { useToast } from "@/components/shell/Toast";
import { useLiveQuery } from "dexie-react-hooks";

const STORE = "studyos:fired-reminders";

function loadFired(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as { day: string; ids: string[] } | null;
    if (raw && raw.day === dateKey()) return new Set(raw.ids);
  } catch { /* corrupted value — start fresh */ }
  return new Set();
}
function saveFired(ids: Set<string>) {
  try { localStorage.setItem(STORE, JSON.stringify({ day: dateKey(), ids: [...ids] })); } catch { /* storage full/blocked */ }
}

export async function showSystemNotification(r: Pick<Reminder, "title" | "body" | "id">): Promise<boolean> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(r.title, { body: r.body, tag: r.id, icon: "/icon-192.png" });
    else new Notification(r.title, { body: r.body, tag: r.id, icon: "/icon-192.png" });
    return true;
  } catch { return false; }
}

/**
 * Evaluates reminder rules once a minute while the app is open. Each reminder
 * has a stable id and fires at most once per day. Reminders are delivered as a
 * system notification when permission was granted, otherwise as an in-app toast.
 * (Web apps cannot schedule notifications for when they are closed.)
 */
export function ReminderEngine() {
  const { settings } = useSettings();
  const { currentCourses } = useCourses();
  const { tasks } = useTasks();
  const { exams } = useExams();
  const stats = useStudyStats(settings?.dailyStudyGoalMinutes ?? 0);
  const { toast } = useToast();
  const latest = useRef({ settings, currentCourses, tasks, exams, todayMinutes: stats.todayMinutes });
  latest.current = { settings, currentCourses, tasks, exams, todayMinutes: stats.todayMinutes };

  useEffect(() => {
    const tick = async () => {
      const { settings: s, currentCourses: c, tasks: t, exams: e, todayMinutes } = latest.current;
      if (!s) return;
      const due = buildReminders({ now: new Date(), settings: s, courses: c, tasks: t, exams: e, todayStudyMinutes: todayMinutes });
      if (due.length === 0) return;
      const fired = loadFired();
      for (const r of due) {
        if (fired.has(r.id)) continue;
        fired.add(r.id);
        saveFired(fired);
        if (!(await showSystemNotification(r))) toast({ kind: "reminder", title: r.title, body: r.body, href: r.href });
      }
    };
    const first = window.setTimeout(tick, 4000);
    const id = window.setInterval(tick, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [toast]);
  return null;
}

/** Unlocks achievements from real data. The very first pass backfills silently. */
export function AchievementWatcher() {
  const { settings } = useSettings();
  const stats = useStudyStats(settings?.dailyStudyGoalMinutes ?? 0);
  const goals = useLiveQuery(() => db.goals.toArray());
  const exams = useLiveQuery(() => db.exams.toArray());
  const unlocked = useLiveQuery(() => db.achievements.toArray());
  const { toast } = useToast();
  const busy = useRef(false);

  useEffect(() => {
    if (!settings || stats.loading || !goals || !exams || !unlocked || busy.current) return;
    const ctx = {
      totalMinutes: stats.summary.totalMinutes, sessionCount: stats.summary.sessionCount,
      bestStreak: stats.summary.bestStreak, completedGoals: completedGoalCount(goals), exams,
    };
    const have = new Set(unlocked.map((u) => u.key));
    const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.key) && a.test(ctx));
    if (fresh.length === 0) return;
    busy.current = true;
    const silent = unlocked.length === 0 && fresh.length > 1; // first run for an existing user
    db.achievements
      .bulkPut(fresh.map((a) => ({ key: a.key, unlockedAt: new Date().toISOString() })))
      .then(() => { if (!silent) fresh.forEach((a) => toast({ kind: "achievement", title: a.title, body: a.description, href: "/study/goals" })); })
      .finally(() => { busy.current = false; });
  }, [settings, stats, goals, exams, unlocked, toast]);
  return null;
}
