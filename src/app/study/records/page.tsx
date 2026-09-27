"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { db } from "@/db/db";
import SubTabs from "@/components/SubTabs";
import { cn } from "@/lib/utils";

export default function DailyRecordsPage() {
  const allSessions = useLiveQuery(() => db.studySessions.toArray()) ?? [];
  const courses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [expanded, setExpanded] = useState<string | null>(null);

  const completed = allSessions.filter((s) => s.completed);
  const goalMinutes = settings?.dailyStudyGoalMinutes || 240;

  const byDay = new Map<string, typeof completed>();
  for (const s of completed) {
    const key = s.startedAt.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }
  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="px-4 pt-4 space-y-4">
      <h1 className="text-2xl font-bold">Study</h1>
      <SubTabs tabs={[
        { href: "/study/timer", label: "Timer" },
        { href: "/study/records", label: "Daily Records" },
        { href: "/study/analytics", label: "Analytics" },
      ]} />

      <div className="space-y-2">
        {days.length === 0 && <p className="py-8 text-center text-sm text-ink-faint">No study history yet — sessions you complete will show up here, day by day.</p>}
        {days.map((day) => {
          const daySessions = byDay.get(day)!;
          const total = daySessions.reduce((sum, s) => sum + s.actualMinutes, 0);
          const pct = Math.min(100, Math.round((total / goalMinutes) * 100));
          const met = total >= goalMinutes;
          const uniqueCourses = [...new Set(daySessions.map((s) => s.courseId).filter(Boolean))];
          const isOpen = expanded === day;
          const dateLabel = new Date(day + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

          return (
            <div key={day} className="card overflow-hidden">
              <button onClick={() => setExpanded(isOpen ? null : day)} className="flex w-full items-center justify-between p-4">
                <div className="text-left">
                  <p className="font-semibold text-sm">{dateLabel}</p>
                  <p className="text-xs text-ink-faint">{daySessions.length} session{daySessions.length !== 1 && "s"} · {uniqueCourses.length} course{uniqueCourses.length !== 1 && "s"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={cn("text-sm font-bold", met ? "text-good" : "text-ink")}>{(total / 60).toFixed(1)}h / {(goalMinutes / 60).toFixed(0)}h</p>
                    <p className={cn("text-[11px] flex items-center gap-1 justify-end", met ? "text-good" : "text-ink-faint")}>
                      {met ? <><Check size={11} /> Completed</> : `${Math.round(100 - pct)}% remaining`}
                    </p>
                  </div>
                  <ChevronDown size={16} className={cn("text-ink-faint transition-transform", isOpen && "rotate-180")} />
                </div>
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-border">
                    {daySessions.map((s) => {
                      const c = courses.find((cc) => cc.id === s.courseId);
                      const label = s.isQuickStudy ? "Quick Study" : c?.code ?? "General";
                      return (
                        <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm border-b border-border last:border-0">
                          <div>
                            <p className="font-medium">{label} {s.taskLabel && `· ${s.taskLabel}`}</p>
                            <p className="text-xs text-ink-faint">{s.isQuickStudy ? "Quick Study" : s.studyType ?? "Session"} · {new Date(s.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          <span className="text-xs font-semibold text-accent">{s.actualMinutes}m</span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
