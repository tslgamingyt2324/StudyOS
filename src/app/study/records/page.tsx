"use client";
import { useMemo, useState } from "react";
import { Check, ChevronDown, History, Plus, Trash2 } from "lucide-react";
import { db } from "@/db/db";
import { useStudySessions } from "@/hooks/useStudy";
import { useCourses } from "@/hooks/useCourses";
import { useSettings } from "@/hooks/useSettings";
import { useQuickAdd } from "@/components/shell/QuickAdd";
import { Badge, ConfirmDialog, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { dateKey, formatMinutes, longDate } from "@/lib/dates";
import { StudySession } from "@/types";

export default function SessionsPage() {
  const { completed, loading } = useStudySessions();
  const { courses, byId } = useCourses();
  const { settings } = useSettings();
  const quick = useQuickAdd();
  const [open, setOpen] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState<number | "all">("all");
  const [toDelete, setToDelete] = useState<StudySession | null>(null);

  const days = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    for (const s of completed) {
      if (courseFilter !== "all" && s.courseId !== courseFilter) continue;
      const k = dateKey(s.startedAt);
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [completed, courseFilter]);

  if (loading || !settings) return <PageSkeleton />;
  const goal = settings.dailyStudyGoalMinutes || 0;
  const studied = courses.filter((c) => completed.some((s) => s.courseId === c.id));

  return (
    <div className="space-y-4">
      <PageHeader title="Sessions" subtitle={`${completed.length} completed session${completed.length === 1 ? "" : "s"}`} actions={<button className="btn btn-primary" onClick={() => quick.open("study-log")}><Plus size={16} /> Log session</button>} />
      {studied.length > 1 && (
        <select aria-label="Filter by course" className="input sm:max-w-xs" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">All courses</option>{studied.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
      )}
      {days.length === 0 ? (
        <div className="card"><EmptyState icon={History} title="No study history yet" message="Sessions you complete or log show up here, day by day." action={<button className="btn btn-primary" onClick={() => quick.open("study-log")}>Log a session</button>} /></div>
      ) : (
        <div className="space-y-2">
          {days.map(([day, list]) => {
            const total = list.reduce((t, s) => t + s.actualMinutes, 0);
            const met = goal > 0 && total >= goal;
            const isOpen = open === day;
            return (
              <div key={day} className="card overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : day)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                  <span><span className="block text-sm font-semibold">{day === dateKey() ? "Today" : longDate(day)}</span><span className="block text-xs text-ink-muted">{list.length} session{list.length === 1 ? "" : "s"}</span></span>
                  <span className="flex items-center gap-3">
                    <span className="text-right"><span className={cn("block text-sm font-bold tabular", met && "text-good")}>{formatMinutes(total)}{goal ? ` / ${formatMinutes(goal)}` : ""}</span>{met && <span className="flex items-center justify-end gap-1 text-[11px] text-good"><Check size={11} aria-hidden="true" /> Goal met</span>}</span>
                    <ChevronDown size={16} className={cn("text-ink-faint transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
                  </span>
                </button>
                {isOpen && (
                  <ul className="divide-y divide-border border-t border-border">
                    {list.sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((s) => (
                      <li key={s.id} className="flex items-start gap-2 py-2.5 pl-4 pr-1">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{s.isQuickStudy ? "Quick Study" : byId(s.courseId)?.code ?? "General"}{s.taskLabel && ` · ${s.taskLabel}`}</p>
                          <p className="text-xs text-ink-muted">{s.isQuickStudy ? "Open session" : s.studyType ?? "Session"} · {new Date(s.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                          {s.accomplished && <p className="mt-1 text-xs">{s.accomplished}</p>}
                          {s.rating && <Badge className="mt-1" tone={s.rating === "Difficult" ? "warn" : s.rating === "Excellent" ? "good" : "neutral"}>{s.rating}</Badge>}
                        </div>
                        <Badge tone="accent">{formatMinutes(s.actualMinutes)}</Badge>
                        <button className="icon-btn !min-h-[36px] !min-w-[36px]" aria-label="Delete session" onClick={() => setToDelete(s)}><Trash2 size={15} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog open={!!toDelete} danger title="Delete this session?" confirmLabel="Delete" message={toDelete ? `${formatMinutes(toDelete.actualMinutes)} of study time will be removed from your history and analytics.` : ""} onCancel={() => setToDelete(null)} onConfirm={async () => { if (toDelete?.id !== undefined) await db.studySessions.delete(toDelete.id); setToDelete(null); }} />
    </div>
  );
}
