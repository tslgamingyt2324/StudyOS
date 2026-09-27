"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "@/db/db";
import SubTabs from "@/components/SubTabs";
import { weeklySchedule, nextClassAcrossWeek, formatCountdown, formatTime12, todayName, timeToMinutes, cn } from "@/lib/utils";

export default function SchedulePage() {
  const courses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const semesters = useLiveQuery(() => db.semesters.toArray()) ?? [];
  const currentSemester = semesters.find((s) => s.isCurrent);
  const activeCourses = courses.filter((c) => c.semesterId === currentSemester?.id);

  // Re-render every 30s so "current class" / countdown stay live without a full page refresh.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const today = todayName(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const { order, map } = weeklySchedule(activeCourses);
  const next = nextClassAcrossWeek(activeCourses, now);

  const currentClass = (map.get(today) ?? []).find(
    (item) => timeToMinutes(item.sched.startTime) <= nowMinutes && nowMinutes < timeToMinutes(item.sched.endTime)
  );

  return (
    <div className="px-4 pt-4 space-y-4">
      <h1 className="text-2xl font-bold">Planner</h1>
      <SubTabs tabs={[
        { href: "/planner/routine", label: "Routine" },
        { href: "/planner/tasks", label: "Tasks" },
        { href: "/planner/exams", label: "Exams" },
        { href: "/planner/schedule", label: "Schedule" },
      ]} />

      {currentClass ? (
        <div className="card p-4 bg-good/10 border-good/30">
          <p className="text-[11px] font-semibold text-good">IN CLASS NOW</p>
          <p className="font-semibold">{currentClass.course.code} · {currentClass.course.title}</p>
          <p className="text-xs text-ink-faint">Until {formatTime12(currentClass.sched.endTime)} · {currentClass.course.room ?? "Room TBA"}</p>
        </div>
      ) : next ? (
        <div className="card p-4 bg-accent-soft">
          <p className="text-[11px] font-semibold text-accent">
            NEXT CLASS {next.dayOffset === 0 ? "TODAY" : next.dayOffset === 1 ? "TOMORROW" : `ON ${next.dayName.toUpperCase()}`}
          </p>
          <p className="font-semibold">{next.course.code} · {next.course.title}</p>
          <p className="text-xs text-ink-faint">
            {formatTime12(next.sched.startTime)} · {next.course.room ?? "Room TBA"} · in {formatCountdown(next.minutesUntil)}
          </p>
        </div>
      ) : (
        <div className="card p-4">
          <p className="text-sm text-ink-faint">No upcoming classes found in your current semester's schedule.</p>
        </div>
      )}

      <div className="space-y-3">
        {order.map((day) => {
          const classes = map.get(day) ?? [];
          const isToday = day === today;
          return (
            <div key={day} className={cn("card overflow-hidden", isToday && "border-accent/50")}>
              <div className={cn("flex items-center justify-between px-4 py-2.5", isToday ? "bg-accent-soft" : "bg-surface-sunken/40")}>
                <span className={cn("text-sm font-semibold", isToday && "text-accent")}>{day}{isToday && " · Today"}</span>
                {classes.length === 0 && <span className="text-xs text-ink-faint">No class</span>}
              </div>
              {classes.length > 0 && (
                <div className="divide-y divide-border">
                  {classes.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <div className="w-20 shrink-0 text-xs font-semibold text-ink-muted">
                        {formatTime12(item.sched.startTime)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {item.course.code} · {item.course.title}
                          {item.course.isRetake && <span className="ml-1.5 rounded bg-warn/15 px-1.5 py-0.5 text-[9px] font-semibold text-warn align-middle">RETAKE</span>}
                        </p>
                        <p className="text-xs text-ink-faint">{item.course.room ?? "Room TBA"} · until {formatTime12(item.sched.endTime)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
