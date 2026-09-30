"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Map, Pencil, Plus } from "lucide-react";
import { db } from "@/db/db";
import { useSettings } from "@/hooks/useSettings";
import { useCourses } from "@/hooks/useCourses";
import { useQuickAdd } from "@/components/shell/QuickAdd";
import { EmptyState, Field, PageHeader, PageSkeleton, Progress, Section, Stat } from "@/components/ui";
import SemesterTimeline from "@/components/academic/SemesterTimeline";
import PlannedCourseForm from "@/components/forms/PlannedCourseForm";
import SemesterForm from "@/components/forms/SemesterForm";
import { buildTimeline, estimateGraduation, termKey } from "@/lib/degree";
import { getAcademicProfile, getSemesterCreditBreakdown } from "@/lib/academicProfile";
import { projectRoadmap, requiredFutureGPA } from "@/lib/gpa";
import { PlannedCourse, Semester } from "@/types";

export default function DegreePlanner() {
  const { settings, update } = useSettings();
  const { courses, semesters, currentSemester, currentCourses, loading } = useCourses();
  const planned = useLiveQuery(() => db.plannedCourses.toArray());
  const quick = useQuickAdd();
  const [editingPlanned, setEditingPlanned] = useState<PlannedCourse | null>(null);
  const [editingSem, setEditingSem] = useState<Semester | "new" | null>(null);
  const [scenarioGpa, setScenarioGpa] = useState(3.3);
  const [target, setTarget] = useState<number | null>(null);

  const timeline = useMemo(() => (settings && planned ? buildTimeline(semesters, courses, planned, settings) : []), [settings, semesters, courses, planned]);

  if (loading || !settings || !planned) return <PageSkeleton />;

  const profile = getAcademicProfile(settings);
  const credit = getSemesterCreditBreakdown(profile, currentCourses, currentSemester?.registeredCredits ?? 0);
  const future = timeline.filter((t) => t.status === "future");
  const plannedFutureCredits = future.reduce((t, f) => t + f.credits, 0);
  const anchor = future.length ? { year: future[future.length - 1].year, term: future[future.length - 1].term } : currentSemester ? { year: currentSemester.year, term: currentSemester.term } : null;
  const per = settings.creditsPerSemester ?? 15;
  const est = estimateGraduation({
    degreeCredits: profile.degreeCredits, completedCredits: profile.completedCredits, currentSemesterNewCredits: credit.newDegreeCredits,
    plannedFutureCredits, lastPlannedOrCurrent: anchor, creditsPerSemester: per,
  });
  const pct = profile.degreeCredits ? (profile.completedCredits / profile.degreeCredits) * 100 : 0;
  const projectedPct = profile.degreeCredits ? Math.min(100, ((profile.completedCredits + credit.newDegreeCredits) / profile.degreeCredits) * 100) : 0;

  const targetVal = target ?? settings.targetCGPA ?? 3.5;
  const req = requiredFutureGPA(profile.officialCGPA, profile.completedCredits, targetVal, profile.remainingCredits);
  const roadmap = projectRoadmap(profile.officialCGPA, profile.completedCredits,
    [...(credit.newDegreeCredits ? [{ label: currentSemester?.label ?? "Current", targetGPA: scenarioGpa, credits: credit.newDegreeCredits }] : []),
      ...future.map((f) => ({ label: f.label, targetGPA: scenarioGpa, credits: f.credits }))]);

  const workloadWarn = (c: number) => c > 18 ? "Heavy load" : c > 0 && c < 9 ? "Light load" : "";
  const sortedFuture = [...future].sort((a, b) => termKey(a.year, a.term) - termKey(b.year, b.term));

  return (
    <div className="space-y-6">
      <PageHeader title="Degree planner" subtitle="Plan the road to graduation. Nothing here is tied to a specific curriculum."
        actions={<><button className="btn btn-secondary" onClick={() => setEditingSem("new")}><Plus size={16} /> Semester</button><button className="btn btn-primary" onClick={() => quick.open("planned-course")}><Plus size={16} /> Plan a course</button></>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Completed" value={profile.completedCredits} hint={`of ${profile.degreeCredits} credits`} />
        <Stat label="This semester" value={credit.newDegreeCredits} hint={credit.retakeCredits ? `+${credit.retakeCredits} retake credits` : "new credits"} />
        <Stat label="Planned ahead" value={plannedFutureCredits} hint={`${future.length} semester${future.length === 1 ? "" : "s"}`} />
        <Stat label="Est. graduation" value={est.label ?? "—"} hint={est.remainingAfterCurrent === 0 ? "Degree complete on plan" : `${est.remainingAfterCurrent} credits after this term`} />
      </div>

      <div className="card space-y-3 p-4">
        <div className="relative"><Progress value={projectedPct} tone="good" label="Projected degree progress" /></div>
        <Progress value={pct} label="Completed degree progress" thin />
        <p className="text-xs text-ink-muted">{pct.toFixed(0)}% completed · {projectedPct.toFixed(0)}% if this semester goes to plan</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Total credits required for degree">{(id) => <input id={id} type="number" min={1} className="input" defaultValue={settings.degreeCredits} onBlur={(e) => { const v = Number(e.target.value); if (v > 0) update({ degreeCredits: v }); }} />}</Field>
          <Field label="Typical credits per future semester" hint="Used to estimate graduation beyond what you've planned.">{(id) => <input id={id} type="number" min={1} className="input" defaultValue={per} onBlur={(e) => { const v = Number(e.target.value); if (v > 0) update({ creditsPerSemester: v }); }} />}</Field>
        </div>
      </div>

      <Section title="Semester timeline">
        {timeline.length === 0 ? (
          <div className="card"><EmptyState icon={Map} title="No semesters yet" message="Add your semesters and plan future courses to see your academic journey." action={<button className="btn btn-primary" onClick={() => setEditingSem("new")}>Add semester</button>} /></div>
        ) : <SemesterTimeline entries={timeline} onSelect={(e) => { const sem = semesters.find((x) => x.id === e.semesterId); if (sem) setEditingSem(sem); }} />}
      </Section>

      {sortedFuture.length > 0 && (
        <Section title="Planned semesters">
          <div className="space-y-3">
            {sortedFuture.map((f) => (
              <div key={f.key} className="card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="font-semibold">{f.label}</p>
                  <p className="text-sm text-ink-muted">{f.credits} credits{workloadWarn(f.credits) && <span className="ml-2 text-warn">· {workloadWarn(f.credits)}</span>}</p>
                </div>
                <ul className="divide-y divide-border">
                  {f.plannedCourses.map((p) => (
                    <li key={p.id} className="flex items-center justify-between pl-4">
                      <span className="py-3 text-sm"><span className="font-medium">{p.code}</span>{p.title !== p.code && <span className="text-ink-muted"> · {p.title}</span>}{p.isRetake && <span className="ml-1.5 text-xs text-warn">retake</span>}</span>
                      <span className="flex items-center"><span className="text-sm text-ink-muted">{p.credits} cr</span><button className="icon-btn" onClick={() => setEditingPlanned(p)} aria-label={`Edit ${p.code}`}><Pencil size={15} /></button></span>
                    </li>
                  ))}
                </ul>
                <button className="btn btn-ghost btn-sm m-2" onClick={() => quick.open("planned-course", { planned: { term: f.term, year: f.year } })}><Plus size={14} /> Add course to {f.label}</button>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="GPA scenarios">
        <div className="card space-y-5 p-4">
          <div>
            <p className="mb-1 text-sm font-semibold">What GPA do I need?</p>
            <Field label={`Target CGPA: ${targetVal.toFixed(2)}`}>{(id) => <input id={id} type="range" min={2} max={4} step={0.05} className="w-full accent-[rgb(var(--accent))]" value={targetVal} onChange={(e) => setTarget(Number(e.target.value))} />}</Field>
            <p className="mt-1 text-sm">{profile.remainingCredits === 0 ? "No credits remaining." : req.achievable ? <>Average <b className="tabular">{Math.max(0, req.required).toFixed(2)}</b> across your remaining {profile.remainingCredits} credits.</> : <span className="text-bad">Not reachable — it would need {req.required.toFixed(2)}, above 4.00.</span>}</p>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">What if I keep a steady GPA?</p>
            <Field label={`GPA each planned term: ${scenarioGpa.toFixed(2)}`}>{(id) => <input id={id} type="range" min={2} max={4} step={0.05} className="w-full accent-[rgb(var(--accent))]" value={scenarioGpa} onChange={(e) => setScenarioGpa(Number(e.target.value))} />}</Field>
            {roadmap.length === 0 ? <p className="text-sm text-ink-muted">Register credits for this semester or plan future courses to see a projection.</p> : (
              <ul className="mt-2 divide-y divide-border rounded-xl bg-surface-sunken/40">
                {roadmap.map((r) => <li key={r.label} className="flex items-center justify-between px-3 py-2 text-sm"><span>After {r.label}</span><b className="tabular">CGPA {r.projectedCGPA.toFixed(2)}</b></li>)}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-ink-muted">Projection only — it multiplies the flat GPA by each term&apos;s credits and blends it with your official CGPA.</p>
          </div>
        </div>
      </Section>

      {editingPlanned && <PlannedCourseForm open initial={editingPlanned} onClose={() => setEditingPlanned(null)} />}
      {editingSem && <SemesterForm open initial={editingSem === "new" ? undefined : editingSem} onClose={() => setEditingSem(null)} />}
    </div>
  );
}
