"use client";
import { useMemo, useState } from "react";
import { Circle, CheckCircle2, ListTodo, Plus, AlertCircle } from "lucide-react";
import { useTasks, taskMatches, TaskFilter } from "@/hooks/useTasks";
import { useCourses } from "@/hooks/useCourses";
import { toggleTaskDone } from "@/db/actions";
import { Badge, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import TaskForm from "@/components/forms/TaskForm";
import { cn, deadlineLabel, isOverdue } from "@/lib/utils";
import { Task } from "@/types";

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "today", label: "Today" }, { key: "upcoming", label: "Upcoming" }, { key: "overdue", label: "Overdue" }, { key: "completed", label: "Completed" },
];
const PRIORITY_TONE = { High: "bad", Medium: "warn", Low: "neutral" } as const;

export default function TasksPage() {
  const { tasks, loading, overdue } = useTasks();
  const { byId, currentCourses, courses } = useCourses();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [courseId, setCourseId] = useState<number | "all">("all");
  const [priority, setPriority] = useState<"all" | Task["priority"]>("all");
  const [editing, setEditing] = useState<Task | "new" | null>(null);

  const list = useMemo(() => {
    const now = new Date();
    return tasks
      .filter((t) => taskMatches(t, filter, now) && (courseId === "all" || t.courseId === courseId) && (priority === "all" || t.priority === priority))
      .sort((a, b) => Number(a.status === "Completed") - Number(b.status === "Completed") || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  }, [tasks, filter, courseId, priority]);

  if (loading) return <PageSkeleton />;
  const usedCourses = courses.filter((c) => tasks.some((t) => t.courseId === c.id) || currentCourses.some((x) => x.id === c.id));

  return (
    <div className="space-y-4">
      <PageHeader title="Tasks" subtitle={`${tasks.filter((t) => t.status !== "Completed").length} open${overdue.length ? ` · ${overdue.length} overdue` : ""}`}
        actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add task</button>} />

      <div className="scroll-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filter tasks">
        {FILTERS.map((f) => (
          <button key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className={cn("chip shrink-0", filter === f.key ? "chip-on" : "chip-off")}>
            {f.label}{f.key === "overdue" && overdue.length > 0 && <span className="ml-1.5 rounded-full bg-bad px-1.5 text-[10px] text-white">{overdue.length}</span>}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Filter by course" className="input" value={courseId} onChange={(e) => setCourseId(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">All courses</option>{usedCourses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
        <select aria-label="Filter by priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
          <option value="all">Any priority</option><option>High</option><option>Medium</option><option>Low</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="card"><EmptyState icon={ListTodo} title={tasks.length === 0 ? "No tasks yet" : "Nothing matches"} message={tasks.length === 0 ? "Add tasks and assignments — they appear on your calendar, dashboard and course pages." : "Try a different filter."} action={tasks.length === 0 ? <button className="btn btn-primary" onClick={() => setEditing("new")}>Add task</button> : undefined} /></div>
      ) : (
        <ul className="space-y-2">
          {list.map((t) => {
            const done = t.status === "Completed";
            const late = isOverdue(t);
            const dl = deadlineLabel(t.deadline);
            return (
              <li key={t.id} className={cn("card flex items-center gap-1 pr-3", late && "border-bad/50 bg-bad/5")}>
                <button className="icon-btn" onClick={() => toggleTaskDone(t)} role="checkbox" aria-checked={done} aria-label={`${t.title}, ${done ? "completed" : "not completed"}`}>
                  {done ? <CheckCircle2 size={22} className="text-good" /> : <Circle size={22} className={late ? "text-bad" : "text-ink-faint"} />}
                </button>
                <button onClick={() => setEditing(t)} className="min-w-0 flex-1 py-3 text-left" aria-label={`Edit ${t.title}`}>
                  <span className={cn("block truncate text-sm font-medium", done && "text-ink-faint line-through")}>{t.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                    {t.courseId && <span>{byId(t.courseId)?.code}</span>}
                    {t.category === "Assignment" && <Badge tone="accent">Assignment</Badge>}
                    {t.status === "In progress" && <Badge>In progress</Badge>}
                    {(t.tags ?? []).map((g) => <span key={g}>#{g}</span>)}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {!done && t.deadline && <span className={cn("flex items-center gap-1 text-xs font-semibold", dl.urgency === "overdue" ? "text-bad" : dl.urgency === "today" || dl.urgency === "soon" ? "text-warn" : "text-ink-muted")}>{late && <AlertCircle size={12} aria-hidden="true" />}{dl.label}</span>}
                  <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <TaskForm open initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
