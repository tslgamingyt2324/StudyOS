"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db } from "@/db/db";
import { gradeColor } from "@/lib/gpa";

export default function CoursesPage() {
  const courses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const semesters = useLiveQuery(() => db.semesters.toArray()) ?? [];

  return (
    <div className="px-4 pt-4 space-y-6">
      <h1 className="text-2xl font-bold">Courses</h1>
      {[...semesters].reverse().map((s) => (
        <section key={s.id}>
          <h2 className="mb-2 text-sm font-semibold text-ink-muted">{s.label.toUpperCase()}</h2>
          <div className="card divide-y divide-border overflow-hidden">
            {courses.filter((c) => c.semesterId === s.id).map((c) => (
              <Link key={c.id} href={`/academics/courses/${c.id}`} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{c.code} {c.isRetake && <span className="ml-1 rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-warn">RETAKE</span>}</p>
                  <p className="text-xs text-ink-faint">{c.title} · {c.credits} cr</p>
                </div>
                <span className={`text-sm font-bold ${gradeColor(c.grade)}`}>{c.grade || "—"}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
