"use client";
import { db } from "@/db/db";
import { Grade, PlannedCourse, SemesterTerm } from "@/types";
import { useDraft } from "@/hooks/useDraft";
import { Field, Segmented, ToggleRow } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";
import { TERM_ORDER } from "@/lib/degree";

const GRADES: Grade[] = ["", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D"];

export default function PlannedCourseForm({ open, onClose, initial, defaults }: { open: boolean; onClose: () => void; initial?: PlannedCourse; defaults?: Partial<PlannedCourse> }) {
  const { draft, set } = useDraft<PlannedCourse>(open, initial ?? { term: "Spring", year: new Date().getFullYear() + 1, code: "", title: "", credits: 3, ...defaults });
  return (
    <FormModal
      open={open} onClose={onClose} title={initial ? "Edit planned course" : "Plan a course"} submitLabel={initial ? "Save changes" : "Add to plan"}
      onSubmit={async () => {
        if (!draft.code.trim()) return "Enter a course code.";
        if (!(draft.credits >= 0)) return "Credits must be zero or more.";
        if (!(draft.year >= 2000 && draft.year <= 2100)) return "Enter a valid year.";
        const row = { ...draft, code: draft.code.trim().toUpperCase(), title: draft.title.trim() || draft.code.trim().toUpperCase(), expectedGrade: draft.expectedGrade || undefined };
        if (initial?.id !== undefined) await db.plannedCourses.put({ ...row, id: initial.id });
        else await db.plannedCourses.add(row);
      }}
      onDelete={initial?.id !== undefined ? async () => { await db.plannedCourses.delete(initial.id!); } : undefined}
      deleteLabel="Remove from plan"
    >
      <div><span className="label">Term</span><Segmented label="Term" value={draft.term} options={TERM_ORDER as readonly SemesterTerm[]} onChange={(v) => set("term", v)} /></div>
      <Field label="Year">{(id) => <input id={id} type="number" className="input" value={draft.year} onChange={(e) => set("year", Number(e.target.value))} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Course code">{(id) => <input id={id} className="input uppercase" value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder="CSE215" />}</Field>
        <Field label="Credits">{(id) => <input id={id} type="number" min={0} step="0.5" className="input" value={draft.credits} onChange={(e) => set("credits", Number(e.target.value))} />}</Field>
      </div>
      <Field label="Title (optional)">{(id) => <input id={id} className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} />}</Field>
      <Field label="Expected grade" hint="Used only for GPA scenarios.">{(id) => <select id={id} className="input" value={draft.expectedGrade ?? ""} onChange={(e) => set("expectedGrade", (e.target.value || undefined) as Grade | undefined)}>{GRADES.map((g) => <option key={g} value={g}>{g || "Not set"}</option>)}</select>}</Field>
      <ToggleRow label="Retake of an earlier course" checked={!!draft.isRetake} onChange={(v) => set("isRetake", v)} />
    </FormModal>
  );
}
