"use client";
import { useMemo } from "react";
import { Check, X, ShieldCheck, Undo2 } from "lucide-react";
import { AttendanceRecord, Course } from "@/types";
import { attendanceMessage, computeAttendance, projections } from "@/lib/attendance";
import { clearAttendance, setAttendance } from "@/db/actions";
import { Badge, Progress } from "@/components/ui";
import { dateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

const TONE = { none: "neutral", safe: "good", warning: "warn", risk: "bad" } as const;
const LABEL = { none: "No data", safe: "On track", warning: "Close to limit", risk: "Below requirement" } as const;

/** One course's attendance: live stats, projections and one-tap logging for today (or `date`). */
export default function AttendanceCard({
  course, records, threshold, date = dateKey(), compact, showProjections = true,
}: { course: Course; records: AttendanceRecord[]; threshold: number; date?: string; compact?: boolean; showProjections?: boolean }) {
  const mine = useMemo(() => records.filter((r) => r.courseId === course.id), [records, course.id]);
  const s = useMemo(() => computeAttendance(course, mine, threshold), [course, mine, threshold]);
  const today = mine.find((r) => r.date === date);
  const proj = useMemo(() => projections(s), [s]);
  const tone = s.status === "risk" ? "bad" : s.status === "warning" ? "warn" : "good";

  const mark = (status: "Present" | "Absent" | "Excused") =>
    today?.status === status ? clearAttendance(course.id!, date) : setAttendance(course.id!, date, status);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{course.code}</p>
          <p className="truncate text-xs text-ink-muted">{course.title}</p>
        </div>
        <div className="text-right">
          <p className={cn("text-2xl font-bold tabular", s.percentage === null ? "text-ink-faint" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "")}>
            {s.percentage === null ? "—" : `${s.percentage.toFixed(1)}%`}
          </p>
          <Badge tone={TONE[s.status]}>{LABEL[s.status]}</Badge>
        </div>
      </div>

      <div className="relative mt-3">
        <Progress value={s.percentage ?? 0} tone={s.status === "none" ? "accent" : tone} label={`${course.code} attendance`} />
        <span aria-hidden="true" className="absolute top-[-3px] h-[16px] w-0.5 bg-ink/60" style={{ left: `${s.required}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-ink-muted">Required: {s.required}%</p>

      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[["Present", s.present], ["Absent", s.absent], ["Excused", s.excused], ["Total", s.total]].map(([k, v]) => (
          <div key={k as string} className="rounded-xl bg-surface-sunken/50 py-2">
            <dd className="text-lg font-bold tabular">{v}</dd><dt className="text-[10px] text-ink-muted">{k}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-sm">{attendanceMessage(s)}</p>
      {!compact && s.total > 0 && (
        <p className="text-xs text-ink-muted">
          Max you can still miss: <b className="text-ink">{Number.isFinite(s.maxMissable) ? s.maxMissable : "any"}</b>
          {s.neededToReach > 0 && Number.isFinite(s.neededToReach) && <> · Needed to reach {s.required}%: <b className="text-ink">{s.neededToReach}</b></>}
        </p>
      )}

      {showProjections && !compact && s.total > 0 && (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {proj.map((p) => (
            <li key={p.label} className="flex items-center justify-between rounded-lg bg-surface-sunken/40 px-3 py-1.5 text-xs">
              <span className="text-ink-muted">{p.label}</span>
              <span className={cn("font-semibold tabular", p.percentage !== null && p.percentage < s.required && "text-bad")}>{p.percentage === null ? "—" : `${p.percentage.toFixed(1)}%`}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2" role="group" aria-label={`Log ${course.code} attendance for ${date === dateKey() ? "today" : date}`}>
        {([["Present", Check, "good"], ["Absent", X, "bad"], ["Excused", ShieldCheck, "accent"]] as const).map(([label, Icon, t]) => {
          const on = today?.status === label;
          return (
            <button key={label} type="button" aria-pressed={on} onClick={() => mark(label)}
              className={cn("btn btn-sm flex-1", on ? { good: "bg-good text-white", bad: "bg-bad text-white", accent: "bg-accent text-white" }[t] : "btn-secondary")}>
              {on ? <Undo2 size={14} aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />} {label}
            </button>
          );
        })}
      </div>
      {today && <p className="mt-1.5 text-[11px] text-ink-muted">Marked {today.status.toLowerCase()} for {date === dateKey() ? "today" : date}. Tap again to undo.</p>}
    </div>
  );
}
