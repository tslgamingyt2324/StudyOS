"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "@/db/db";
import { weeklySchedule, nextClassAcrossWeek, formatCountdown, todayName, cn } from "@/lib/utils";
import { classPhase, classEndTime, formatClassRange } from "@/lib/classTime";
import { formatClock } from "@/lib/dates";
import { useNow } from "@/hooks/useNow";

export default function SchedulePage() {
  const courses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const semesters = useLiveQuery(() => db.semesters.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const weekStartsOn = settings?.weekStartsOn ?? 0;
  const currentSemester = semesters.find((s) => s.isCurrent);
  const activeCourses = courses.filter((c) => c.semesterId === currentSemester?.id);

  // Re-render every 30s so "current class" / countdown stay live without a full page refresh.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const now = useNow();
  const today = todayName(now);
  const { order, map } = weeklySchedule(activeCourses, weekStartsOn);
  const next = nextClassAcrossWeek(activeCourses, now);

  const currentClass = (map.get(today) ?? []).find((item) => classPhase(item.sched, now) === "current");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Weekly schedule</h1>

      {currentClass ? (
        <div className="card p-4 bg-good/10 border-good/30">
          <p className="text-[11px] font-semibold text-good">IN CLASS NOW</p>
          <p className="font-semibold">{currentClass.course.code} · {currentClass.course.title}</p>
          <p className="text-xs text-ink-faint">{formatClassRange(currentClass.sched)} · {currentClass.course.room ?? "Room TBA"}</p>
        </div>
      ) : next ? (
        <div className="card p-4 bg-accent-soft">
          <p className="text-[11px] font-semibold text-accent">
            NEXT CLASS {next.dayOffset === 0 ? "TODAY" : next.dayOffset === 1 ? "TOMORROW" : `ON ${next.dayName.toUpperCase()}`}
          </p>
          <p className="font-semibold">{next.course.code} · {next.course.title}</p>
          <p className="text-xs text-ink-faint">
            {formatClassRange(next.sched)} · {next.course.room ?? "Room TBA"} · in {formatCountdown(next.minutesUntil)}
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
                      <div className="w-[5.5rem] shrink-0 text-xs font-semibold leading-tight text-ink-muted tabular">
                        <span className="block">{formatClock(item.sched.startTime)}</span>
                        <span className="block font-normal text-ink-faint">{formatClock(classEndTime(item.sched))}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {item.course.code} · {item.course.title}
                          {item.course.isRetake && <span className="ml-1.5 rounded bg-warn/15 px-1.5 py-0.5 text-[9px] font-semibold text-warn align-middle">RETAKE</span>}
                        </p>
                        <p className="text-xs text-ink-faint">{item.course.room ?? "Room TBA"}</p>
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
