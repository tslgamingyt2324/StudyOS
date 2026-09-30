"use client";
import { useMemo, useState } from "react";
import { Plus, BookOpen, Search } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useCourses } from "@/hooks/useCourses";
import { useAttendance } from "@/hooks/useAttendance";
import { useStudySessions } from "@/hooks/useStudy";
import { byCourse } from "@/lib/stats";
import { formatMinutes } from "@/lib/dates";
import { EmptyState, PageHeader, PageSkeleton, Section } from "@/components/ui";
import CourseCard from "@/components/academic/CourseCard";
import CourseForm from "@/components/forms/CourseForm";

export default function CoursesPage() {
  const { settings } = useSettings();
  const { courses, semesters, currentSemester, currentCourses, loading } = useCourses();
  const att = useAttendance(courses, settings?.attendanceThreshold ?? 70);
  const { sessions } = useStudySessions();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const perCourse = useMemo(() => byCourse(sessions), [sessions]);

  if (loading || !settings) return <PageSkeleton />;
  const match = (c: (typeof courses)[number]) => !q || `${c.code} ${c.title} ${c.faculty}`.toLowerCase().includes(q.toLowerCase());
  const past = semesters.filter((s) => !s.isCurrent).sort((a, b) => b.year - a.year || b.term.localeCompare(a.term));

  return (
    <div className="space-y-6">
      <PageHeader title="Courses" subtitle={currentSemester ? currentSemester.label : undefined} actions={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Add course</button>} />
      {courses.length === 0 ? (
        <div className="card"><EmptyState icon={BookOpen} title="No courses yet" message="Add your first course to start building your academic dashboard." action={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add course</button>} /></div>
      ) : (
        <>
          {courses.length > 6 && (
            <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" /><input className="input pl-9" aria-label="Filter courses" placeholder="Filter courses" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          )}
          <Section title="This semester">
            {currentCourses.filter(match).length === 0 ? <p className="text-sm text-ink-muted">{currentCourses.length ? "No matches." : "No courses in the current semester yet."}</p> : (
              <div className="grid gap-3 md:grid-cols-2">
                {currentCourses.filter(match).map((c) => <CourseCard key={c.id} course={c} attendance={att.stats.get(c.id!)} studyLabel={perCourse.get(c.id!) ? formatMinutes(perCourse.get(c.id!)!) : undefined} />)}
              </div>
            )}
          </Section>
          {past.map((s) => {
            const list = courses.filter((c) => c.semesterId === s.id && match(c));
            if (!list.length) return null;
            return (
              <Section key={s.id} title={s.label}>
                <div className="grid gap-3 md:grid-cols-2">{list.map((c) => <CourseCard key={c.id} course={c} />)}</div>
              </Section>
            );
          })}
        </>
      )}
      {adding && <CourseForm open onClose={() => setAdding(false)} />}
    </div>
  );
}
