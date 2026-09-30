"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Award, CheckCircle2, Minus, Pencil, Plus, Target } from "lucide-react";
import { db } from "@/db/db";
import { useSettings } from "@/hooks/useSettings";
import { useCourses } from "@/hooks/useCourses";
import { useTasks } from "@/hooks/useTasks";
import { useAttendance } from "@/hooks/useAttendance";
import { useStudySessions } from "@/hooks/useStudy";
import { GoalWithProgress, useGoals } from "@/hooks/useGoals";
import GoalForm from "@/components/forms/GoalForm";
import { Badge, EmptyState, PageHeader, PageSkeleton, Progress, Section } from "@/components/ui";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { dateKey, daysBetween, parseKey, shortDate } from "@/lib/dates";
import { Goal } from "@/types";
import { cn } from "@/lib/utils";

export default function GoalsPage() {
  const { settings } = useSettings();
  const { courses, currentCourses, byId } = useCourses();
  const { tasks } = useTasks();
  const { sessions } = useStudySessions();
  const att = useAttendance(currentCourses, settings?.attendanceThreshold ?? 70);
  const { goals, loading } = useGoals({ settings, courses, sessions, tasks, attendance: att.stats });
  const unlocked = useLiveQuery(() => db.achievements.toArray());
  const [editing, setEditing] = useState<Goal | "new" | null>(null);

  if (loading || !settings || !unlocked) return <PageSkeleton />;
  const active = goals.filter((g) => g.goal.status === "Active");
  const done = goals.filter((g) => g.goal.status !== "Active");
  const when = new Map(unlocked.map((u) => [u.key, u.unlockedAt]));

  const card = ({ goal, progress, behind }: GoalWithProgress) => {
    const left = goal.deadline ? daysBetween(new Date(), parseKey(goal.deadline)) : null;
    return (
      <li key={goal.id} className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{goal.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
              <Badge>{goal.type}</Badge>{goal.courseId && <span>{byId(goal.courseId)?.code}</span>}
              {goal.deadline && <span>· {left! < 0 && goal.status === "Active" ? "Deadline passed" : left === 0 ? "Due today" : `${shortDate(goal.deadline)}${left! > 0 ? ` (${left}d left)` : ""}`}</span>}
            </p>
          </div>
          <button className="icon-btn -mr-2 -mt-2" onClick={() => setEditing(goal)} aria-label={`Edit ${goal.title}`}><Pencil size={16} /></button>
        </div>
        {goal.description && <p className="mt-1 text-xs text-ink-muted">{goal.description}</p>}
        <div className="mt-3 flex items-end justify-between"><span className="text-lg font-bold tabular">{Math.round(progress.percent * 10) / 10}%</span><span className="text-xs tabular text-ink-muted">{progress.text}</span></div>
        <Progress value={progress.percent} tone={goal.status === "Completed" || progress.achieved ? "good" : behind ? "warn" : "accent"} label={goal.title} className="mt-1" />
        {progress.note && <p className="mt-1.5 text-xs text-ink-muted">{progress.note}</p>}
        {behind && <p className="mt-1.5 text-xs text-warn">Behind schedule for the time elapsed.</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!progress.derived && goal.status === "Active" && (
            <span className="flex items-center gap-1" role="group" aria-label="Adjust progress">
              <button className="btn btn-secondary btn-sm" aria-label="Decrease progress" onClick={() => db.goals.update(goal.id!, { manualCurrent: Math.max(0, (goal.manualCurrent ?? 0) - 1) })}><Minus size={14} /></button>
              <button className="btn btn-secondary btn-sm" aria-label="Increase progress" onClick={() => db.goals.update(goal.id!, { manualCurrent: (goal.manualCurrent ?? 0) + 1 })}><Plus size={14} /></button>
            </span>
          )}
          {progress.derived && goal.status === "Active" && <span className="text-[11px] text-ink-faint">Updates automatically</span>}
          {progress.achieved && goal.status === "Active" && <button className="btn btn-primary btn-sm" onClick={() => db.goals.update(goal.id!, { status: "Completed", completedAt: new Date().toISOString() })}><CheckCircle2 size={14} /> Target reached — mark complete</button>}
          {goal.status !== "Active" && <Badge tone={goal.status === "Completed" ? "good" : "neutral"}>{goal.status}{goal.completedAt ? ` · ${shortDate(dateKey(goal.completedAt))}` : ""}</Badge>}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Goals" subtitle="Progress is calculated from your courses, sessions and tasks wherever possible." actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> New goal</button>} />
      {goals.length === 0 ? (
        <div className="card"><EmptyState icon={Target} title="No goals yet" message="Try “Study 120 hours this month” or “Reach CGPA 3.20”. Progress updates by itself." action={<button className="btn btn-primary" onClick={() => setEditing("new")}>Create a goal</button>} /></div>
      ) : (
        <>
          <Section title={`Active · ${active.length}`}>{active.length === 0 ? <p className="text-sm text-ink-muted">No active goals.</p> : <ul className="grid gap-3 md:grid-cols-2">{active.map(card)}</ul>}</Section>
          {done.length > 0 && <Section title="Completed & closed"><ul className="grid gap-3 md:grid-cols-2">{done.map(card)}</ul></Section>}
        </>
      )}

      <Section title={`Milestones · ${unlocked.length}/${ACHIEVEMENTS.length}`}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const at = when.get(a.key);
            return (
              <li key={a.key} className={cn("card flex items-center gap-3 p-3", !at && "opacity-60")}>
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", at ? "bg-accent-soft text-accent" : "bg-surface-sunken text-ink-faint")}><Award size={18} aria-hidden="true" /></span>
                <span className="min-w-0"><span className="block text-sm font-medium">{a.title}</span><span className="block text-xs text-ink-muted">{at ? `Unlocked ${shortDate(dateKey(at))}` : a.description}</span></span>
              </li>
            );
          })}
        </ul>
      </Section>
      {editing && <GoalForm open initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
