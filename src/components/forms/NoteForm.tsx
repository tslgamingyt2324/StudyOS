"use client";
import { db } from "@/db/db";
import { Note } from "@/types";
import { useCourses } from "@/hooks/useCourses";
import { useDraft } from "@/hooks/useDraft";
import { CourseSelect, Field } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";
import { parseTags } from "@/components/forms/TaskForm";

/** Quick-capture note dialog (the Notes page has a full editor for longer writing). */
export default function NoteForm({ open, onClose, defaults }: { open: boolean; onClose: () => void; defaults?: Partial<Note> }) {
  const { courses } = useCourses();
  const { draft, set } = useDraft<{ title: string; body: string; courseId?: number; tagText: string }>(open, { title: "", body: "", courseId: defaults?.courseId, tagText: "" });
  return (
    <FormModal
      open={open} onClose={onClose} title="New note" submitLabel="Save note"
      onSubmit={async () => {
        if (!draft.title.trim() && !draft.body.trim()) return "Write a title or some content first.";
        const now = new Date().toISOString();
        await db.notes.add({
          title: draft.title.trim() || "Untitled", body: draft.body, courseId: draft.courseId, tags: parseTags(draft.tagText),
          pinned: false, archived: false, createdAt: now, updatedAt: now,
        });
      }}
    >
      <Field label="Title">{(id) => <input id={id} className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Functions, Durkheim, Midterm revision…" />}</Field>
      <Field label="Course">{(id) => <CourseSelect id={id} value={draft.courseId} courses={courses} onChange={(v) => set("courseId", v)} />}</Field>
      <Field label="Note" hint="Markdown supported: # headings, **bold**, - lists, - [ ] checklists">{(id) => <textarea id={id} className="input min-h-[140px]" value={draft.body} onChange={(e) => set("body", e.target.value)} />}</Field>
      <Field label="Tags">{(id) => <input id={id} className="input" value={draft.tagText} onChange={(e) => set("tagText", e.target.value)} placeholder="exam, revision" />}</Field>
    </FormModal>
  );
}
