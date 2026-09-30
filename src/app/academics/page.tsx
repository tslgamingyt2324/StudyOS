"use client";
import Link from "next/link";
import { useMemo } from "react";
import { BookOpen, Calculator, GraduationCap, Map, RefreshCcw, UserCheck, ChevronRight } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useCourses } from "@/hooks/useCourses";
import { useAttendance } from "@/hooks/useAttendance";
import { db } from "@/db/db";
import { useLiveQuery } from "dexie-react-hooks";
import { getAcademicProfile, getSemesterCreditBreakdown } from "@/lib/academicProfile";
import { buildTimeline } from "@/lib/degree";
import { calculateSemesterGPA } from "@/lib/gpa";
import { EmptyState, PageHeader, PageSkeleton, Progress, Section, Stat, Badge } from "@/components/ui";
import SemesterTimeline from "@/components/academic/SemesterTimeline";
import { useQuickAdd } from "@/components/shell/QuickAdd";

export default function AcademicsOverview() {
  const { settings } = useSettings();
  const { courses, semesters, currentSemester, currentCourses, loading } = useCourses();
  const att = useAttendance(currentCourses, settings?.attendanceThreshold ?? 70);
  const planned = useLiveQuery(() => db.plannedCourses.toArray());
  const quick = useQuickAdd();

  const timeline = useMemo(() => (settings && planned ? buildTimeline(semesters, courses, planned, settings) : []), [settings, semesters, courses, planned]);

  if (loading || !settings || !planned) return <PageSkeleton />;
  const profile = getAcademicProfile(settings);
  const credit = getSemesterCreditBreakdown(profile, currentCourses, currentSemester?.registeredCredits ?? 0);
  const semGpa = currentSemester?.id && currentCourses.some((c) => c.gpaCounting && c.grade) ? calculateSemesterGPA(courses, currentSemester.id, settings.gradeScale, settings).gpa : null;
  const pct = profile.degreeCredits ? (profile.completedCredits / profile.degreeCredits) * 100 : 0;
  const risky = currentCourses.filter((c) => ["risk", "warning"].includes(att.stats.get(c.id!)?.status ?? ""));

  const links = [
    { href: "/academics/courses", label: "Courses", icon: BookOpen, hint: `${currentCourses.length} this semester` },
    { href: "/academics/gpa", label: "GPA / CGPA", icon: Calculator, hint: "Scenarios & targets" },
    { href: "/academics/attendance", label: "Attendance", icon: UserCheck, hint: risky.length ? `${risky.length} need attention` : "Track every class" },
    { href: "/academics/retakes", label: "Retakes", icon: RefreshCcw, hint: "Improve past grades" },
    { href: "/academics/degree", label: "Degree Planner", icon: Map, hint: "Plan future semesters" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Academics" subtitle={currentSemester ? `${currentSemester.label} · Semester ${profile.semesterNumber}` : "Your academic overview"} />

      {semesters.length === 0 ? (
        <div className="card"><EmptyState icon={GraduationCap} title="No semester yet" message="Add your current semester to start tracking courses, attendance and GPA." action={<button className="btn btn-primary" onClick={() => quick.open("semester")}>Add semester</button>} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="CGPA" value={profile.officialCGPA > 0 ? profile.officialCGPA.toFixed(2) : "—"} hint={settings.targetCGPA ? `Target ${settings.targetCGPA.toFixed(2)}` : undefined} />
            <Stat label="Semester GPA" value={semGpa === null ? "—" : semGpa.toFixed(2)} hint={semGpa === null ? "No grades yet" : currentSemester?.label} />
            <Stat label="Credits done" value={profile.completedCredits} hint={`of ${profile.degreeCredits}`} />
            <Stat label="Remaining" value={profile.remainingCredits} hint={credit.newDegreeCredits ? `${credit.remainingCreditsAfter} after this semester` : undefined} />
          </div>

          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Degree progress</p><span className="text-sm tabular text-ink-muted">{pct.toFixed(0)}%</span></div>
            <Progress value={pct} label="Degree progress" />
            <p className="mt-2 text-xs text-ink-muted">Your official CGPA and completed credits are stored values from your transcript — edit them in Settings.</p>
          </div>

          {risky.length > 0 && (
            <div className="card divide-y divide-border">
              {risky.map((c) => { const a = att.stats.get(c.id!)!; return (
                <Link key={c.id} href="/academics/attendance" className="row-link">
                  <span className="text-sm font-medium">{c.code} attendance</span>
                  <span className="flex items-center gap-2"><span className="text-sm font-semibold tabular">{a.percentage!.toFixed(0)}%</span><Badge tone={a.status === "risk" ? "bad" : "warn"}>{a.status === "risk" ? "At risk" : "Close"}</Badge></span>
                </Link>); })}
            </div>
          )}
        </>
      )}

      <Section title="Explore">
        <div className="card divide-y divide-border overflow-hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="row-link">
              <span className="flex items-center gap-3"><l.icon size={18} className="text-accent" aria-hidden="true" /><span><span className="block text-sm font-medium">{l.label}</span><span className="block text-xs text-ink-muted">{l.hint}</span></span></span>
              <ChevronRight size={16} className="text-ink-faint" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Section>

      {timeline.length > 0 && (
        <Section title="Academic journey" action={<Link href="/academics/degree" className="text-xs font-medium text-accent">Plan ahead</Link>}>
          <SemesterTimeline entries={timeline} />
        </Section>
      )}
    </div>
  );
}
