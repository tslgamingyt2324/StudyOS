"use client";
import { db } from "@/db/db";
import { Task } from "@/types";
import { useCourses } from "@/hooks/useCourses";
import { useExams } from "@/hooks/useExams";
import { useDraft } from "@/hooks/useDraft";
import { CourseSelect, Field, Segmented } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";

const blank = (d?: Partial<Task>): Task => ({
  title: "", category: "Task", priority: "Medium", status: "Not started", createdAt: new Date().toISOString(), ...d,
});

export const parseTags = (s: string) => [...new Set(s.split(/[,\s]+/).map((t) => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean))];

export default function TaskForm({ open, onClose, initial, defaults }: { open: boolean; onClose: () => void; initial?: Task; defaults?: Partial<Task> }) {
  const { currentCourses, courses } = useCourses();
  const { exams } = useExams();
  const { draft, set } = useDraft<Task & { tagText?: string }>(open, initial ? { ...initial, tagText: (initial.tags ?? []).join(", ") } : blank(defaults));
  const pickable = courses.filter((c) => currentCourses.some((x) => x.id === c.id) || c.id === draft.courseId);
  const courseExams = exams.filter((e) => e.courseId === draft.courseId);

  return (
    <FormModal
      open={open} onClose={onClose} title={initial ? "Edit task" : draft.category === "Assignment" ? "New assignment" : "New task"}
      submitLabel={initial ? "Save changes" : "Add"}
      onSubmit={async () => {
        if (!draft.title.trim()) return "Give it a title.";
        const { tagText, ...rest } = draft;
        const row: Task = {
          ...rest, title: draft.title.trim(), deadline: draft.deadline || undefined,
          tags: parseTags(tagText ?? ""), examId: draft.courseId ? draft.examId : undefined,
          completedAt: draft.status === "Completed" ? draft.completedAt ?? new Date().toISOString() : undefined,
        };
        if (initial?.id !== undefined) await db.tasks.put({ ...row, id: initial.id });
        else await db.tasks.add(row);
      }}
      onDelete={initial?.id !== undefined ? async () => { await db.tasks.delete(initial.id!); } : undefined}
      deleteLabel="Delete task"
    >
      <Segmented label="Type" value={draft.category} options={["Task", "Assignment"] as const} onChange={(v) => set("category", v)} />
      <Field label="Title">{(id) => <input id={id} className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Problem set 3" />}</Field>
      <Field label="Course">{(id) => <CourseSelect id={id} value={draft.courseId} courses={pickable} onChange={(v) => { set("courseId", v); set("examId", undefined); }} />}</Field>
      <Field label="Due">{(id) => <input id={id} type="datetime-local" className="input" value={draft.deadline ?? ""} onChange={(e) => set("deadline", e.target.value)} />}</Field>
      <div>
        <span className="label">Priority</span>
        <Segmented label="Priority" value={draft.priority} options={["Low", "Medium", "High"] as const} onChange={(v) => set("priority", v)} />
      </div>
      {courseExams.length > 0 && (
        <Field label="Preparing for exam" hint="Link this to an exam so it shows up in exam planning.">
          {(id) => (
            <select id={id} className="input" value={draft.examId ?? ""} onChange={(e) => set("examId", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">Not exam-related</option>
              {courseExams.map((e) => <option key={e.id} value={e.id}>{e.title} · {e.date}</option>)}
            </select>
          )}
        </Field>
      )}
      <Field label="Tags" hint="Comma-separated, e.g. lab, group">{(id) => <input id={id} className="input" value={draft.tagText ?? ""} onChange={(e) => set("tagText", e.target.value)} />}</Field>
      <Field label="Description">{(id) => <textarea id={id} className="input" value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />}</Field>
      {initial && (
        <Field label="Status">
          {(id) => (
            <select id={id} className="input" value={draft.status === "Overdue" ? "Not started" : draft.status} onChange={(e) => set("status", e.target.value as Task["status"])}>
              {["Not started", "In progress", "Completed"].map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
        </Field>
      )}
    </FormModal>
  );
}
