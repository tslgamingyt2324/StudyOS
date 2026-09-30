"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Play, X } from "lucide-react";
import { useStudyTimer } from "@/lib/studyTimer";
import { useCourses } from "@/hooks/useCourses";
import TimerDisplay from "@/components/study/TimerDisplay";
import TimerControls from "@/components/study/TimerControls";
import { STUDY_TYPES } from "@/components/forms/StudyLogForm";
import { StudyType } from "@/types";

/** Distraction-free timer: no navigation, one large clock, the essentials only. */
function Focus() {
  const params = useSearchParams();
  const { active, start, startQuick, elapsedSeconds } = useStudyTimer();
  const { currentCourses, byId } = useCourses();
  const [courseId, setCourseId] = useState<number | undefined>();
  const [studyType, setStudyType] = useState<StudyType>("Lecture Review");
  const [minutes, setMinutes] = useState(50);

  useEffect(() => {
    const wanted = Number(params.get("course"));
    setCourseId((cur) => cur && currentCourses.some((c) => c.id === cur) ? cur : currentCourses.find((c) => c.id === wanted)?.id ?? currentCourses[0]?.id);
  }, [currentCourses, params]);

  const course = active?.mode === "Quick" ? undefined : byId(active?.courseId);
  const sessionPct = active && active.mode !== "Quick" ? Math.min(100, Math.round((elapsedSeconds / (active.plannedMinutes * 60)) * 100)) : null;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-surface px-6 py-10" style={{ paddingTop: "calc(2.5rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom, 0px))" }}>
      <Link href="/study/timer" className="icon-btn fixed right-3 top-3 z-10" style={{ marginTop: "env(safe-area-inset-top, 0px)" }} aria-label="Exit focus mode"><X size={22} /></Link>

      {active ? (
        <div className="text-center">
          <h1 className="text-lg font-semibold">{active.mode === "Quick" ? "Quick Study" : course?.code ?? "Study"}</h1>
          <p className="text-sm text-ink-muted">{active.mode === "Quick" ? "Open session" : active.studyType}{active.taskLabel ? ` · ${active.taskLabel}` : ""}</p>
        </div>
      ) : <h1 className="text-lg font-semibold">Focus mode</h1>}

      <TimerDisplay size="xl" idleLabel="Ready to focus" />

      {active ? (
        <div className="w-full max-w-sm space-y-3">
          <TimerControls big />
          {sessionPct !== null && <p className="text-center text-xs text-ink-muted">{sessionPct}% of session</p>}
        </div>
      ) : (
        <div className="w-full max-w-xs space-y-2">
          <select aria-label="Course" className="input" value={courseId ?? ""} onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : undefined)}>
            {currentCourses.length === 0 && <option value="">No courses</option>}
            {currentCourses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
          </select>
          <select aria-label="Activity" className="input" value={studyType} onChange={(e) => setStudyType(e.target.value as StudyType)}>{STUDY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <div className="flex items-center gap-2"><input aria-label="Minutes" type="number" min={1} max={480} className="input text-center" value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value) || 1)} /><span className="text-sm text-ink-muted">min</span></div>
          <button className="btn btn-primary w-full !min-h-[52px]" disabled={!courseId} onClick={() => start({ courseId, studyType, mode: "Custom", plannedMinutes: Math.max(1, minutes) })}><Play size={18} /> Begin</button>
          <button className="btn btn-ghost w-full" onClick={() => startQuick()}>or start open-ended</button>
        </div>
      )}
    </div>
  );
}

export default function FocusPage() { return <Suspense fallback={null}><Focus /></Suspense>; }
