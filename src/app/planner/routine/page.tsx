"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Plus, Trash2, Check } from "lucide-react";
import { db } from "@/db/db";
import { RoutineItem } from "@/types";
import { cn, todayName } from "@/lib/utils";
import SubTabs from "@/components/SubTabs";

const CATEGORIES: RoutineItem["category"][] = ["Study", "Class", "Assignment", "Exercise", "Personal", "Break", "Sleep", "Other"];
const CATEGORY_COLOR: Record<string, string> = {
  Study: "bg-accent", Class: "bg-warn", Assignment: "bg-bad", Exercise: "bg-good",
  Personal: "bg-purple-400", Break: "bg-teal-400", Sleep: "bg-indigo-400", Other: "bg-gray-400",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RoutinePage() {
  const items = useLiveQuery(() => db.routineItems.orderBy("order").toArray()) ?? [];
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Partial<RoutineItem>>({
    category: "Study", startTime: "09:00", endTime: "10:00", priority: "Medium", daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayIdx = new Date().getDay();
  const todaysItems = items.filter((i) => i.daysOfWeek.length === 0 ? i.date === todayKey : i.daysOfWeek.includes(todayIdx));

  const addItem = async () => {
    if (!draft.title) return;
    await db.routineItems.add({
      title: draft.title!, category: draft.category as RoutineItem["category"],
      startTime: draft.startTime!, endTime: draft.endTime!, daysOfWeek: draft.daysOfWeek ?? [],
      priority: draft.priority as RoutineItem["priority"], completed: false, completedDates: [],
      order: items.length,
    });
    setShowForm(false);
    setDraft({ category: "Study", startTime: "09:00", endTime: "10:00", priority: "Medium", daysOfWeek: [0,1,2,3,4,5,6] });
  };

  const toggleComplete = async (item: RoutineItem) => {
    const has = item.completedDates.includes(todayKey);
    const dates = has ? item.completedDates.filter((d) => d !== todayKey) : [...item.completedDates, todayKey];
    await db.routineItems.update(item.id!, { completedDates: dates });
  };

  const toggleDay = (d: number) => {
    setDraft((prev) => {
      const set = new Set(prev.daysOfWeek ?? []);
      set.has(d) ? set.delete(d) : set.add(d);
      return { ...prev, daysOfWeek: [...set].sort() };
    });
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Routine</h1>
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
      <p className="text-sm text-ink-muted">{todayName()}'s timeline</p>

      <div className="space-y-2">
        {todaysItems.length === 0 && <p className="text-sm text-ink-faint py-6 text-center">No routine items for today. Tap Add to build your schedule.</p>}
        <AnimatePresence>
          {todaysItems.sort((a,b) => a.startTime.localeCompare(b.startTime)).map((item) => {
            const done = item.completedDates.includes(todayKey);
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="card flex items-center gap-3 p-3"
              >
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", CATEGORY_COLOR[item.category])} />
                <div className="flex-1">
                  <p className={cn("font-medium text-sm", done && "line-through text-ink-faint")}>{item.title}</p>
                  <p className="text-xs text-ink-faint">{item.startTime}–{item.endTime} · {item.category}</p>
                </div>
                <button
                  onClick={() => toggleComplete(item)}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    done ? "border-good bg-good text-white" : "border-border")}
                >
                  {done && <Check size={16} />}
                </button>
                <button onClick={() => db.routineItems.delete(item.id!)} className="text-ink-faint">
                  <Trash2 size={16} />
                </button>
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
              <h3 className="text-lg font-semibold">New Routine Item</h3>
              <input
                placeholder="Title" value={draft.title ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2"
              />
              <div className="flex gap-2">
                <input type="time" value={draft.startTime} onChange={(e) => setDraft((p) => ({ ...p, startTime: e.target.value }))} className="flex-1 rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
                <input type="time" value={draft.endTime} onChange={(e) => setDraft((p) => ({ ...p, endTime: e.target.value }))} className="flex-1 rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
              </div>
              <select value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value as RoutineItem["category"] }))} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex justify-between">
                {DAYS.map((d, i) => (
                  <button
                    key={d} onClick={() => toggleDay(i)}
                    className={cn("h-9 w-9 rounded-full text-xs font-semibold", draft.daysOfWeek?.includes(i) ? "bg-accent text-white" : "bg-surface-sunken/60 text-ink-muted")}
                  >{d[0]}</button>
                ))}
              </div>
              <button onClick={addItem} className="w-full rounded-xl bg-accent py-3 font-semibold text-white">Add to Routine</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
