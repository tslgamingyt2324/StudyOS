"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Play, Plus, Zap, Maximize2 } from "lucide-react";
import { useStudyTimer } from "@/lib/studyTimer";
import { useCourses } from "@/hooks/useCourses";
import { useStudySessions } from "@/hooks/useStudy";
import { useSettings } from "@/hooks/useSettings";
import { useQuickAdd } from "@/components/shell/QuickAdd";
import { STUDY_TYPES } from "@/components/forms/StudyLogForm";
import TimerDisplay from "@/components/study/TimerDisplay";
import TimerControls from "@/components/study/TimerControls";
import { Badge, PageHeader, PageSkeleton, Section, Segmented } from "@/components/ui";
import { StudySession, StudyType } from "@/types";
import { formatMinutes, shortDate } from "@/lib/dates";
import { dateKey } from "@/lib/dates";

type Mode = Exclude<StudySession["mode"], "Quick">;
const MODES: Record<Mode, number> = { Pomodoro: 25, "25/5": 25, "50/10": 50, Custom: 30 };

function TimerPage() {
  const params = useSearchParams();
  const quick = useQuickAdd();
  const { settings } = useSettings();
  const { currentCourses, byId, loading } = useCourses();
  const { sessions } = useStudySessions();
  const { active, start, startQuick } = useStudyTimer();

  const [mode, setMode] = useState<Mode>("Pomodoro");
  const [custom, setCustom] = useState(30);
  const [courseId, setCourseId] = useState<number | undefined>();
  const [label, setLabel] = useState("");
  const [studyType, setStudyType] = useState<StudyType>("Lecture Review");

  // Preselect from ?course= / ?type= (used by "Start studying" buttons elsewhere),
  // otherwise the first current-semester course.
  useEffect(() => {
    if (currentCourses.length === 0) { setCourseId(undefined); return; }
    const wanted = Number(params.get("course"));
    setCourseId((cur) => (cur && currentCourses.some((c) => c.id === cur)) ? cur : currentCourses.find((c) => c.id === wanted)?.id ?? currentCourses[0].id);
  }, [currentCourses, params]);
  useEffect(() => {
    const t = params.get("type");
    if (t && STUDY_TYPES.includes(t as StudyType)) setStudyType(t as StudyType);
  }, [params]);

  if (loading || !settings) return <PageSkeleton />;
  const planned = mode === "Custom" ? Math.max(1, custom) : MODES[mode];
  const recent = [...sessions].filter((s) => s.completed).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 5);
  const active_ = active ? (active.mode === "Quick" ? "Quick Study" : byId(active.courseId)?.code ?? "Study") : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Study timer" subtitle={active ? `${active_}${active.studyType && active.mode !== "Quick" ? ` · ${active.studyType}` : ""}` : "Pick a course and start focusing."}
        actions={<Link href="/study/focus" className="btn btn-secondary btn-sm"><Maximize2 size={14} /> Focus mode</Link>} />

      {!active && (
        <div className="space-y-3">
          <div className="flex justify-center"><Segmented label="Timer preset" value={mode} options={Object.keys(MODES) as Mode[]} onChange={setMode} /></div>
          {mode === "Custom" && (
            <div className="mx-auto flex w-40 items-center gap-2"><input aria-label="Custom minutes" type="number" min={1} max={480} className="input text-center" value={custom} onChange={(e) => setCustom(parseInt(e.target.value) || 1)} /><span className="text-sm text-ink-muted">min</span></div>
          )}
          {(mode === "Pomodoro" || mode === "25/5") && <p className="text-center text-xs text-ink-muted">25 minutes focus, then a 5-minute break.</p>}
          {mode === "50/10" && <p className="text-center text-xs text-ink-muted">50 minutes focus, then a 10-minute break.</p>}
        </div>
      )}

      <TimerDisplay />

      {!active && (
        <div className="mx-auto w-full max-w-md space-y-2">
          <label className="sr-only" htmlFor="t-course">Course</label>
          <select id="t-course" value={courseId ?? ""} onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : undefined)} className="input" disabled={currentCourses.length === 0}>
            {currentCourses.length === 0 && <option value="">No courses this semester — use Quick Study</option>}
            {currentCourses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
          </select>
          <label className="sr-only" htmlFor="t-type">Activity</label>
          <select id="t-type" value={studyType} onChange={(e) => setStudyType(e.target.value as StudyType)} className="input">{STUDY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <label className="sr-only" htmlFor="t-label">What are you working on?</label>
          <input id="t-label" placeholder="What are you working on? (optional)" value={label} onChange={(e) => setLabel(e.target.value)} className="input" />
          <button onClick={() => start({ courseId, taskLabel: label, studyType, mode, plannedMinutes: planned })} disabled={!courseId} className="btn btn-primary w-full !min-h-[52px] text-base"><Play size={18} /> Start {planned} min</button>
        </div>
      )}

      <TimerControls />
      {active && <p className="text-center text-xs text-ink-muted">Your timer keeps counting accurately if you switch tabs, navigate, or refresh.</p>}

      {!active && (
        <section className="mx-auto max-w-md space-y-2 border-t border-border pt-5">
          <h2 className="section-title">Quick study</h2>
          <p className="text-xs text-ink-muted">No course, no setup — an open-ended stopwatch that still counts toward your daily goal.</p>
          <button onClick={() => startQuick()} className="btn btn-secondary w-full"><Zap size={16} className="text-accent" /> Start Quick Study</button>
        </section>
      )}

      <Section title="Recent sessions" action={<button onClick={() => quick.open("study-log")} className="btn btn-ghost btn-sm"><Plus size={14} /> Log past session</button>}>
        <div className="card divide-y divide-border overflow-hidden">
          {recent.length === 0 && <p className="p-4 text-sm text-ink-muted">No sessions yet — start your first one above.</p>}
          {recent.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.isQuickStudy ? "Quick Study" : byId(s.courseId)?.code ?? "General"}{s.taskLabel && ` · ${s.taskLabel}`}</p>
                <p className="text-xs text-ink-muted">{s.isQuickStudy ? "Open session" : s.studyType ?? "Session"} · {s.startedAt.slice(0, 10) === dateKey() ? "Today" : shortDate(dateKey(s.startedAt))}{s.rating ? ` · ${s.rating}` : ""}</p>
              </div>
              <Badge tone="accent">{formatMinutes(s.actualMinutes)}</Badge>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><TimerPage /></Suspense>;
}
