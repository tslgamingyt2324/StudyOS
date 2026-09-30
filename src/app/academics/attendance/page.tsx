"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, UserCheck, Trash2 } from "lucide-react";
import { db } from "@/db/db";
import { useSettings } from "@/hooks/useSettings";
import { useCourses } from "@/hooks/useCourses";
import { useAttendance } from "@/hooks/useAttendance";
import { useQuickAdd } from "@/components/shell/QuickAdd";
import { Badge, EmptyState, PageHeader, PageSkeleton, Section } from "@/components/ui";
import AttendanceCard from "@/components/academic/AttendanceCard";
import { dateKey, longDate, shortDate } from "@/lib/dates";

export default function AttendancePage() {
  const { settings } = useSettings();
  const { currentCourses, currentSemester, byId, loading } = useCourses();
  const threshold = settings?.attendanceThreshold ?? 70;
  const att = useAttendance(currentCourses, threshold);
  const quick = useQuickAdd();
  const [date, setDate] = useState(dateKey());

  if (loading || !settings || att.loading) return <PageSkeleton />;
  const ids = new Set(currentCourses.map((c) => c.id));
  const recent = att.records.filter((r) => ids.has(r.courseId)).sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)).slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance" subtitle={currentSemester ? `${currentSemester.label} · default requirement ${threshold}%` : undefined}
        actions={<button className="btn btn-secondary" onClick={() => quick.open("attendance")}><Plus size={16} /> Log attendance</button>}
      />
      {currentCourses.length === 0 ? (
        <div className="card"><EmptyState icon={UserCheck} title="No courses to track" message="Add a course to start tracking attendance." action={<Link href="/academics/courses" className="btn btn-primary">Go to courses</Link>} /></div>
      ) : (
        <>
          <div className="card flex flex-wrap items-center gap-3 p-3">
            <label htmlFor="att-date" className="text-sm font-medium">Logging for</label>
            <input id="att-date" type="date" className="input !w-auto" max={dateKey()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <span className="text-xs text-ink-muted">{date === dateKey() ? "Today" : longDate(date)} · tap a button on any course. Excused classes don&apos;t count for or against you.</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {currentCourses.map((c) => <AttendanceCard key={c.id} course={c} records={att.records} threshold={threshold} date={date} />)}
          </div>
          <Section title="Recent entries">
            {recent.length === 0 ? <p className="text-sm text-ink-muted">Nothing logged yet.</p> : (
              <div className="card divide-y divide-border">
                {recent.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 pl-4">
                    <span className="py-3 text-sm"><span className="font-medium">{byId(r.courseId)?.code}</span> <span className="text-ink-muted">· {shortDate(r.date)}</span></span>
                    <span className="flex items-center gap-1">
                      <Badge tone={r.status === "Present" ? "good" : r.status === "Absent" ? "bad" : "accent"}>{r.status}</Badge>
                      <button className="icon-btn" aria-label={`Delete ${byId(r.courseId)?.code} entry for ${r.date}`} onClick={() => db.attendance.delete(r.id!)}><Trash2 size={15} /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
