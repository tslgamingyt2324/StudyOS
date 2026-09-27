"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { db } from "@/db/db";
import SubTabs from "@/components/SubTabs";
import StatCard from "@/components/StatCard";

export default function StudyAnalyticsPage() {
  const allSessions = useLiveQuery(() => db.studySessions.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const completed = allSessions.filter((s) => s.completed);
  const goalMinutes = settings?.dailyStudyGoalMinutes || 240;

  const byDay = new Map<string, number>();
  for (const s of completed) {
    const key = s.startedAt.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + s.actualMinutes);
  }

  const totalMinutes = completed.reduce((sum, s) => sum + s.actualMinutes, 0);
  const daysWithData = byDay.size;
  const avgDailyMinutes = daysWithData ? totalMinutes / daysWithData : 0;
  const longestSession = completed.reduce((max, s) => Math.max(max, s.actualMinutes), 0);

  const now = new Date();
  const weekCutoff = new Date(now); weekCutoff.setDate(now.getDate() - 6);
  const monthCutoff = new Date(now); monthCutoff.setDate(now.getDate() - 29);
  const weeklyMinutes = completed.filter((s) => new Date(s.startedAt) >= weekCutoff).reduce((sum, s) => sum + s.actualMinutes, 0);
  const monthlyMinutes = completed.filter((s) => new Date(s.startedAt) >= monthCutoff).reduce((sum, s) => sum + s.actualMinutes, 0);

  // Streaks: consecutive days (ending today) meeting the daily goal.
  const metGoalDays = new Set([...byDay.entries()].filter(([, m]) => m >= goalMinutes).map(([d]) => d));
  let currentStreak = 0;
  { const d = new Date(); while (metGoalDays.has(d.toISOString().slice(0, 10))) { currentStreak++; d.setDate(d.getDate() - 1); } }

  let longestStreak = 0, running = 0;
  const sortedDays = [...byDay.keys()].sort();
  for (let i = 0; i < sortedDays.length; i++) {
    if (metGoalDays.has(sortedDays[i])) {
      running = i > 0 && isConsecutive(sortedDays[i - 1], sortedDays[i]) ? running + 1 : 1;
      longestStreak = Math.max(longestStreak, running);
    } else running = 0;
  }
  function isConsecutive(a: string, b: string) {
    const d1 = new Date(a), d2 = new Date(b);
    return (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24) === 1;
  }

  const goalCompletionRate = daysWithData ? Math.round((metGoalDays.size / daysWithData) * 100) : 0;

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { label: d.toLocaleDateString(undefined, { weekday: "short" }), minutes: byDay.get(key) ?? 0 };
  });
  const maxBar = Math.max(goalMinutes, ...last7.map((d) => d.minutes), 1);

  return (
    <div className="px-4 pt-4 space-y-5">
      <h1 className="text-2xl font-bold">Study</h1>
      <SubTabs tabs={[
        { href: "/study/timer", label: "Timer" },
        { href: "/study/records", label: "Daily Records" },
        { href: "/study/analytics", label: "Analytics" },
      ]} />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="This Week" value={weeklyMinutes / 60} decimals={1} sublabel="hours studied" delay={0} />
        <StatCard label="This Month" value={monthlyMinutes / 60} decimals={1} sublabel="hours studied" delay={0.05} />
        <StatCard label="Daily Average" value={avgDailyMinutes / 60} decimals={1} sublabel="hours/day" delay={0.1} />
        <StatCard label="Longest Session" value={longestSession / 60} decimals={1} sublabel="hours" delay={0.15} />
        <StatCard label="Current Streak" value={currentStreak} decimals={0} sublabel="days meeting goal" tone={currentStreak > 0 ? "good" : "default"} delay={0.2} />
        <StatCard label="Longest Streak" value={longestStreak} decimals={0} sublabel="days" delay={0.25} />
      </div>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold text-sm">Goal Completion Rate</h2>
        <p className="text-2xl font-bold text-accent">{goalCompletionRate}%</p>
        <p className="text-xs text-ink-faint">of days with any study time, on {daysWithData} tracked day{daysWithData !== 1 && "s"}</p>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold text-sm">Last 7 Days</h2>
        <div className="flex items-end justify-between gap-2 h-32">
          {last7.map((d, i) => {
            const pct = (d.minutes / maxBar) * 100;
            const met = d.minutes >= goalMinutes;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-ink-faint">{d.minutes > 0 ? `${(d.minutes / 60).toFixed(1)}h` : ""}</span>
                <div className="relative flex h-24 w-full items-end overflow-hidden rounded-lg bg-surface-sunken">
                  <motion.div className={`w-full rounded-lg ${met ? "bg-good" : "bg-accent"}`} initial={{ height: 0 }} animate={{ height: `${pct}%` }} transition={{ duration: 0.5 }} />
                </div>
                <span className="text-[10px] text-ink-faint">{d.label}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
