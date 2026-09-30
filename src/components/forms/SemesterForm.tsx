"use client";
import { db } from "@/db/db";
import { setCurrentSemester } from "@/db/actions";
import { Semester, SemesterTerm } from "@/types";
import { useCourses } from "@/hooks/useCourses";
import { useDraft } from "@/hooks/useDraft";
import { Field, Segmented, ToggleRow } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";
import { TERM_ORDER } from "@/lib/degree";

export default function SemesterForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Semester }) {
  const { semesters } = useCourses();
  const year = new Date().getFullYear();
  const { draft, set } = useDraft<Semester>(open, initial ?? { term: "Fall", year, label: "", isCurrent: semesters.length === 0, registeredCredits: 0 });
  return (
    <FormModal
      open={open} onClose={onClose} title={initial ? `Edit ${initial.label}` : "Add semester"} submitLabel={initial ? "Save changes" : "Add semester"}
      onSubmit={async () => {
        if (!(draft.year >= 2000 && draft.year <= 2100)) return "Enter a valid year.";
        const dupe = semesters.find((s) => s.term === draft.term && s.year === draft.year && s.id !== initial?.id);
        if (dupe) return `${dupe.label} already exists.`;
        const row: Semester = { ...draft, label: `${draft.term} ${draft.year}`, registeredCredits: Math.max(0, draft.registeredCredits || 0) };
        let id = initial?.id;
        if (id !== undefined) await db.semesters.put({ ...row, id });
        else id = await db.semesters.add(row);
        if (row.isCurrent) await setCurrentSemester(id!);
      }}
      onDelete={initial?.id !== undefined && semesters.length > 1 ? async () => {
        const has = await db.courses.where("semesterId").equals(initial.id!).count();
        if (has > 0) throw new Error(`Remove or move this semester's ${has} course${has === 1 ? "" : "s"} first.`);
        await db.semesters.delete(initial.id!);
      } : undefined}
      deleteLabel="Delete semester"
    >
      <div><span className="label">Term</span><Segmented label="Term" value={draft.term} options={TERM_ORDER as readonly SemesterTerm[]} onChange={(v) => set("term", v)} /></div>
      <Field label="Year">{(id) => <input id={id} type="number" className="input" value={draft.year} onChange={(e) => set("year", Number(e.target.value))} />}</Field>
      <Field label="Registered credits" hint="Total credits you registered for this semester (including retakes).">
        {(id) => <input id={id} type="number" min={0} className="input" value={draft.registeredCredits} onChange={(e) => set("registeredCredits", Number(e.target.value))} />}
      </Field>
      <ToggleRow label="This is the current semester" checked={draft.isCurrent} onChange={(v) => set("isCurrent", v)} />
    </FormModal>
  );
}
