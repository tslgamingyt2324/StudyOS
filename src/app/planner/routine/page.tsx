"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Pencil, Plus, Repeat } from "lucide-react";
import { db } from "@/db/db";
import { RoutineItem } from "@/types";
import { cn } from "@/lib/utils";
import { dateKey, formatClock } from "@/lib/dates";
import { EmptyState, PageHeader, PageSkeleton, Section } from "@/components/ui";
import RoutineForm from "@/components/forms/RoutineForm";

const DOT: Record<string, string> = {
  Study: "bg-accent", Class: "bg-warn", Assignment: "bg-bad", Exercise: "bg-good",
  Personal: "bg-violet-500", Break: "bg-teal-500", Sleep: "bg-indigo-500", Other: "bg-ink-faint",
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RoutinePage() {
  const items = useLiveQuery(() => db.routineItems.orderBy("order").toArray());
  const [editing, setEditing] = useState<RoutineItem | "new" | null>(null);
  const todayKey = dateKey();
  const todayIdx = new Date().getDay();

  const today = useMemo(
    () => (items ?? []).filter((i) => (i.daysOfWeek.length === 0 ? i.date === todayKey : i.daysOfWeek.includes(todayIdx))).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [items, todayKey, todayIdx]
  );
  if (!items) return <PageSkeleton />;

  const toggle = (i: RoutineItem) => db.routineItems.update(i.id!, {
    completedDates: i.completedDates.includes(todayKey) ? i.completedDates.filter((d) => d !== todayKey) : [...i.completedDates, todayKey],
  });
  const doneCount = today.filter((i) => i.completedDates.includes(todayKey)).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Routine" subtitle={`${new Date().toLocaleDateString(undefined, { weekday: "long" })}'s timeline${today.length ? ` · ${doneCount}/${today.length} done` : ""}`}
        actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add</button>} />

      {today.length === 0 ? (
        <div className="card"><EmptyState icon={Repeat} title={items.length ? "Nothing scheduled today" : "No routine yet"} message="Build repeating blocks for studying, exercise and rest. They also appear on your calendar." action={<button className="btn btn-primary" onClick={() => setEditing("new")}>Add routine item</button>} /></div>
      ) : (
        <ul className="space-y-2">
          {today.map((i) => {
            const done = i.completedDates.includes(todayKey);
            return (
              <li key={i.id} className="card flex items-center gap-1 pr-2">
                <button onClick={() => toggle(i)} role="checkbox" aria-checked={done} aria-label={`${i.title}, ${done ? "done" : "not done"}`} className="icon-btn">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2", done ? "border-good bg-good text-white" : "border-ink-faint")}>{done && <Check size={16} aria-hidden="true" />}</span>
                </button>
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[i.category])} aria-hidden="true" />
                <div className="min-w-0 flex-1 px-2 py-3">
                  <p className={cn("truncate text-sm font-medium", done && "text-ink-faint line-through")}>{i.title}</p>
                  <p className="text-xs text-ink-muted">{formatClock(i.startTime)} – {formatClock(i.endTime)} · {i.category}</p>
                </div>
                <button className="icon-btn" onClick={() => setEditing(i)} aria-label={`Edit ${i.title}`}><Pencil size={16} /></button>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <Section title="All routine items">
          <div className="card divide-y divide-border">
            {items.map((i) => (
              <button key={i.id} onClick={() => setEditing(i)} className="row-link w-full text-left">
                <span className="flex min-w-0 items-center gap-3"><span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[i.category])} aria-hidden="true" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{i.title}</span><span className="block text-xs text-ink-muted">{formatClock(i.startTime)} – {formatClock(i.endTime)}</span></span></span>
                <span className="shrink-0 text-xs text-ink-muted">{i.daysOfWeek.length === 7 ? "Every day" : i.daysOfWeek.length === 0 ? i.date : i.daysOfWeek.map((d) => DAYS[d]).join(" ")}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
      {editing && <RoutineForm open initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
