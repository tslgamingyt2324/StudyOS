"use client";
import { db } from "@/db/db";
import { Exam, ExamType } from "@/types";
import { useCourses } from "@/hooks/useCourses";
import { useDraft } from "@/hooks/useDraft";
import { dateKey } from "@/lib/dates";
import { CourseSelect, Field, Segmented } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";

const TYPES: ExamType[] = ["Quiz", "Midterm", "Final", "Other"];

export default function ExamForm({ open, onClose, initial, defaults }: { open: boolean; onClose: () => void; initial?: Exam; defaults?: Partial<Exam> }) {
  const { currentCourses, courses } = useCourses();
  const { draft, set } = useDraft<Partial<Exam>>(open, initial ?? { examType: "Quiz", preparationPct: 0, date: dateKey(), ...defaults });
  const pickable = courses.filter((c) => currentCourses.some((x) => x.id === c.id) || c.id === draft.courseId);

  return (
    <FormModal
      open={open} onClose={onClose} title={initial ? "Edit exam" : "New exam"} submitLabel={initial ? "Save changes" : "Add exam"}
      onSubmit={async () => {
        if (!draft.courseId) return "Pick a course.";
        if (!draft.title?.trim()) return "Give the exam a title, e.g. “Midterm”.";
        if (!draft.date) return "Pick a date.";
        const row: Exam = {
          courseId: draft.courseId, title: draft.title.trim(), examType: draft.examType ?? "Quiz", date: draft.date,
          time: draft.time || undefined, location: draft.location || undefined, topics: draft.topics || undefined,
          notes: draft.notes || undefined, preparationPct: draft.preparationPct ?? 0, targetMarks: draft.targetMarks, actualMarks: draft.actualMarks,
        };
        if (initial?.id !== undefined) await db.exams.put({ ...row, id: initial.id });
        else await db.exams.add(row);
      }}
      onDelete={initial?.id !== undefined ? async () => { await db.exams.delete(initial.id!); } : undefined}
      deleteLabel="Delete exam"
    >
      <Field label="Course">{(id) => <CourseSelect id={id} value={draft.courseId} courses={pickable} placeholder="Select a course" onChange={(v) => set("courseId", v)} />}</Field>
      <Field label="Title">{(id) => <input id={id} className="input" value={draft.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Quiz 1, Midterm…" />}</Field>
      <div><span className="label">Type</span><Segmented label="Exam type" value={draft.examType ?? "Quiz"} options={TYPES} onChange={(v) => set("examType", v)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{(id) => <input id={id} type="date" className="input" value={draft.date ?? ""} onChange={(e) => set("date", e.target.value)} />}</Field>
        <Field label="Time">{(id) => <input id={id} type="time" className="input" value={draft.time ?? ""} onChange={(e) => set("time", e.target.value)} />}</Field>
      </div>
      <Field label="Location">{(id) => <input id={id} className="input" value={draft.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="Room or hall" />}</Field>
      <Field label="Topics">{(id) => <input id={id} className="input" value={draft.topics ?? ""} onChange={(e) => set("topics", e.target.value)} placeholder="Chapters 1–4" />}</Field>
      <Field label={`Preparation: ${draft.preparationPct ?? 0}%`}>
        {(id) => <input id={id} type="range" min={0} max={100} step={5} className="w-full accent-[rgb(var(--accent))]" value={draft.preparationPct ?? 0} onChange={(e) => set("preparationPct", Number(e.target.value))} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target marks">{(id) => <input id={id} type="number" min={0} step="any" className="input" value={draft.targetMarks ?? ""} onChange={(e) => set("targetMarks", e.target.value === "" ? undefined : Number(e.target.value))} />}</Field>
        <Field label="Marks received">{(id) => <input id={id} type="number" min={0} step="any" className="input" value={draft.actualMarks ?? ""} onChange={(e) => set("actualMarks", e.target.value === "" ? undefined : Number(e.target.value))} />}</Field>
      </div>
      <Field label="Notes">{(id) => <textarea id={id} className="input" value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />}</Field>
    </FormModal>
  );
}
