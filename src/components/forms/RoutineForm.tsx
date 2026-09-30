"use client";
import { db } from "@/db/db";
import { RoutineItem } from "@/types";
import { useDraft } from "@/hooks/useDraft";
import { cn } from "@/lib/utils";
import { Field } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";

export const ROUTINE_CATEGORIES: RoutineItem["category"][] = ["Study", "Class", "Assignment", "Exercise", "Personal", "Break", "Sleep", "Other"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function RoutineForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: RoutineItem }) {
  const { draft, set } = useDraft<RoutineItem>(open, initial ?? {
    title: "", category: "Study", startTime: "09:00", endTime: "10:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    priority: "Medium", completed: false, completedDates: [], order: 0,
  });
  const toggle = (d: number) => set("daysOfWeek", draft.daysOfWeek.includes(d) ? draft.daysOfWeek.filter((x) => x !== d) : [...draft.daysOfWeek, d].sort());

  return (
    <FormModal
      open={open} onClose={onClose} title={initial ? "Edit routine item" : "New routine item"} submitLabel={initial ? "Save changes" : "Add to routine"}
      onSubmit={async () => {
        if (!draft.title.trim()) return "Give it a title.";
        if (draft.daysOfWeek.length === 0 && !draft.date) return "Pick at least one day, or a date for a one-off item.";
        const row = { ...draft, title: draft.title.trim() };
        if (initial?.id !== undefined) await db.routineItems.put({ ...row, id: initial.id });
        else await db.routineItems.add({ ...row, order: await db.routineItems.count() });
      }}
      onDelete={initial?.id !== undefined ? async () => { await db.routineItems.delete(initial.id!); } : undefined}
      deleteLabel="Delete routine item"
    >
      <Field label="Title">{(id) => <input id={id} className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Deep work, gym, revision…" />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">{(id) => <input id={id} type="time" className="input" value={draft.startTime} onChange={(e) => set("startTime", e.target.value)} />}</Field>
        <Field label="Ends">{(id) => <input id={id} type="time" className="input" value={draft.endTime} onChange={(e) => set("endTime", e.target.value)} />}</Field>
      </div>
      <Field label="Category">
        {(id) => <select id={id} className="input" value={draft.category} onChange={(e) => set("category", e.target.value as RoutineItem["category"])}>{ROUTINE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>}
      </Field>
      <div>
        <span className="label">Repeats on</span>
        <div className="flex justify-between gap-1" role="group" aria-label="Days of the week">
          {DAYS.map((d, i) => (
            <button
              key={d} type="button" aria-pressed={draft.daysOfWeek.includes(i)} aria-label={FULL[i]} onClick={() => toggle(i)}
              className={cn("h-11 w-11 rounded-full text-xs font-semibold", draft.daysOfWeek.includes(i) ? "bg-accent text-white" : "bg-surface-sunken/60 text-ink-muted")}
            >{d[0]}</button>
          ))}
        </div>
      </div>
      {draft.daysOfWeek.length === 0 && (
        <Field label="One-off date">{(id) => <input id={id} type="date" className="input" value={draft.date ?? ""} onChange={(e) => set("date", e.target.value)} />}</Field>
      )}
    </FormModal>
  );
}
