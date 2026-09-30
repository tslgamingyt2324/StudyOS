"use client";
import { db } from "@/db/db";
import { StudyType } from "@/types";
import { useCourses } from "@/hooks/useCourses";
import { useDraft } from "@/hooks/useDraft";
import { dateKey } from "@/lib/dates";
import { CourseSelect, Field } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";

export const STUDY_TYPES: StudyType[] = ["Lecture Review", "Assignment", "Problem Solving", "Exam Preparation", "Reading", "Lab Preparation", "Revision", "Other"];

export default function StudyLogForm({ open, onClose, defaults }: { open: boolean; onClose: () => void; defaults?: { courseId?: number } }) {
  const { currentCourses } = useCourses();
  const { draft, set } = useDraft(open, { courseId: defaults?.courseId as number | undefined, hours: 0, minutes: 30, date: dateKey(), time: "18:00", studyType: "Lecture Review" as StudyType, notes: "" });
  return (
    <FormModal
      open={open} onClose={onClose} title="Log a study session" description="Record time you already studied." submitLabel="Save session"
      onSubmit={async () => {
        const total = draft.hours * 60 + draft.minutes;
        if (total <= 0) return "Duration must be greater than zero.";
        if (total > 16 * 60) return "That's longer than 16 hours — double-check the duration.";
        if (!draft.date) return "Pick a date.";
        const startedAt = new Date(`${draft.date}T${draft.time || "12:00"}:00`);
        if (startedAt.getTime() > Date.now() + 60_000) return "That session is in the future.";
        await db.studySessions.add({
          courseId: draft.courseId, taskLabel: draft.notes || undefined, studyType: draft.studyType, mode: "Custom",
          plannedMinutes: total, actualMinutes: total, startedAt: startedAt.toISOString(),
          endedAt: new Date(startedAt.getTime() + total * 60000).toISOString(), completed: true,
        });
      }}
    >
      <Field label="Course">{(id) => <CourseSelect id={id} value={draft.courseId} courses={currentCourses} onChange={(v) => set("courseId", v)} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hours">{(id) => <input id={id} type="number" min={0} max={16} className="input" value={draft.hours} onChange={(e) => set("hours", Math.max(0, Number(e.target.value) || 0))} />}</Field>
        <Field label="Minutes">{(id) => <input id={id} type="number" min={0} max={59} className="input" value={draft.minutes} onChange={(e) => set("minutes", Math.min(59, Math.max(0, Number(e.target.value) || 0)))} />}</Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{(id) => <input id={id} type="date" className="input" max={dateKey()} value={draft.date} onChange={(e) => set("date", e.target.value)} />}</Field>
        <Field label="Started at">{(id) => <input id={id} type="time" className="input" value={draft.time} onChange={(e) => set("time", e.target.value)} />}</Field>
      </div>
      <Field label="Activity">{(id) => <select id={id} className="input" value={draft.studyType} onChange={(e) => set("studyType", e.target.value as StudyType)}>{STUDY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
      <Field label="Notes">{(id) => <input id={id} className="input" value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="What did you work on?" />}</Field>
    </FormModal>
  );
}
