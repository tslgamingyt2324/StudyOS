"use client";
import { useMemo } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useNow } from "@/hooks/useNow";
import { useCourses } from "@/hooks/useCourses";
import { useTasks } from "@/hooks/useTasks";
import { useExams } from "@/hooks/useExams";
import { useAttendance } from "@/hooks/useAttendance";
import { useStudyStats } from "@/hooks/useStudy";
import { useGoals } from "@/hooks/useGoals";
import { useNotes } from "@/hooks/useNotes";
import { buildAlerts } from "@/lib/alerts";
import { buildInsights } from "@/lib/stats";
import { calculateSemesterGPA } from "@/lib/gpa";
import { getAcademicProfile, getSemesterCreditBreakdown } from "@/lib/academicProfile";
import { todaysClasses, nextClassAcrossWeek } from "@/lib/utils";

/** Everything the dashboard needs, computed once per data change. */
export function useDashboard() {
  const { settings } = useSettings();
  const c = useCourses();
  const t = useTasks();
  const e = useExams();
  const att = useAttendance(c.currentCourses, settings?.attendanceThreshold ?? 70);
  const study = useStudyStats(settings?.dailyStudyGoalMinutes ?? 0, settings?.weekStartsOn ?? 0);
  const g = useGoals({ settings, courses: c.courses, sessions: study.sessions, tasks: t.tasks, attendance: att.stats });
  const n = useNotes();
  const now = useNow();

  const loading = !settings || c.loading || t.loading || e.loading || att.loading || study.loading || g.loading || n.loading;

  const data = useMemo(() => {
    if (!settings || loading) return null;
    const profile = getAcademicProfile(settings);
    const sem = c.currentSemester;
    const graded = sem?.id ? c.courses.filter((x) => x.semesterId === sem.id && x.gpaCounting && x.grade) : [];
    const semGpa = sem?.id && graded.length ? calculateSemesterGPA(c.courses, sem.id, settings.gradeScale, settings).gpa : null;
    const credit = getSemesterCreditBreakdown(profile, c.currentCourses, sem?.registeredCredits ?? 0);
    const alerts = buildAlerts({
      now, settings, courses: c.currentCourses, tasks: t.tasks, exams: e.exams, attendance: att.stats,
      todayStudyMinutes: study.todayMinutes, behindGoals: g.active.filter((x) => x.behind).map((x) => x.goal),
    });
    const insights = buildInsights({
      sessions: study.sessions, courses: c.currentCourses, exams: e.exams, goals: g.active.map((x) => ({ goal: x.goal, percent: x.progress.percent })),
      dailyGoalMinutes: settings.dailyStudyGoalMinutes, weekStartsOn: settings.weekStartsOn ?? 0, today: now,
    });
    return {
      now, settings, profile, semester: c.currentSemester, semGpa, credit, alerts, insights,
      today: todaysClasses(c.currentCourses, now),
      next: nextClassAcrossWeek(c.currentCourses, now),
      courses: c.currentCourses, allCourses: c.courses, byId: c.byId,
      tasks: t.open, exams: e.upcoming, attendance: att.stats, study, goals: g.active, notes: n.active,
    };
  }, [settings, loading, now, c, t, e, att.stats, study, g.active, n.active]);

  return { loading, data };
}
