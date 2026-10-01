"use client";
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/db/db";
import { useSettings } from "@/hooks/useSettings";
import { useCourses } from "@/hooks/useCourses";
import { useTasks } from "@/hooks/useTasks";
import { useExams } from "@/hooks/useExams";
import { useStudyStats } from "@/hooks/useStudy";
import { buildReminders } from "@/lib/alerts";
import { deliverReminder, readLedger, recordFired } from "@/lib/notifications";
import { ACHIEVEMENTS, completedGoalCount } from "@/lib/achievements";
import { useToast } from "@/components/shell/Toast";
import { useLiveQuery } from "dexie-react-hooks";

/**
 * Evaluates reminder rules and delivers the ones that are due.
 *
 * Triggers (all funnel into the same `check`, which is idempotent):
 *  - one timer aligned to the top of each minute (no setInterval drift, no second timer)
 *  - app resume: visibilitychange, focus, pageshow
 *  - service worker becoming ready
 *  - data becoming available after launch
 * Because rules only report a reminder while it is still relevant (e.g. a class that has not
 * started yet), catching up on resume can never produce a stale "starts in 15 minutes".
 * A reminder is recorded as fired only AFTER it was actually delivered, so a failed or
 * hidden-page delivery is retried instead of being silently lost.
 * (Web apps cannot wake a fully closed app — see lib/notifications.ts.)
 */
export function ReminderEngine() {
  const { settings } = useSettings();
  const { currentCourses } = useCourses();
  const { tasks } = useTasks();
  const { exams } = useExams();
  const stats = useStudyStats(settings?.dailyStudyGoalMinutes ?? 0);
  const { toast } = useToast();
  // Don't evaluate the study-goal rule before today's sessions have loaded (0 minutes would be wrong).
  const ready = !!settings && !stats.loading;
  const latest = useRef({ ready, settings, currentCourses, tasks, exams, todayMinutes: stats.todayMinutes });
  latest.current = { ready, settings, currentCourses, tasks, exams, todayMinutes: stats.todayMinutes };
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const inflight = useRef(new Set<string>());

  const check = useCallback(async () => {
    const { ready: ok, settings: s, currentCourses: c, tasks: t, exams: e, todayMinutes } = latest.current;
    if (!ok || !s) return;
    const due = buildReminders({ now: new Date(), settings: s, courses: c, tasks: t, exams: e, todayStudyMinutes: todayMinutes });
    if (due.length === 0) return;
    const deliverAll = async () => {
      const fired = readLedger(); // re-read inside the lock so other tabs' deliveries are seen
      for (const r of due) {
        if (fired[r.id] || inflight.current.has(r.id)) continue;
        inflight.current.add(r.id);
        try {
          const result = await deliverReminder(r, {
            visible: document.visibilityState === "visible",
            toast: (x) => toastRef.current({ kind: "reminder", title: x.title, body: x.body, href: x.href }),
          });
          if (result !== "deferred") recordFired(r.id);
        } finally {
          inflight.current.delete(r.id);
        }
      }
    };
    try {
      if (typeof navigator !== "undefined" && navigator.locks) await navigator.locks.request("studyos-reminders", deliverAll);
      else await deliverAll();
    } catch { /* a failed check is simply retried on the next trigger */ }
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    let disposed = false;
    const run = () => { if (!disposed) void check(); };
    const schedule = () => {
      timer = window.setTimeout(() => { run(); schedule(); }, 60_000 - (Date.now() % 60_000) + 250);
    };
    const onResume = () => { if (document.visibilityState !== "hidden") run(); };

    const first = window.setTimeout(run, 1500);
    schedule();
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    navigator.serviceWorker?.ready.then(run).catch(() => {});
    return () => {
      disposed = true;
      window.clearTimeout(first);
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, [check]);

  // First evaluation as soon as data is available (instead of waiting for the next minute).
  useEffect(() => { if (ready) void check(); }, [ready, check]);
  return null;
}

/** Notification taps: the service worker asks an already-open window to navigate inside the app. */
export function NotificationNavigator() {
  const router = useRouter();
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; href?: string } | null;
      if (d?.type === "studyos:navigate" && typeof d.href === "string" && d.href.startsWith("/")) router.push(d.href);
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, [router]);
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
