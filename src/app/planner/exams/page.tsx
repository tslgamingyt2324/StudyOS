"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { db } from "@/db/db";
import { Exam, ExamType } from "@/types";
import { deadlineLabel, cn } from "@/lib/utils";
import SubTabs from "@/components/SubTabs";

const EXAM_TYPES: ExamType[] = ["Quiz", "Midterm", "Final", "Other"];

export default function ExamsPage() {
  const exams = useLiveQuery(() => db.exams.orderBy("date").toArray()) ?? [];
  const courses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Partial<Exam>>({ examType: "Quiz", preparationPct: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addExam = async () => {
    setError(null);
    if (!draft.title) { setError("Give the exam a title."); return; }
    if (!draft.courseId) { setError("Pick a course."); return; }
    if (!draft.date) { setError("Pick a date."); return; }
    setSubmitting(true);
    try {
      await db.exams.add({
        courseId: draft.courseId!, title: draft.title!, examType: draft.examType as ExamType,
        date: draft.date!, time: draft.time, topics: draft.topics, preparationPct: draft.preparationPct ?? 0,
        targetMarks: draft.targetMarks,
      });
      setShowForm(false);
      setDraft({ examType: "Quiz", preparationPct: 0 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planner</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm text-white"><Plus size={16} /> Add</button>
      </div>
      <SubTabs tabs={[
        { href: "/planner/routine", label: "Routine" },
        { href: "/planner/tasks", label: "Tasks" },
        { href: "/planner/exams", label: "Exams" },
        { href: "/planner/schedule", label: "Schedule" },
      ]} />

      <div className="space-y-2">
        {exams.length === 0 && <p className="py-8 text-center text-sm text-ink-faint">No exams tracked yet. Add your first quiz or midterm.</p>}
        {exams.map((e) => {
          const c = courses.find((cc) => cc.id === e.courseId);
          const dl = deadlineLabel(e.date);
          const color = dl.urgency === "overdue" ? "text-bad" : dl.urgency === "today" || dl.urgency === "soon" ? "text-warn" : "text-ink-faint";
          return (
            <div key={e.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{c?.code} · {e.title}</p>
                  <p className="text-xs text-ink-faint">{e.examType}{e.time && ` · ${e.time}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-semibold", color)}>{dl.label}</span>
                  <button onClick={() => db.exams.delete(e.id!)} className="text-ink-faint"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-ink-faint">
                  <span>Preparation</span><span>{e.preparationPct}%</span>
                </div>
                <input
                  type="range" min={0} max={100} value={e.preparationPct}
                  onChange={(ev) => db.exams.update(e.id!, { preparationPct: parseInt(ev.target.value) })}
                  className="w-full accent-accent"
                />
              </div>
              {e.topics && <p className="text-xs text-ink-faint">Topics: {e.topics}</p>}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showForm && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl card p-5 space-y-3"
              style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <h3 className="text-lg font-semibold">New Exam</h3>
              <select value={draft.courseId ?? ""} onChange={(e) => setDraft((p) => ({ ...p, courseId: e.target.value ? Number(e.target.value) : undefined }))} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2">
                <option value="">Select course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
              <input placeholder="Title (e.g. Quiz 1, Midterm)" value={draft.title ?? ""} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
              <select value={draft.examType} onChange={(e) => setDraft((p) => ({ ...p, examType: e.target.value as ExamType }))} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2">
                {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="date" value={draft.date ?? ""} onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))} className="flex-1 rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
                <input type="time" value={draft.time ?? ""} onChange={(e) => setDraft((p) => ({ ...p, time: e.target.value }))} className="flex-1 rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
              </div>
              <input placeholder="Topics (optional)" value={draft.topics ?? ""} onChange={(e) => setDraft((p) => ({ ...p, topics: e.target.value }))} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
              {error && <p className="text-xs text-bad">{error}</p>}
              <button disabled={submitting} onClick={addExam} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
                {submitting ? "Saving…" : "Add Exam"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
