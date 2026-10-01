"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Course } from "@/types";
import { AttendanceStats } from "@/lib/attendance";
import { Badge } from "@/components/ui";
import { formatClassRange } from "@/lib/classTime";
import { gradeColor } from "@/lib/gpa";
import { WEEKDAY_SHORT, WEEKDAY_LONG } from "@/lib/stats";

export default function CourseCard({ course, attendance, studyLabel }: { course: Course; attendance?: AttendanceStats; studyLabel?: string }) {
  const first = course.schedule[0];
  const days = first ? first.days.map((d) => WEEKDAY_SHORT[WEEKDAY_LONG.indexOf(d)] ?? d.slice(0, 3)).join(" ") : "";
  return (
    <Link href={`/academics/courses/${course.id}`} className="card block p-4 transition hover:bg-surface-sunken/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold">{course.code}</p>
            {course.isRetake && <Badge tone="warn">Retake</Badge>}
            {!course.gpaCounting && <Badge>No GPA</Badge>}
          </div>
          <p className="truncate text-sm text-ink-muted">{course.title}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {course.grade ? <span className={`text-lg font-bold ${gradeColor(course.grade)}`}>{course.grade}</span> : <span className="text-xs text-ink-muted">Ungraded</span>}
          <ChevronRight size={16} className="text-ink-faint" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span>{course.credits} cr</span>
        {first && <span>{days} · {formatClassRange(first)}</span>}
        {attendance?.percentage != null && <span className={attendance.status === "risk" ? "font-semibold text-bad" : attendance.status === "warning" ? "text-warn" : ""}>Attendance {attendance.percentage.toFixed(0)}%</span>}
        {studyLabel && <span>{studyLabel} studied</span>}
      </div>
    </Link>
  );
}
