"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Trash2 } from "lucide-react";
import { db } from "@/db/db";
import { Task } from "@/types";
import { deadlineLabel, cn } from "@/lib/utils";
import SubTabs from "@/components/SubTabs";

export default function TasksPage() {
  const tasks = useLiveQuery(() => db.tasks.toArray()) ?? [];
  const courses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Partial<Task>>({ category: "Task", priority: "Medium", status: "Not started" });
  const [filter, setFilter] = useState<"All" | "Task" | "Assignment">("All");

  const visible = tasks
    .filter((t) => filter === "All" || t.category === filter)
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));

  const addTask = async () => {
    if (!draft.title) return;
    await db.tasks.add({
      title: draft.title!, description: draft.description, courseId: draft.courseId,
      category: draft.category as Task["category"], deadline: draft.deadline, priority: draft.priority as Task["priority"],
      status: "Not started", estimatedMinutes: draft.estimatedMinutes, createdAt: new Date().toISOString(),
    });
    setShowForm(false);
    setDraft({ category: "Task", priority: "Medium", status: "Not started" });
  };

  const toggleDone = async (t: Task) => {
    await db.tasks.update(t.id!, {
      status: t.status === "Completed" ? "Not started" : "Completed",
      completedAt: t.status === "Completed" ? undefined : new Date().toISOString(),
    });
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm text-white">
          <Plus size={16} /> Add
        </button>
      </div>
      <SubTabs tabs={[
        { href: "/planner/routine", label: "Routine" },
        { href: "/planner/tasks", label: "Tasks" },
        { href: "/planner/exams", label: "Exams" },
        { href: "/planner/schedule", label: "Schedule" },
      ]} />

      <div className="flex gap-2">
        {(["All", "Task", "Assignment"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", filter === f ? "bg-accent text-white" : "bg-surface-sunken/60 text-ink-muted")}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.length === 0 && <p className="py-6 text-center text-sm text-ink-faint">Nothing here. Add your first task.</p>}
        <AnimatePresence>
          {visible.map((t) => {
            const dl = deadlineLabel(t.deadline);
            const course = courses.find((c) => c.id === t.courseId);
            const color = dl.urgency === "overdue" ? "text-bad" : dl.urgency === "today" || dl.urgency === "soon" ? "text-warn" : "text-ink-faint";
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="card flex items-center gap-3 p-3">
                <button
                  onClick={() => toggleDone(t)}
                  className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2", t.status === "Completed" ? "border-good bg-good text-white" : "border-border")}
                >
                  {t.status === "Completed" && <Check size={14} />}
                </button>
                <div className="flex-1">
                  <p className={cn("font-medium text-sm", t.status === "Completed" && "line-through text-ink-faint")}>{t.title}</p>
                  <p className="text-xs text-ink-faint">{course ? `${course.code} · ` : ""}{t.category} · {t.priority}</p>
                </div>
                {t.status !== "Completed" && <span className={cn("text-xs font-semibold", color)}>{dl.label}</span>}
                <button onClick={() => db.tasks.delete(t.id!)} className="text-ink-faint"><Trash2 size={15} /></button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showForm && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/40" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setShowForm(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl card p-5 space-y-3"
              style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <h3 className="text-lg font-semibold">New Task</h3>
              <input placeholder="Title" value={draft.title ?? ""} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
              <select value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value as Task["category"] }))} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2">
                <option value="Task">Task</option>
                <option value="Assignment">Assignment</option>
              </select>
              <select value={draft.courseId ?? ""} onChange={(e) => setDraft((p) => ({ ...p, courseId: e.target.value ? Number(e.target.value) : undefined }))} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2">
                <option value="">No course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
              <input type="datetime-local" value={draft.deadline ?? ""} onChange={(e) => setDraft((p) => ({ ...p, deadline: e.target.value }))} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
              <div className="flex gap-2">
                {(["Low", "Medium", "High"] as const).map((p) => (
                  <button key={p} onClick={() => setDraft((d) => ({ ...d, priority: p }))} className={cn("flex-1 rounded-lg py-2 text-sm font-medium", draft.priority === p ? "bg-accent text-white" : "bg-surface-sunken/60")}>{p}</button>
                ))}
              </div>
              <button onClick={addTask} className="w-full rounded-xl bg-accent py-3 font-semibold text-white">Add Task</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
