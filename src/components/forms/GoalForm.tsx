"use client";
import { db } from "@/db/db";
import { Goal, GoalMetric, GoalType, Grade } from "@/types";
import { useCourses } from "@/hooks/useCourses";
import { useSettings } from "@/hooks/useSettings";
import { useDraft } from "@/hooks/useDraft";
import { dateKey } from "@/lib/dates";
import { CourseSelect, Field, Segmented } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";

const TYPES: GoalType[] = ["Academic", "Study", "Course", "Personal"];
const METRICS: Record<GoalType, { value: GoalMetric; label: string }[]> = {
  Academic: [{ value: "cgpa", label: "Reach a CGPA" }, { value: "manual", label: "Custom measure" }],
  Study: [{ value: "study_hours", label: "Study hours (tracked automatically)" }, { value: "tasks_completed", label: "Tasks completed" }],
  Course: [{ value: "course_grade", label: "Earn a grade" }, { value: "attendance", label: "Attendance percentage" }],
  Personal: [{ value: "manual", label: "Custom measure" }, { value: "tasks_completed", label: "Tasks completed" }],
};
const GRADES: Grade[] = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D"];

export default function GoalForm({ open, onClose, initial, defaults }: { open: boolean; onClose: () => void; initial?: Goal; defaults?: Partial<Goal> }) {
  const { courses, currentCourses } = useCourses();
  const { settings } = useSettings();
  const blank: Goal = { title: "", type: "Study", metric: "study_hours", target: 10, startDate: dateKey(), status: "Active", createdAt: new Date().toISOString(), ...defaults };
  const { draft, set, setDraft } = useDraft<Goal>(open, initial ?? blank);
  const needsCourse = draft.metric === "course_grade" || draft.metric === "attendance";
  const scale = settings?.gradeScale;
  const letter = (Object.keys(scale ?? {}) as Grade[]).find((g) => g && scale![g] === draft.target) ?? "A";

  const changeType = (type: GoalType) => setDraft((d) => {
    const metric = METRICS[type][0].value;
    return { ...d, type, metric, target: metric === "cgpa" ? 3.5 : metric === "course_grade" ? scale?.["A"] ?? 4 : metric === "study_hours" ? 10 : 10, courseId: undefined };
  });
  const changeMetric = (metric: GoalMetric) => setDraft((d) => ({
    ...d, metric,
    target: metric === "cgpa" ? Math.min(4, Math.round(((settings?.officialCGPA ?? 3) + 0.2) * 100) / 100) : metric === "course_grade" ? scale?.["A"] ?? 4 : metric === "attendance" ? 85 : 10,
  }));

  return (
    <FormModal
      open={open} onClose={onClose} title={initial ? "Edit goal" : "New goal"} submitLabel={initial ? "Save changes" : "Create goal"}
      onSubmit={async () => {
        if (!draft.title.trim()) return "Give the goal a title.";
        if (!(draft.target > 0)) return "Set a target greater than zero.";
        if (needsCourse && !draft.courseId) return "Pick the course this goal is about.";
        if (draft.deadline && draft.deadline < draft.startDate) return "The deadline can't be before the start date.";
        const row: Goal = {
          ...draft, title: draft.title.trim(), deadline: draft.deadline || undefined,
          startValue: draft.metric === "cgpa" ? draft.startValue ?? settings?.officialCGPA ?? 0 : undefined,
          completedAt: draft.status === "Completed" ? draft.completedAt ?? new Date().toISOString() : undefined,
        };
        if (initial?.id !== undefined) await db.goals.put({ ...row, id: initial.id });
        else await db.goals.add(row);
      }}
      onDelete={initial?.id !== undefined ? async () => { await db.goals.delete(initial.id!); } : undefined}
      deleteLabel="Delete goal"
    >
      <div><span className="label">Type</span><Segmented label="Goal type" value={draft.type} options={TYPES} onChange={changeType} /></div>
      <Field label="Title">{(id) => <input id={id} className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Study 120 hours this month" />}</Field>
      <Field label="What to measure">
        {(id) => <select id={id} className="input" value={draft.metric} onChange={(e) => changeMetric(e.target.value as GoalMetric)}>{METRICS[draft.type].map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>}
      </Field>
      {needsCourse && <Field label="Course">{(id) => <CourseSelect id={id} value={draft.courseId} courses={courses.filter((c) => currentCourses.some((x) => x.id === c.id) || c.id === draft.courseId)} placeholder="Select a course" onChange={(v) => set("courseId", v)} />}</Field>}
      {draft.metric === "course_grade" ? (
        <Field label="Target grade">{(id) => <select id={id} className="input" value={letter} onChange={(e) => set("target", scale?.[e.target.value as Grade] ?? 4)}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select>}</Field>
      ) : (
        <Field label={draft.metric === "cgpa" ? "Target CGPA" : draft.metric === "study_hours" ? "Target hours" : draft.metric === "attendance" ? "Target attendance %" : draft.metric === "tasks_completed" ? "Tasks to complete" : "Target"}>
          {(id) => <input id={id} type="number" step="any" min={0} className="input" value={draft.target} onChange={(e) => set("target", Number(e.target.value))} />}
        </Field>
      )}
      {draft.metric === "study_hours" && draft.type === "Study" && (
        <Field label="Only count this course" hint="Leave empty to count all study time.">{(id) => <CourseSelect id={id} value={draft.courseId} courses={currentCourses} onChange={(v) => set("courseId", v)} />}</Field>
      )}
      {draft.metric === "manual" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Progress so far">{(id) => <input id={id} type="number" step="any" min={0} className="input" value={draft.manualCurrent ?? 0} onChange={(e) => set("manualCurrent", Number(e.target.value))} />}</Field>
          <Field label="Unit">{(id) => <input id={id} className="input" value={draft.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="books, km…" />}</Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start">{(id) => <input id={id} type="date" className="input" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />}</Field>
        <Field label="Deadline">{(id) => <input id={id} type="date" className="input" value={draft.deadline ?? ""} onChange={(e) => set("deadline", e.target.value)} />}</Field>
      </div>
      <Field label="Description">{(id) => <textarea id={id} className="input" value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />}</Field>
      {initial && (
        <Field label="Status">{(id) => <select id={id} className="input" value={draft.status} onChange={(e) => set("status", e.target.value as Goal["status"])}>{["Active", "Completed", "Abandoned"].map((s) => <option key={s}>{s}</option>)}</select>}</Field>
      )}
    </FormModal>
  );
}
