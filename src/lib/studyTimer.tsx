"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { StudySession, StudyType, ActiveTimer } from "@/types";

interface StartArgs {
  courseId?: number;
  taskLabel?: string;
  studyType?: StudyType;
  mode: StudySession["mode"];
  plannedMinutes: number;
  isQuickStudy?: boolean;
}

/** Shown on the "Session complete" screen right after a timer is stopped. */
export interface SessionCompletion {
  sessionId: number;
  minutes: number;
  courseId?: number;
  studyType?: StudyType;
  taskLabel?: string;
  isQuickStudy?: boolean;
  mode: StudySession["mode"];
}

interface StudyTimerContextValue {
  active: ActiveTimer | undefined;
  /** Set for as long as the completion screen should be showing. */
  completion: SessionCompletion | null;
  dismissCompletion: () => void;
  saveFeedback: (feedback: { rating?: StudySession["rating"]; accomplished?: string }) => Promise<void>;
  /** Restart the clock from zero, keeping course / activity / mode. */
  reset: () => Promise<void>;
  elapsedSeconds: number;
  remainingSeconds: number; // negative once overtime
  isOvertime: boolean;
  start: (args: StartArgs) => Promise<void>;
  /** One-tap "Start Quick Study": no course, no study type, no notes, no
   *  planned duration — just an open-ended stopwatch that still counts
   *  toward the daily goal / streak like any other session. */
  startQuick: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
  discard: () => Promise<void>;
}

const StudyTimerContext = createContext<StudyTimerContextValue | null>(null);

export function StudyTimerProvider({ children }: { children: React.ReactNode }) {
  const active = useLiveQuery(() => db.activeTimer.get(1));
  const [, setTick] = useState(0);
  const [completion, setCompletion] = useState<SessionCompletion | null>(null);

  // Re-render once a second so the displayed time stays live, without
  // storing elapsed time itself in state — it's always derived from
  // real timestamps, so it stays accurate even after backgrounding.
  useEffect(() => {
    if (!active || active.status !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    // Repaint immediately when the phone/app resumes instead of waiting for the next tick.
    const onResume = () => { if (document.visibilityState !== "hidden") setTick((t) => t + 1); };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, [active?.status, active?.startedAt]);

  const now = Date.now();
  const elapsedMs = active
    ? (active.status === "paused" && active.pausedAt ? new Date(active.pausedAt).getTime() : now)
      - new Date(active.startedAt).getTime()
      - active.accumulatedPauseMs
    : 0;
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const targetSeconds = (active?.plannedMinutes ?? 0) * 60;
  const remainingSeconds = targetSeconds - elapsedSeconds;

  const start = async ({ courseId, taskLabel, studyType, mode, plannedMinutes, isQuickStudy }: StartArgs) => {
    const startedAt = new Date().toISOString();
    const sessionId = await db.studySessions.add({
      courseId, taskLabel, studyType, mode, plannedMinutes, actualMinutes: 0, startedAt, completed: false,
      isQuickStudy,
    });
    await db.activeTimer.put({
      id: 1, sessionId, courseId, taskLabel, studyType, mode, plannedMinutes,
      startedAt, status: "running", accumulatedPauseMs: 0, isQuickStudy,
    });
  };

  // No course, no study type, no notes, no planned duration — starts the
  // instant it's called so there is nothing standing between "I want to
  // study now" and the timer actually running.
  const startQuick = async () => {
    await start({ mode: "Quick", plannedMinutes: 0, isQuickStudy: true });
  };

  const pause = async () => {
    if (!active || active.status !== "running") return;
    await db.activeTimer.update(1, { status: "paused", pausedAt: new Date().toISOString() });
  };

  const resume = async () => {
    if (!active || active.status !== "paused" || !active.pausedAt) return;
    const pausedMs = Date.now() - new Date(active.pausedAt).getTime();
    await db.activeTimer.update(1, {
      status: "running", pausedAt: undefined, accumulatedPauseMs: active.accumulatedPauseMs + pausedMs,
    });
  };

  // The session is written to the database FIRST; the completion screen is a
  // purely optional layer on top, so closing the tab at that point loses nothing.
  const finish = async () => {
    if (!active) return;
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    await db.transaction("rw", db.studySessions, db.activeTimer, async () => {
      await db.studySessions.update(active.sessionId, {
        actualMinutes: minutes, endedAt: new Date().toISOString(), completed: true,
      });
      await db.activeTimer.delete(1);
    });
    setCompletion({
      sessionId: active.sessionId, minutes, courseId: active.courseId, studyType: active.studyType,
      taskLabel: active.taskLabel, isQuickStudy: active.isQuickStudy, mode: active.mode,
    });
  };

  const reset = async () => {
    if (!active) return;
    const startedAt = new Date().toISOString();
    await db.transaction("rw", db.studySessions, db.activeTimer, async () => {
      await db.studySessions.update(active.sessionId, { startedAt });
      await db.activeTimer.update(1, { startedAt, status: "running", pausedAt: undefined, accumulatedPauseMs: 0 });
    });
  };

  const saveFeedback = async (fb: { rating?: StudySession["rating"]; accomplished?: string }) => {
    if (!completion) return;
    const patch: Partial<StudySession> = {};
    if (fb.rating) patch.rating = fb.rating;
    if (fb.accomplished?.trim()) patch.accomplished = fb.accomplished.trim();
    if (Object.keys(patch).length) await db.studySessions.update(completion.sessionId, patch);
  };

  const discard = async () => {
    if (!active) return;
    await db.studySessions.delete(active.sessionId);
    await db.activeTimer.delete(1);
  };

  return (
    <StudyTimerContext.Provider
      value={{
        active, completion, dismissCompletion: () => setCompletion(null), saveFeedback, reset,
        elapsedSeconds, remainingSeconds, isOvertime: remainingSeconds < 0,
        start, startQuick, pause, resume, finish, discard,
      }}
    >
      {children}
    </StudyTimerContext.Provider>
  );
}

export function useStudyTimer() {
  const ctx = useContext(StudyTimerContext);
  if (!ctx) throw new Error("useStudyTimer must be used within StudyTimerProvider");
  return ctx;
}
