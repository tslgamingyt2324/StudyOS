"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Flame } from "lucide-react";
import { db } from "@/db/db";
import StatCard from "@/components/StatCard";
import { calculateSemesterGPA } from "@/lib/gpa";
import { getAcademicProfile } from "@/lib/academicProfile";
import { greeting, formatDate, todaysClasses, formatTime12, findScheduleConflicts, deadlineLabel, courseRisk, ordinal } from "@/lib/utils";

export default function DashboardPage() {
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const courses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const semesters = useLiveQuery(() => db.semesters.toArray()) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray()) ?? [];
  const sessions = useLiveQuery(() => db.studySessions.toArray()) ?? [];
  const exams = useLiveQuery(() => db.exams.orderBy("date").toArray()) ?? [];

  if (!settings) return null;

  const currentSemester = semesters.find((s) => s.isCurrent);
  const profile = getAcademicProfile(settings);

  // Semester GPA only counts courses that already have a grade entered —
  // with a brand-new semester that's zero courses, which must read as
  // "Not available", never as a misleading "0.00" (PART 3).
  const gradedThisSemester = currentSemester?.id
    ? courses.filter((c) => c.semesterId === currentSemester.id && c.gpaCounting && c.grade)
    : [];
  const semGpa = currentSemester?.id
    ? calculateSemesterGPA(courses, currentSemester.id, settings.gradeScale, settings)
    : { gpa: 0 };
  const semGpaAvailable = gradedThisSemester.length > 0;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMinutes = sessions
    .filter((s) => s.completed && s.startedAt.slice(0, 10) === todayKey)
    .reduce((sum, s) => sum + s.actualMinutes, 0);
  const goalMinutes = settings.dailyStudyGoalMinutes || 240;
  const goalPct = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));
  const goalMet = todayMinutes >= goalMinutes;

  const today = todaysClasses(courses);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nextClass = today.find((t) => {
    const [h, m] = t.sched.startTime.split(":").map(Number);
    return h * 60 + m > nowMinutes;
  });
  const conflicts = findScheduleConflicts(courses.filter((c) => c.semesterId === currentSemester?.id));

  const upcomingTasks = tasks
    .filter((t) => t.status !== "Completed")
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))
    .slice(0, 3);

  // study streak: consecutive days (including today) with at least one completed session
  const streak = (() => {
    const days = new Set(sessions.filter((s) => s.completed).map((s) => s.startedAt.slice(0, 10)));
    let count = 0;
    const d = new Date();
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) { count++; d.setDate(d.getDate() - 1); } else break;
    }
    return count;
  })();

  const overdueByCourseCount = (courseId?: number) =>
    tasks.filter((t) => t.courseId === courseId && t.status !== "Completed" && t.deadline && new Date(t.deadline) < new Date()).length;

  const studyMinutesLast7 = (courseId?: number) => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return sessions
      .filter((s) => s.courseId === courseId && s.completed && new Date(s.startedAt).getTime() > cutoff)
      .reduce((sum, s) => sum + s.actualMinutes, 0);
  };

  const activeCourses = courses.filter((c) => c.semesterId === currentSemester?.id);
  const risks = activeCourses.map((c) =>
    courseRisk(c, {
      overdueTaskCount: overdueByCourseCount(c.id),
      studyMinutesLast7Days: studyMinutesLast7(c.id),
      attendanceThreshold: settings.attendanceThreshold,
    })
  );

  return (
    <div className="px-4 pt-4 space-y-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p className="text-sm text-ink-muted">{formatDate()} · {ordinal(profile.semesterNumber)} Semester</p>
        <h1 className="text-2xl font-bold">{greeting()}, {settings.userName} 👋</h1>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="CGPA" value={profile.officialCGPA} sublabel={settings.targetCGPA ? `Target ${settings.targetCGPA.toFixed(2)}` : undefined} delay={0.05} />
        <StatCard
          label="Semester GPA"
          value={semGpa.gpa}
          textOverride={semGpaAvailable ? undefined : "Not available"}
          sublabel={currentSemester?.label}
          delay={0.1}
        />
        <StatCard label="Completed Credits" value={profile.completedCredits} decimals={0} sublabel="toward degree" delay={0.15} />
        <StatCard label="Study Streak" value={streak} decimals={0} icon={Flame} sublabel="days in a row" tone={streak > 0 ? "good" : "default"} delay={0.2} />
      </div>

      <section className="card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Today's Study Goal</h2>
          <span className={`text-xs font-semibold ${goalMet ? "text-good" : "text-ink-muted"}`}>
            {(todayMinutes / 60).toFixed(1)}h / {(goalMinutes / 60).toFixed(0)}h
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-sunken">
          <motion.div
            className={`h-full rounded-full ${goalMet ? "bg-good" : "bg-accent"}`}
            initial={{ width: 0 }}
            animate={{ width: `${goalPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <p className="text-xs text-ink-faint">
          {goalMet ? "Goal reached today — great work." : `${Math.max(0, Math.round((goalMinutes - todayMinutes) / 60 * 10) / 10)}h left to hit today's ${(goalMinutes/60).toFixed(0)}-hour goal.`}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">TODAY</h2>
        {nextClass && (
          <div className="mb-2 rounded-xl bg-accent-soft px-4 py-2.5">
            <p className="text-[11px] font-semibold text-accent">NEXT CLASS</p>
            <p className="text-sm font-medium">{nextClass.course.code} at {formatTime12(nextClass.sched.startTime)} · {nextClass.course.room ?? "Room TBA"}</p>
          </div>
        )}
        <div className="card divide-y divide-border overflow-hidden">
          {today.length === 0 && (
            <p className="p-4 text-sm text-ink-faint">No classes scheduled today. Enjoy the free day.</p>
          )}
          {today.map(({ course, sched }, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="w-16 shrink-0 text-sm font-semibold">{formatTime12(sched.startTime)}</div>
              <div className="flex-1">
                <p className="font-medium">{course.code} · {course.title}</p>
                <p className="text-xs text-ink-faint">{course.room ?? "Room TBA"}</p>
              </div>
            </div>
          ))}
          {conflicts.length > 0 && (
            <div className="flex items-center gap-2 bg-bad/10 p-3 text-xs text-bad">
              <AlertTriangle size={14} />
              Schedule conflict: {conflicts[0].courseA} overlaps {conflicts[0].courseB} on {conflicts[0].day}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-muted">UPCOMING DEADLINES</h2>
          <Link href="/planner/tasks" className="flex items-center text-xs text-accent">See all <ChevronRight size={14} /></Link>
        </div>
        <div className="card divide-y divide-border overflow-hidden">
          {upcomingTasks.length === 0 && <p className="p-4 text-sm text-ink-faint">Nothing due. You're clear.</p>}
          {upcomingTasks.map((t) => {
            const dl = deadlineLabel(t.deadline);
            const color = dl.urgency === "overdue" ? "text-bad" : dl.urgency === "today" || dl.urgency === "soon" ? "text-warn" : "text-ink-faint";
            return (
              <div key={t.id} className="flex items-center justify-between p-4">
                <span className="font-medium">{t.title}</span>
                <span className={`text-xs font-semibold ${color}`}>{dl.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-muted">UPCOMING EXAMS</h2>
          <Link href="/planner/exams" className="flex items-center text-xs text-accent">See all <ChevronRight size={14} /></Link>
        </div>
        <div className="card divide-y divide-border overflow-hidden">
          {exams.filter((e) => new Date(e.date) >= new Date(new Date().toDateString())).slice(0, 3).length === 0 && (
            <p className="p-4 text-sm text-ink-faint">No exams scheduled yet.</p>
          )}
          {exams.filter((e) => new Date(e.date) >= new Date(new Date().toDateString())).slice(0, 3).map((e) => {
            const c = courses.find((cc) => cc.id === e.courseId);
            const dl = deadlineLabel(e.date);
            const color = dl.urgency === "today" || dl.urgency === "soon" ? "text-warn" : "text-ink-faint";
            return (
              <div key={e.id} className="flex items-center justify-between p-4">
                <span className="font-medium">{c?.code} · {e.title}</span>
                <span className={`text-xs font-semibold ${color}`}>{dl.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">ACADEMIC HEALTH</h2>
        <div className="card divide-y divide-border overflow-hidden">
          {risks.map((r) => (
            <Link key={r.courseId} href={`/academics/courses/${r.courseId}`} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{r.code}</p>
                <p className="text-xs text-ink-faint">{r.reasons[0]}</p>
              </div>
              <span className={`h-2.5 w-2.5 rounded-full ${r.level === "good" ? "bg-good" : r.level === "warn" ? "bg-warn" : "bg-bad"}`} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
