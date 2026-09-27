"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Check, Plus, Zap } from "lucide-react";
import { db } from "@/db/db";
import { StudySession, StudyType } from "@/types";
import { cn } from "@/lib/utils";
import { useStudyTimer } from "@/lib/studyTimer";
import SubTabs from "@/components/SubTabs";

const MODES: Record<Exclude<StudySession["mode"], "Quick">, number> = { "Pomodoro": 25, "25/5": 25, "50/10": 50, "Custom": 30 };
const STUDY_TYPES: StudyType[] = ["Lecture Review", "Assignment", "Problem Solving", "Exam Preparation", "Reading", "Lab Preparation", "Revision", "Other"];

export default function StudyTimerPage() {
  // Course Study must only ever offer THIS semester's courses — historical
  // courses (past semesters) stay visible in Academic History, but never
  // show up as something you can "start studying" today (PART 29/38).
  const allCourses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const semesters = useLiveQuery(() => db.semesters.toArray()) ?? [];
  const currentSemester = semesters.find((s) => s.isCurrent);
  const courses = allCourses.filter((c) => c.semesterId === currentSemester?.id);

  const recentSessions = useLiveQuery(() => db.studySessions.orderBy("startedAt").reverse().limit(5).toArray()) ?? [];
  const { active, elapsedSeconds, remainingSeconds, isOvertime, start, startQuick, pause, resume, finish, discard } = useStudyTimer();

  const [mode, setMode] = useState<Exclude<StudySession["mode"], "Quick">>("Pomodoro");
  const [customMinutes, setCustomMinutes] = useState(30);
  const [courseId, setCourseId] = useState<number | undefined>(courses[0]?.id);
  const [taskLabel, setTaskLabel] = useState("");
  const [studyType, setStudyType] = useState<StudyType>("Lecture Review");
  const [showLog, setShowLog] = useState(false);

  // `courses` loads asynchronously (useLiveQuery starts undefined), so the
  // useState initializer above can't pick a default course — do it here
  // once the current-semester list actually arrives, and re-pick if the
  // previously selected course is no longer in the current semester.
  useEffect(() => {
    if (courses.length === 0) { if (courseId !== undefined) setCourseId(undefined); return; }
    if (!courseId || !courses.some((c) => c.id === courseId)) setCourseId(courses[0].id);
  }, [courses, courseId]);

  const plannedMinutes = mode === "Custom" ? customMinutes : MODES[mode];
  const running = active?.status === "running";
  const isQuickActive = active?.mode === "Quick";

  // Quick Study is an open-ended stopwatch (no planned duration to count
  // down from), so it always just counts elapsed time up, never "overtime".
  const displaySeconds = isQuickActive ? elapsedSeconds : Math.abs(remainingSeconds);
  const mm = Math.floor(displaySeconds / 60).toString().padStart(2, "0");
  const ss = (displaySeconds % 60).toString().padStart(2, "0");
  const progress = active && !isQuickActive ? Math.min(1, elapsedSeconds / (active.plannedMinutes * 60)) : 0;
  const circumference = 2 * Math.PI * 90;

  return (
    <div className="px-4 pt-4 space-y-6">
      <h1 className="text-2xl font-bold">Study</h1>
      <SubTabs tabs={[
        { href: "/study/timer", label: "Timer" },
        { href: "/study/records", label: "Daily Records" },
        { href: "/study/analytics", label: "Analytics" },
      ]} />

      {!active && (
        <>
          <h2 className="text-sm font-semibold text-ink-muted">COURSE STUDY</h2>
          <div className="flex justify-center gap-2">
            {(Object.keys(MODES) as Exclude<StudySession["mode"], "Quick">[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", mode === m ? "bg-accent text-white" : "bg-surface-sunken/60 text-ink-muted")}>{m}</button>
            ))}
          </div>
          {mode === "Custom" && (
            <input type="number" value={customMinutes} onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 1)} className="mx-auto block w-24 rounded-lg border border-border bg-surface-sunken/50 px-3 py-2 text-center" />
          )}
        </>
      )}

      <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="var(--surface-sunken)" strokeWidth="10" />
          <motion.circle
            cx="100" cy="100" r="90" fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference}
            animate={
              isQuickActive
                ? { strokeDashoffset: 0, opacity: running ? [0.35, 1, 0.35] : 0.6 }
                : { strokeDashoffset: circumference * (1 - progress) }
            }
            transition={isQuickActive && running ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5, ease: "linear" }}
          />
        </svg>
        <div className="text-center">
          <p className="text-4xl font-bold tabular-nums">{!isQuickActive && isOvertime && "+"}{mm}:{ss}</p>
          <p className="text-xs text-ink-faint mt-1">
            {!active ? "Ready" : isQuickActive ? (running ? "Quick Study — focusing…" : "Quick Study — paused") : isOvertime ? "Overtime — keep going!" : running ? "Focusing…" : "Paused"}
          </p>
        </div>
      </div>

      {!active && (
        <div className="space-y-2">
          <select value={courseId ?? ""} onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : undefined)} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" disabled={courses.length === 0}>
            {courses.length === 0 && <option value="">No current-semester courses</option>}
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
          </select>
          <select value={studyType} onChange={(e) => setStudyType(e.target.value as StudyType)} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2">
            {STUDY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="What are you working on?" value={taskLabel} onChange={(e) => setTaskLabel(e.target.value)} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
        </div>
      )}

      <div className="flex justify-center gap-4">
        {!active && (
          <button
            onClick={() => start({ courseId, taskLabel, studyType, mode, plannedMinutes })}
            disabled={!courseId}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95 disabled:opacity-40"
          >
            <Play size={26} />
          </button>
        )}
        {active && running && (
          <button onClick={pause} className="flex h-16 w-16 items-center justify-center rounded-full bg-warn text-white shadow-lg active:scale-95"><Pause size={26} /></button>
        )}
        {active && !running && (
          <button onClick={resume} className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95"><Play size={26} /></button>
        )}
        {active && (
          <>
            <button onClick={finish} className="flex h-16 w-16 items-center justify-center rounded-full bg-good text-white shadow-lg active:scale-95"><Check size={26} /></button>
            <button onClick={discard} className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunken text-ink active:scale-95"><RotateCcw size={22} /></button>
          </>
        )}
      </div>
      {active && (
        <p className="text-center text-xs text-ink-faint">
          This timer keeps running accurately even if you switch tabs or navigate elsewhere — come back anytime to finish it.
        </p>
      )}

      {!active && (
        <section className="space-y-2 border-t border-border pt-5">
          <h2 className="text-sm font-semibold text-ink-muted">QUICK STUDY</h2>
          <p className="text-xs text-ink-faint">No course, no setup — just start studying right now. Still counts toward your daily goal.</p>
          <button
            onClick={() => startQuick()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-sunken/70 py-3 font-semibold text-ink active:scale-[0.98]"
          >
            <Zap size={18} className="text-accent" /> Start Quick Study
          </button>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-muted">RECENT SESSIONS</h2>
          <button onClick={() => setShowLog(true)} className="flex items-center gap-1 text-xs text-accent"><Plus size={14} /> Log past session</button>
        </div>
        <div className="card divide-y divide-border overflow-hidden">
          {recentSessions.length === 0 && <p className="p-4 text-sm text-ink-faint">No sessions yet. Start your first one above.</p>}
          {recentSessions.map((s) => {
            const c = allCourses.find((cc) => cc.id === s.courseId);
            const label = s.isQuickStudy ? "Quick Study" : c?.code ?? "General";
            return (
              <div key={s.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium">{label} {s.taskLabel && `· ${s.taskLabel}`}</p>
                  <p className="text-xs text-ink-faint">{s.isQuickStudy ? "Quick Study" : s.studyType ?? "Session"} · {new Date(s.startedAt).toLocaleString()}</p>
                </div>
                <span className="text-xs font-semibold text-accent">{s.actualMinutes}m</span>
              </div>
            );
          })}
        </div>
      </section>

      <LogPastSessionSheet open={showLog} onClose={() => setShowLog(false)} courses={courses} />
    </div>
  );
}

function LogPastSessionSheet({ open, onClose, courses }: { open: boolean; onClose: () => void; courses: { id?: number; code: string }[] }) {
  const [courseId, setCourseId] = useState<number | undefined>();
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [studyType, setStudyType] = useState<StudyType>("Lecture Review");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes <= 0) { setError("Duration must be greater than 0."); return; }
    if (!date) { setError("Pick a date."); return; }
    setSubmitting(true);
    try {
      const startedAt = new Date(`${date}T12:00:00`).toISOString();
      await db.studySessions.add({
        courseId, taskLabel: notes, studyType, mode: "Custom",
        plannedMinutes: totalMinutes, actualMinutes: totalMinutes,
        startedAt, endedAt: startedAt, completed: true,
      });
      onClose();
      setHours(0); setMinutes(30); setNotes("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl card p-5 space-y-3"
            style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <h3 className="text-lg font-semibold">Log a Past Study Session</h3>
            <select value={courseId ?? ""} onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : undefined)} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2">
              <option value="">No course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-ink-muted">Hours
                <input type="number" min={0} value={hours} onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))} className="mt-1 w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
              </label>
              <label className="flex-1 text-xs text-ink-muted">Minutes
                <input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))} className="mt-1 w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
              </label>
            </div>
            <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
            <select value={studyType} onChange={(e) => setStudyType(e.target.value as StudyType)} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2">
              {STUDY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
            {error && <p className="text-xs text-bad">{error}</p>}
            <button disabled={submitting} onClick={save} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
              {submitting ? "Saving…" : "Save Session"}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
