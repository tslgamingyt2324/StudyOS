"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, RefreshCcw } from "lucide-react";
import { db } from "@/db/db";
import { calculateGPA, calculateSemesterGPA, requiredFutureGPA } from "@/lib/gpa";
import { getAcademicProfile, getSemesterCreditBreakdown } from "@/lib/academicProfile";
import { Grade } from "@/types";
import StatCard from "@/components/StatCard";

const GRADES: Grade[] = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"];

export default function AcademicsPage() {
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const courses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const semesters = useLiveQuery(() => db.semesters.toArray()) ?? [];

  const [whatIf, setWhatIf] = useState<Record<number, Grade>>({});
  const [target, setTarget] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  if (!settings) return null;

  const profile = getAcademicProfile(settings);

  const currentSemester = semesters.find((s) => s.isCurrent);
  const activeCourses = courses.filter((c) => c.semesterId === currentSemester?.id);
  const inProgress = activeCourses.filter((c) => c.status === "In Progress" && c.gpaCounting);
  const creditBreakdown = getSemesterCreditBreakdown(profile, activeCourses, currentSemester?.registeredCredits ?? 0);

  const simulatedCourses = courses.map((c) =>
    whatIf[c.id!] ? { ...c, grade: whatIf[c.id!], status: "Completed" as const } : c
  );
  const simulatedCGPA = calculateGPA(simulatedCourses, settings.gradeScale, settings);
  const simulatedSemGPA = currentSemester?.id
    ? calculateSemesterGPA(simulatedCourses, currentSemester.id, settings.gradeScale, settings)
    : { gpa: 0 };
  const hasSimulation = Object.keys(whatIf).length > 0;

  const targetVal = target ?? settings.targetCGPA ?? 3.5;
  const remainingVal = remaining ?? profile.remainingCredits;
  const req = requiredFutureGPA(profile.officialCGPA, profile.completedCredits, targetVal, remainingVal);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">GPA / CGPA</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Official CGPA" value={profile.officialCGPA} delay={0} />
        <StatCard label="Completed Credits" value={profile.completedCredits} decimals={0} delay={0.05} />
      </div>
      <p className="text-xs text-ink-faint -mt-4">
        This is your official, verified transcript CGPA — it's a stored fact, not recalculated from your course
        rows, so it can't drift because of a blank grade or a duplicate record.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/academics/courses" className="card flex items-center justify-between p-4">
          <span className="font-medium">Courses</span><ChevronRight size={16} className="text-ink-faint" />
        </Link>
        <Link href="/academics/retakes" className="card flex items-center justify-between p-4">
          <span className="font-medium">Retakes</span><ChevronRight size={16} className="text-ink-faint" />
        </Link>
      </div>

      {/* Current-semester credit breakdown (PART 20) */}
      {currentSemester && (
        <section className="card p-4 space-y-2">
          <h2 className="font-semibold">{currentSemester.label} Load</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface-sunken/50 p-2.5">
              <p className="text-lg font-bold">{creditBreakdown.registeredCredits}</p>
              <p className="text-[10px] text-ink-faint">Registered</p>
            </div>
            <div className="rounded-xl bg-warn/10 p-2.5">
              <p className="text-lg font-bold text-warn">{creditBreakdown.retakeCredits}</p>
              <p className="text-[10px] text-ink-faint">Retake</p>
            </div>
            <div className="rounded-xl bg-good/10 p-2.5">
              <p className="text-lg font-bold text-good">{creditBreakdown.newDegreeCredits}</p>
              <p className="text-[10px] text-ink-faint">New degree credits</p>
            </div>
          </div>
          <p className="text-xs text-ink-faint">
            Retake credits already counted toward your {profile.completedCredits} completed credits aren't counted
            twice. If this semester finishes as registered, completed credits become{" "}
            <span className="font-semibold text-ink">{creditBreakdown.completedCreditsAfter}</span> and remaining
            drops to <span className="font-semibold text-ink">{creditBreakdown.remainingCreditsAfter}</span>.
          </p>
        </section>
      )}

      {/* Target CGPA */}
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">CGPA Goal</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-ink-muted">
            Target CGPA
            <input
              type="number" step="0.01" min={0} max={4}
              defaultValue={targetVal}
              onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2 text-ink"
            />
          </label>
          <label className="text-xs text-ink-muted">
            Remaining credits
            <input
              type="number" min={0}
              defaultValue={remainingVal}
              onChange={(e) => setRemaining(parseInt(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2 text-ink"
            />
          </label>
        </div>
        <div className="rounded-xl bg-surface-sunken/50 p-3">
          {req.achievable ? (
            <p className="text-sm">
              You need an average GPA of <span className="font-bold text-accent">{req.required.toFixed(2)}</span> across your
              remaining {remainingVal} credits to reach {targetVal.toFixed(2)} CGPA.
            </p>
          ) : (
            <p className="text-sm text-bad">
              A {targetVal.toFixed(2)} CGPA is not mathematically achievable with only {remainingVal} credits remaining
              (would require {req.required.toFixed(2)} GPA, above the 4.00 max). Try a lower target or more remaining credits.
            </p>
          )}
        </div>
      </section>

      {/* Semester Projection (what-if) calculator */}
      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Semester Projection</h2>
          {hasSimulation && (
            <button onClick={() => setWhatIf({})} className="flex items-center gap-1 text-xs text-accent">
              <RefreshCcw size={12} /> Reset
            </button>
          )}
        </div>
        <p className="text-xs text-ink-faint">
          Simulate grades for your current in-progress courses. This never changes your Official CGPA above —
          only you editing a grade on a course page does that.
        </p>
        <div className="space-y-2">
          {inProgress.map((c) => (
            <div key={c.id} className="flex items-center justify-between">
              <span className="text-sm">{c.code}</span>
              <select
                value={whatIf[c.id!] ?? ""}
                onChange={(e) => setWhatIf((prev) => ({ ...prev, [c.id!]: e.target.value as Grade }))}
                className="rounded-lg border border-border bg-surface-sunken/50 px-2 py-1 text-sm"
              >
                <option value="">—</option>
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          ))}
          {inProgress.length === 0 && <p className="text-sm text-ink-faint">No in-progress courses to simulate.</p>}
        </div>
        {hasSimulation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="rounded-xl bg-accent-soft p-3 text-center">
              <p className="text-xs text-ink-muted">Projected Semester GPA</p>
              <p className="text-2xl font-bold text-accent">{simulatedSemGPA.gpa.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-accent-soft p-3 text-center">
              <p className="text-xs text-ink-muted">Projected CGPA</p>
              <p className="text-2xl font-bold text-accent">{simulatedCGPA.gpa.toFixed(2)}</p>
            </div>
          </motion.div>
        )}
      </section>
    </div>
  );
}
