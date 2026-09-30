"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { gradeColor } from "@/lib/gpa";

export default function RetakesPage() {
  const courses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const semesters = useLiveQuery(() => db.semesters.toArray()) ?? [];

  if (!settings) return null;
  const scale = settings.gradeScale;
  const semesterLabel = (semId: number) => semesters.find((s) => s.id === semId)?.label ?? "—";

  const retakes = courses.filter((c) => c.isRetake && c.originalCourseId);

  const plannedRetakes = courses.filter((c) => !c.isRetake && c.retakeTargetGrade && !retakes.some((r) => r.originalCourseId === c.id));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Retakes</h1>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold text-sm text-ink-muted">RULES (edit in Settings)</h2>
        <p className="text-sm">
          Retake replaces old grade in GPA: <span className="font-semibold">{settings.retakeReplacesOldGrade ? "Yes" : "No"}</span>
        </p>
        <p className="text-sm">
          Retake credit counts once: <span className="font-semibold">{settings.retakeCreditCountsOnce ? "Yes" : "No"}</span>
        </p>
      </section>

      {retakes.map((r) => {
        const original = courses.find((c) => c.id === r.originalCourseId);
        if (!original) return null;
        const originalPts = scale[original.grade] ?? 0;
        const retakePts = scale[r.grade] ?? 0;
        const improvement = r.grade ? (retakePts - originalPts).toFixed(2) : "—";

        return (
          <section key={r.id} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{r.code} · {r.title}</h2>
              <span className="rounded bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">RETAKE · {r.credits} CR</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface-sunken/50 p-3">
                <p className="text-xs text-ink-faint">{semesterLabel(original.semesterId)}</p>
                <p className="text-xs text-ink-faint mb-1">Previous Grade</p>
                <p className={`text-xl font-bold ${gradeColor(original.grade)}`}>{original.grade}</p>
                <p className="text-[11px] text-ink-faint">{originalPts.toFixed(2)} grade points</p>
              </div>
              <div className="rounded-xl bg-accent-soft p-3">
                <p className="text-xs text-ink-faint">{semesterLabel(r.semesterId)}</p>
                <p className="text-xs text-ink-faint mb-1">Current Grade (target {r.retakeTargetGrade})</p>
                <p className={`text-xl font-bold ${gradeColor(r.grade)}`}>{r.grade || "Not available"}</p>
                <p className="text-[11px] text-ink-faint">{r.grade ? `${retakePts.toFixed(2)} grade points` : "Update on the course page once graded"}</p>
              </div>
            </div>
            <p className="text-xs text-ink-muted">
              Quality point change: <span className="font-semibold">{improvement}</span> per credit
              {r.grade && ` · CGPA impact applied via the ${settings.retakeReplacesOldGrade ? "replace" : "average"} rule`}
            </p>
          </section>
        );
      })}

      {plannedRetakes.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-muted">PLANNED RETAKES</h2>
          <div className="card divide-y divide-border overflow-hidden">
            {plannedRetakes.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{c.code}</p>
                  <p className="text-xs text-ink-faint">Original grade {c.grade} · target {c.retakeTargetGrade} · {c.retakePlannedSemester}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
