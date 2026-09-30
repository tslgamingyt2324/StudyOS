"use client";
import { useMemo, useState } from "react";
import { BarChart3, Lightbulb } from "lucide-react";
import { useStudySessions } from "@/hooks/useStudy";
import { useCourses } from "@/hooks/useCourses";
import { useSettings } from "@/hooks/useSettings";
import { useExams } from "@/hooks/useExams";
import { useQuickAdd } from "@/components/shell/QuickAdd";
import { BarChart, HBar } from "@/components/study/BarChart";
import { EmptyState, PageHeader, PageSkeleton, Section, Segmented, Stat } from "@/components/ui";
import { addDays, dateKey, formatMinutes } from "@/lib/dates";
import { buildInsights, byActivity, byCourse, byMonth, byWeekday, lastNDays, minutesByDay, summarize, WEEKDAY_SHORT, sessionsBetween, MIN_SESSIONS_FOR_PATTERNS } from "@/lib/stats";

type Range = "7 days" | "30 days" | "All time";

export default function AnalyticsPage() {
  const { completed, loading } = useStudySessions();
  const { currentCourses, byId } = useCourses();
  const { settings } = useSettings();
  const { upcoming } = useExams();
  const quick = useQuickAdd();
  const [range, setRange] = useState<Range>("30 days");

  const view = useMemo(() => {
    if (!settings) return null;
    const now = new Date();
    const from = range === "7 days" ? dateKey(addDays(now, -6)) : range === "30 days" ? dateKey(addDays(now, -29)) : "0000-00-00";
    const scoped = sessionsBetween(completed, from, dateKey(now));
    const daily = lastNDays(minutesByDay(completed), 30, now);
    return {
      scoped, summary: summarize(scoped, settings.dailyStudyGoalMinutes, now), overall: summarize(completed, settings.dailyStudyGoalMinutes, now), daily,
      weekday: byWeekday(scoped), months: byMonth(completed, 6, now), courseMap: byCourse(scoped), activity: byActivity(scoped),
      insights: buildInsights({ sessions: completed, courses: currentCourses, exams: upcoming, dailyGoalMinutes: settings.dailyStudyGoalMinutes, weekStartsOn: settings.weekStartsOn ?? 0, today: now }),
    };
  }, [completed, settings, range, currentCourses, upcoming]);

  if (loading || !settings || !view) return <PageSkeleton />;
  if (completed.length === 0) {
    return (
      <div className="space-y-6"><PageHeader title="Analytics" />
        <div className="card"><EmptyState icon={BarChart3} title="No data yet" message="Complete a study session and your time, streaks and patterns will appear here." action={<button className="btn btn-primary" onClick={() => quick.open("study-log")}>Log a session</button>} /></div></div>
    );
  }
  const { summary: s, overall } = view;
  const goal = settings.dailyStudyGoalMinutes;
  const courseRows = [...view.courseMap.entries()].map(([id, m]) => ({ id, m, label: id === "none" ? "No course" : byId(id)?.code ?? "Deleted course" })).sort((a, b) => b.m - a.m);
  const actRows = [...view.activity.entries()].sort((a, b) => b[1] - a[1]);
  const peakDay = Math.max(...view.weekday);
  const enough = overall.sessionCount >= MIN_SESSIONS_FOR_PATTERNS;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Everything below is calculated on this device from your own sessions." actions={<Segmented label="Range" value={range} options={["7 days", "30 days", "All time"] as const} onChange={setRange} />} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total study time" value={formatMinutes(s.totalMinutes)} hint={range} />
        <Stat label="Sessions" value={s.sessionCount} hint={s.sessionCount ? `Avg ${formatMinutes(s.avgSessionMinutes)}` : undefined} />
        <Stat label="Longest session" value={formatMinutes(s.longestSessionMinutes)} />
        <Stat label="Goal completion" value={s.activeDays ? `${s.goalCompletionRate}%` : "—"} hint={s.activeDays ? `${s.goalDaysMet} of ${s.activeDays} study days` : undefined} />
        <Stat label="Current streak" value={`${overall.currentStreak}d`} />
        <Stat label="Best streak" value={`${overall.bestStreak}d`} />
        <Stat label="Most productive day" value={overall.mostProductiveDay ?? "—"} hint={overall.mostProductiveDay ? undefined : `Needs ${MIN_SESSIONS_FOR_PATTERNS}+ sessions`} />
        <Stat label="Most productive time" value={overall.mostProductiveTime ?? "—"} hint={overall.mostProductiveTime ? undefined : `Needs ${MIN_SESSIONS_FOR_PATTERNS}+ sessions`} />
      </div>

      {view.insights.length > 0 && (
        <Section title="Insights">
          <ul className="card space-y-2.5 p-4">{view.insights.map((i) => <li key={i.id} className="flex items-start gap-2.5 text-sm"><Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />{i.text}</li>)}</ul>
          <p className="mt-1 text-[11px] text-ink-faint">Rule-based and calculated from your data. Pattern insights appear once you have enough sessions.</p>
        </Section>
      )}

      <Section title="Daily · last 30 days">
        <div className="card p-4"><BarChart caption="Study time per day for the last 30 days" goal={goal || undefined} bars={view.daily.map((d, i) => ({ label: i % 5 === 4 || i === 0 ? String(d.date.getDate()) : "", value: d.minutes, highlight: d.key === dateKey() }))} />
          {goal > 0 && <p className="mt-2 text-[11px] text-ink-muted">Dashed line = your daily goal ({formatMinutes(goal)}).</p>}</div>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title={`By weekday · ${range}`}>
          <div className="card p-4"><BarChart caption="Study time by weekday" bars={view.weekday.map((m, i) => ({ label: WEEKDAY_SHORT[i], value: m, highlight: enough && m === peakDay && m > 0 }))} /></div>
        </Section>
        <Section title="By month">
          <div className="card p-4"><BarChart caption="Study time by month" bars={view.months.map((m, i) => ({ label: m.label, value: m.minutes, highlight: i === view.months.length - 1 }))} /></div>
        </Section>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title={`By course · ${range}`}>
          <div className="card space-y-3 p-4">{courseRows.length === 0 ? <p className="text-sm text-ink-muted">No sessions in this range.</p> : courseRows.map((r) => <HBar key={r.id} label={r.label} value={r.m} max={courseRows[0].m} />)}</div>
        </Section>
        <Section title={`By activity · ${range}`}>
          <div className="card space-y-3 p-4">{actRows.length === 0 ? <p className="text-sm text-ink-muted">No sessions in this range.</p> : actRows.map(([k, m]) => <HBar key={k} label={k} value={m} max={actRows[0][1]} />)}</div>
        </Section>
      </div>
    </div>
  );
}
