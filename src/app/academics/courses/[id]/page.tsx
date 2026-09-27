"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/db";
import { Grade } from "@/types";
import { formatTime12 } from "@/lib/utils";

const GRADES: Grade[] = ["", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"];

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const course = useLiveQuery(() => db.courses.get(id), [id]);
  const original = useLiveQuery(() => course?.originalCourseId ? db.courses.get(course.originalCourseId) : undefined, [course?.originalCourseId]);
  const exams = useLiveQuery(() => db.exams.where("courseId").equals(id).toArray(), [id]) ?? [];
  const tasks = useLiveQuery(() => db.tasks.where("courseId").equals(id).toArray(), [id]) ?? [];
  const sessions = useLiveQuery(() => db.studySessions.where("courseId").equals(id).toArray(), [id]) ?? [];
  const [noteDraft, setNoteDraft] = useState<string | null>(null);

  if (!course) return null;

  const totalStudyMinutes = sessions.filter((s) => s.completed).reduce((s, x) => s + x.actualMinutes, 0);

  const update = (patch: Partial<typeof course>) => db.courses.update(id, patch);

  return (
    <div className="px-4 pt-4 space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-accent">
        <ArrowLeft size={16} /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {course.code}
          {course.isRetake && <span className="rounded bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">RETAKE</span>}
        </h1>
        <p className="text-ink-muted">{course.title}</p>
      </div>

      <div className="card grid grid-cols-2 gap-y-3 p-4 text-sm">
        <div><p className="text-ink-faint">Faculty</p><p className="font-medium">{course.faculty}</p></div>
        <div><p className="text-ink-faint">Section</p><p className="font-medium">{course.section}</p></div>
        <div><p className="text-ink-faint">Credits</p><p className="font-medium">{course.credits}</p></div>
        <div><p className="text-ink-faint">Room</p><p className="font-medium">{course.room ?? "—"}</p></div>
        {course.schedule.map((s, i) => (
          <div key={i} className="col-span-2">
            <p className="text-ink-faint">Schedule</p>
            <p className="font-medium">{s.days.join(" & ")} · {formatTime12(s.startTime)}–{formatTime12(s.endTime)}</p>
          </div>
        ))}
      </div>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Grade & Credit Rules</h2>
        <label className="block text-xs text-ink-muted">
          Grade
          <select
            value={course.grade}
            onChange={(e) => update({ grade: e.target.value as Grade, status: e.target.value ? "Completed" : "In Progress" })}
            className="mt-1 w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2 text-ink"
          >
            {GRADES.map((g) => <option key={g} value={g}>{g || "Not graded yet"}</option>)}
          </select>
        </label>
        <div className="flex items-center justify-between text-sm">
          <span>Counts toward GPA</span>
          <input type="checkbox" checked={course.gpaCounting} onChange={(e) => update({ gpaCounting: e.target.checked })} className="h-5 w-5 accent-accent" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Counts as degree credit</span>
          <input type="checkbox" checked={course.degreeCredit} onChange={(e) => update({ degreeCredit: e.target.checked })} className="h-5 w-5 accent-accent" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Is a retake</span>
          <input type="checkbox" checked={course.isRetake} onChange={(e) => update({ isRetake: e.target.checked })} className="h-5 w-5 accent-accent" />
        </div>
        {course.isRetake && (
          <label className="block text-xs text-ink-muted">
            Target grade
            <select
              value={course.retakeTargetGrade ?? ""}
              onChange={(e) => update({ retakeTargetGrade: e.target.value as Grade })}
              className="mt-1 w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2 text-ink"
            >
              {GRADES.filter((g) => g).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        )}
      </section>

      {course.isRetake && original && (
        <section className="card p-4 space-y-2">
          <h2 className="font-semibold">Retake Progress</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface-sunken/50 p-3 text-center">
              <p className="text-xs text-ink-faint mb-1">Previous Grade</p>
              <p className="text-xl font-bold">{original.grade || "—"}</p>
            </div>
            <div className="rounded-xl bg-accent-soft p-3 text-center">
              <p className="text-xs text-ink-faint mb-1">Current Grade</p>
              <p className="text-xl font-bold text-accent">{course.grade || "Not available"}</p>
            </div>
          </div>
        </section>
      )}

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Study Time</h2>
        <p className="text-2xl font-bold text-accent">{(totalStudyMinutes / 60).toFixed(1)}h</p>
        <p className="text-xs text-ink-faint">{sessions.filter((s) => s.completed).length} sessions logged</p>
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Exams</h2>
        {exams.length === 0 && <p className="text-sm text-ink-faint">No exams tracked for this course yet.</p>}
        {exams.map((e) => (
          <div key={e.id} className="flex items-center justify-between text-sm">
            <span>{e.title} ({e.examType})</span>
            <span className="text-xs text-ink-faint">{new Date(e.date).toLocaleDateString()} · {e.preparationPct}% ready</span>
          </div>
        ))}
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Tasks</h2>
        {tasks.length === 0 && <p className="text-sm text-ink-faint">No tasks linked to this course yet.</p>}
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center justify-between text-sm">
            <span className={t.status === "Completed" ? "line-through text-ink-faint" : ""}>{t.title}</span>
            <span className="text-xs text-ink-faint">{t.status}</span>
          </div>
        ))}
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Notes</h2>
        <textarea
          defaultValue={course.notes ?? ""}
          onBlur={(e) => update({ notes: e.target.value })}
          placeholder="Write notes for this course…"
          className="w-full rounded-lg border border-border bg-surface-sunken/50 p-3 text-sm min-h-[100px]"
        />
      </section>
    </div>
  );
}
