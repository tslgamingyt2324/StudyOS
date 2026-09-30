"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardList, MapPin, Play, Plus, ListPlus } from "lucide-react";
import { db } from "@/db/db";
import { useExams } from "@/hooks/useExams";
import { useCourses } from "@/hooks/useCourses";
import { useTasks } from "@/hooks/useTasks";
import { useStudySessions } from "@/hooks/useStudy";
import { useQuickAdd } from "@/components/shell/QuickAdd";
import { Badge, EmptyState, PageHeader, PageSkeleton, Progress, Section } from "@/components/ui";
import ExamForm from "@/components/forms/ExamForm";
import { Exam } from "@/types";
import { cn, formatTime12 } from "@/lib/utils";
import { addDays, dateKey, formatMinutes, longDate } from "@/lib/dates";
import { sessionsBetween, sumMinutes } from "@/lib/stats";

export default function ExamsPage() {
  const { loading, upcoming, past, daysUntil } = useExams();
  const { byId } = useCourses();
  const { tasks } = useTasks();
  const { sessions } = useStudySessions();
  const quick = useQuickAdd();
  const [editing, setEditing] = useState<Exam | "new" | null>(null);

  const weekMinutes = useMemo(() => {
    const now = new Date();
    return (courseId: number) => sumMinutes(sessionsBetween(sessions.filter((s) => s.courseId === courseId), dateKey(addDays(now, -6)), dateKey(now)));
  }, [sessions]);

  if (loading) return <PageSkeleton />;

  const renderCard = (e: Exam, isPast?: boolean) => {
    const days = daysUntil(e.date);
    const course = byId(e.courseId);
    const prep = tasks.filter((t) => t.examId === e.id);
    const openPrep = prep.filter((t) => t.status !== "Completed").length;
    const remaining = 100 - e.preparationPct;
    const tone = days <= 2 ? "bad" : days <= 7 ? "warn" : "accent";
    return (
      <li key={e.id} className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <button className="min-w-0 text-left" onClick={() => setEditing(e)} aria-label={`Edit ${course?.code} ${e.title}`}>
            <p className="flex flex-wrap items-center gap-1.5 font-semibold">{course?.code ?? "Course"} · {e.title} <Badge>{e.examType}</Badge></p>
            <p className="mt-0.5 text-xs text-ink-muted">{longDate(e.date)}{e.time ? ` · ${formatTime12(e.time)}` : ""}</p>
            {e.location && <p className="flex items-center gap-1 text-xs text-ink-muted"><MapPin size={11} aria-hidden="true" />{e.location}</p>}
            {e.topics && <p className="mt-1 text-xs text-ink-muted">Topics: {e.topics}</p>}
          </button>
          <div className="shrink-0 text-right">
            {isPast ? <Badge>{e.actualMarks !== undefined ? `Scored ${e.actualMarks}${e.targetMarks ? ` / ${e.targetMarks}` : ""}` : "Completed"}</Badge> : (
              <>
                <p className={cn("text-2xl font-bold tabular", days <= 2 ? "text-bad" : days <= 7 ? "text-warn" : "")}>{days === 0 ? "Today" : days === 1 ? "1" : days}</p>
                <p className="text-[11px] text-ink-muted">{days === 0 ? "" : days === 1 ? "day remaining" : "days remaining"}</p>
              </>
            )}
          </div>
        </div>
        {!isPast && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs"><span className="text-ink-muted">Preparation</span><span className="font-semibold tabular">{e.preparationPct}%</span></div>
            <input type="range" min={0} max={100} step={5} value={e.preparationPct} aria-label={`${course?.code} ${e.title} preparation`}
              onChange={(ev) => db.exams.update(e.id!, { preparationPct: Number(ev.target.value) })} className="w-full accent-[rgb(var(--accent))]" />
            <Progress value={e.preparationPct} tone={tone} thin label="Preparation" />
            <p className="text-xs text-ink-muted">
              {remaining === 0 ? "You're fully prepared." : days <= 0 ? `${remaining}% still to cover.` : `${remaining}% to go in ${days} day${days === 1 ? "" : "s"} — about ${Math.max(1, Math.ceil(remaining / days))}% per day.`}
              {e.courseId ? ` · ${formatMinutes(weekMinutes(e.courseId))} studied on ${course?.code} this week.` : ""}
              {prep.length > 0 ? ` · ${openPrep} of ${prep.length} prep task${prep.length === 1 ? "" : "s"} open.` : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/study/timer?course=${e.courseId}&type=Exam%20Preparation`} className="btn btn-secondary btn-sm"><Play size={13} /> Study now</Link>
              <button className="btn btn-ghost btn-sm" onClick={() => quick.open("task", { task: { courseId: e.courseId, examId: e.id, title: `Prepare for ${e.title}` } })}><ListPlus size={13} /> Add prep task</button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Exams" subtitle={upcoming.length ? `${upcoming.length} upcoming` : undefined} actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add exam</button>} />
      {upcoming.length + past.length === 0 ? (
        <div className="card"><EmptyState icon={ClipboardList} title="No exams yet" message="Add quizzes, midterms and finals to get countdowns, calendar entries and study planning." action={<button className="btn btn-primary" onClick={() => setEditing("new")}>Add exam</button>} /></div>
      ) : (
        <>
          <Section title="Upcoming">{upcoming.length === 0 ? <p className="text-sm text-ink-muted">No upcoming exams.</p> : <ul className="grid gap-3 md:grid-cols-2">{upcoming.map((e) => renderCard(e))}</ul>}</Section>
          {past.length > 0 && <Section title="Past"><ul className="grid gap-3 md:grid-cols-2">{past.map((e) => renderCard(e, true))}</ul></Section>}
        </>
      )}
      {editing && <ExamForm open initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
