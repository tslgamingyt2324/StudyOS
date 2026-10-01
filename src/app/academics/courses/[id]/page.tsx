"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Pencil, Play, Plus, Circle, CheckCircle2, RefreshCcw } from "lucide-react";
import { db } from "@/db/db";
import { toggleTaskDone } from "@/db/actions";
import { useSettings } from "@/hooks/useSettings";
import { useCourses } from "@/hooks/useCourses";
import { useAttendance } from "@/hooks/useAttendance";
import { useStudySessions } from "@/hooks/useStudy";
import { useQuickAdd } from "@/components/shell/QuickAdd";
import { Badge, EmptyState, PageSkeleton, Progress, Section, Stat } from "@/components/ui";
import AttendanceCard from "@/components/academic/AttendanceCard";
import CourseForm from "@/components/forms/CourseForm";
import { cn, deadlineLabel } from "@/lib/utils";
import { formatClassRange } from "@/lib/classTime";
import { gradeColor } from "@/lib/gpa";
import { daysBetween, formatMinutes, parseKey, shortDate } from "@/lib/dates";
import { WEEKDAY_LONG, WEEKDAY_SHORT, completed } from "@/lib/stats";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const router = useRouter();
  const quick = useQuickAdd();
  const { settings } = useSettings();
  const { courses, semesterLabel, loading } = useCourses();
  const course = courses.find((c) => c.id === courseId);
  const att = useAttendance(course ? [course] : [], settings?.attendanceThreshold ?? 70);
  const { sessions } = useStudySessions();
  const tasks = useLiveQuery(() => db.tasks.where("courseId").equals(courseId).toArray(), [courseId]);
  const exams = useLiveQuery(() => db.exams.where("courseId").equals(courseId).sortBy("date"), [courseId]);
  const notes = useLiveQuery(() => db.notes.where("courseId").equals(courseId).toArray(), [courseId]);
  const goals = useLiveQuery(() => db.goals.where("courseId").equals(courseId).toArray(), [courseId]);
  const [editing, setEditing] = useState(false);

  const mine = useMemo(() => completed(sessions).filter((s) => s.courseId === courseId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [sessions, courseId]);

  if (loading || !settings || !tasks || !exams || !notes || !goals) return <PageSkeleton />;
  if (!course) {
    return <div className="card"><EmptyState title="Course not found" message="It may have been deleted." action={<Link href="/academics/courses" className="btn btn-primary">Back to courses</Link>} /></div>;
  }

  const scale = settings.gradeScale;
  const points = course.grade ? scale[course.grade] : undefined;
  const now = new Date();
  const original = course.originalCourseId ? courses.find((c) => c.id === course.originalCourseId) : undefined;
  const retakeOf = courses.find((c) => c.isRetake && c.originalCourseId === course.id);
  const pending = tasks.filter((t) => t.status !== "Completed").sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  const done = tasks.filter((t) => t.status === "Completed");
  const upcoming = exams.filter((e) => daysBetween(now, parseKey(e.date)) >= 0);
  const totalStudy = mine.reduce((t, s) => t + s.actualMinutes, 0);

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm -ml-3 mb-1"><ArrowLeft size={14} /> Back</button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{course.code}</h1>{course.isRetake && <Badge tone="warn">Retake</Badge>}<Badge>{semesterLabel(course.semesterId)}</Badge></div>
            <p className="text-ink-muted">{course.title}</p>
            <p className="text-xs text-ink-muted">{[course.faculty, course.section && `Section ${course.section}`, course.room].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit course"><Pencil size={18} /></button>
          </div>
        </div>
        <Link href={`/study/timer?course=${courseId}`} className="btn btn-primary mt-3 w-full sm:w-auto"><Play size={16} /> Start studying {course.code}</Link>
      </div>

      <Section title="Academic status">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Current grade" value={course.grade ? <span className={gradeColor(course.grade)}>{course.grade}</span> : "—"} hint={course.grade ? `${points?.toFixed(2)} points` : "Not graded yet"} />
          <Stat label="Target grade" value={course.targetGrade ?? course.retakeTargetGrade ?? "—"} hint={course.targetGrade && points !== undefined ? (points >= scale[course.targetGrade] ? "Target met" : "Below target") : undefined} />
          <Stat label="Credits" value={course.credits} hint={course.gpaCounting ? "Counts toward GPA" : "Not in GPA"} />
          <Stat label="GPA contribution" value={points !== undefined && course.gpaCounting ? (points * course.credits).toFixed(1) : "—"} hint={points !== undefined && course.gpaCounting ? `${points.toFixed(2)} × ${course.credits} cr` : "Quality points"} />
        </div>
      </Section>

      {(original || retakeOf) && (
        <Section title="Retake">
          <div className="card p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><RefreshCcw size={15} className="text-accent" aria-hidden="true" />{original ? "This is a retake" : "This course has been retaken"}</p>
            {(() => {
              const o = original ?? course, r = original ? course : retakeOf!;
              const op = o.grade ? scale[o.grade] : 0, rp = r.grade ? scale[r.grade] : undefined;
              return (
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-surface-sunken/50 py-2"><dd className={cn("text-lg font-bold", gradeColor(o.grade))}>{o.grade || "—"}</dd><dt className="text-[10px] text-ink-muted">Original ({semesterLabel(o.semesterId)})</dt></div>
                  <div className="rounded-xl bg-surface-sunken/50 py-2"><dd className="text-lg font-bold">{o.retakeTargetGrade ?? r.targetGrade ?? "—"}</dd><dt className="text-[10px] text-ink-muted">Target</dt></div>
                  <div className="rounded-xl bg-surface-sunken/50 py-2"><dd className="text-lg font-bold">{rp === undefined ? "—" : `${rp - op >= 0 ? "+" : ""}${(rp - op).toFixed(2)}`}</dd><dt className="text-[10px] text-ink-muted">Improvement</dt></div>
                </dl>
              );
            })()}
          </div>
        </Section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Attendance">
          <AttendanceCard course={course} records={att.records} threshold={settings.attendanceThreshold} />
        </Section>

        <Section title="Schedule">
          <div className="card divide-y divide-border">
            {course.schedule.length === 0 ? <EmptyState title="No class times" message="Add weekly class times so this course appears on your calendar." action={<button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Add class times</button>} /> :
              course.schedule.map((b, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <span className="text-sm font-medium">{b.days.map((d) => WEEKDAY_SHORT[WEEKDAY_LONG.indexOf(d)]).join(", ")}</span>
                  <span className="text-sm tabular text-ink-muted">{formatClassRange(b)}</span>
                </div>
              ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Tasks" action={<button className="btn btn-ghost btn-sm" onClick={() => quick.open("task", { task: { courseId } })}><Plus size={14} /> Add</button>}>
          <div className="card divide-y divide-border">
            {pending.length + done.length === 0 && <p className="p-4 text-sm text-ink-muted">No tasks or assignments for {course.code}.</p>}
            {pending.map((t) => { const dl = deadlineLabel(t.deadline); return (
              <div key={t.id} className="flex items-center gap-2 pr-4">
                <button className="icon-btn" onClick={() => toggleTaskDone(t)} aria-label={`Mark ${t.title} complete`}><Circle size={20} /></button>
                <div className="min-w-0 flex-1 py-2"><p className="truncate text-sm font-medium">{t.title}</p><p className="text-xs text-ink-muted">{t.category}</p></div>
                <span className={cn("text-xs font-semibold", dl.urgency === "overdue" ? "text-bad" : dl.urgency === "today" || dl.urgency === "soon" ? "text-warn" : "text-ink-muted")}>{dl.label}</span>
              </div>); })}
            {done.length > 0 && <details className="p-3"><summary className="cursor-pointer text-xs font-medium text-ink-muted">{done.length} completed</summary>
              <ul className="mt-2 space-y-1">{done.map((t) => <li key={t.id} className="flex items-center gap-2 text-sm text-ink-muted line-through"><CheckCircle2 size={14} className="text-good" aria-hidden="true" />{t.title}</li>)}</ul></details>}
          </div>
        </Section>

        <Section title="Exams" action={<button className="btn btn-ghost btn-sm" onClick={() => quick.open("exam", { exam: { courseId } })}><Plus size={14} /> Add</button>}>
          <div className="card divide-y divide-border">
            {exams.length === 0 && <p className="p-4 text-sm text-ink-muted">No exams scheduled for {course.code}.</p>}
            {exams.map((e) => { const d = daysBetween(now, parseKey(e.date)); return (
              <Link key={e.id} href="/planner/exams" className="row-link">
                <span><span className="block text-sm font-medium">{e.title}</span><span className="block text-xs text-ink-muted">{shortDate(e.date)} · {e.preparationPct}% prepared{e.actualMarks !== undefined ? ` · scored ${e.actualMarks}` : ""}</span></span>
                <span className={cn("text-xs font-semibold", d < 0 ? "text-ink-faint" : d <= 3 ? "text-warn" : "text-ink-muted")}>{d < 0 ? "Done" : d === 0 ? "Today" : `${d}d`}</span>
              </Link>); })}
            {upcoming[0] && <div className="p-4"><Progress value={upcoming[0].preparationPct} label="Exam preparation" thin /></div>}
          </div>
        </Section>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Notes" action={<button className="btn btn-ghost btn-sm" onClick={() => quick.open("note", { courseId })}><Plus size={14} /> Add</button>}>
          <div className="card divide-y divide-border">
            {notes.length === 0 && <p className="p-4 text-sm text-ink-muted">No notes for {course.code} yet.</p>}
            {notes.filter((n) => !n.archived).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5).map((n) => (
              <Link key={n.id} href={`/notes?open=${n.id}`} className="row-link"><span className="truncate text-sm font-medium">{n.title}</span><span className="shrink-0 text-xs text-ink-muted">{shortDate(n.updatedAt.slice(0, 10))}</span></Link>))}
          </div>
        </Section>

        <Section title="Study" action={<Link href={`/study/timer?course=${courseId}`} className="btn btn-ghost btn-sm"><Play size={14} /> Start</Link>}>
          <div className="card">
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border text-center">
              <div className="p-3"><p className="text-xl font-bold tabular">{formatMinutes(totalStudy)}</p><p className="text-[11px] text-ink-muted">Total study time</p></div>
              <div className="p-3"><p className="text-xl font-bold tabular">{mine.length}</p><p className="text-[11px] text-ink-muted">Sessions</p></div>
            </div>
            {mine.length === 0 ? <p className="p-4 text-sm text-ink-muted">No study sessions logged for {course.code}.</p> : (
              <ul className="divide-y divide-border">{mine.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm"><span>{s.studyType ?? "Study"}<span className="text-xs text-ink-muted"> · {shortDate(s.startedAt.slice(0, 10))}</span></span><span className="tabular text-ink-muted">{formatMinutes(s.actualMinutes)}</span></li>))}</ul>
            )}
          </div>
        </Section>
      </div>

      {goals.length > 0 && (
        <Section title="Goals" action={<Link href="/study/goals" className="text-xs font-medium text-accent">All goals</Link>}>
          <div className="card divide-y divide-border">{goals.map((g) => <Link key={g.id} href="/study/goals" className="row-link"><span className="text-sm font-medium">{g.title}</span><Badge tone={g.status === "Completed" ? "good" : "neutral"}>{g.status}</Badge></Link>)}</div>
        </Section>
      )}

      {editing && <CourseForm open initial={course} onClose={() => setEditing(false)} />}
    </div>
  );
}
