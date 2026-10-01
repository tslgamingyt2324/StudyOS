"use client";
import { Plus, X } from "lucide-react";
import { db } from "@/db/db";
import { deleteCourseCascade } from "@/db/actions";
import { ClassSchedule, Course, Grade } from "@/types";
import { useCourses } from "@/hooks/useCourses";
import { useDraft } from "@/hooks/useDraft";
import { cn } from "@/lib/utils";
import { defaultEndTime, isValidTime } from "@/lib/classTime";
import { Field, ToggleRow } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";

const GRADES: Grade[] = ["", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const blank = (semesterId?: number): Course => ({
  code: "", title: "", credits: 3, faculty: "", section: "", semesterId: semesterId ?? 0, schedule: [],
  gpaCounting: true, degreeCredit: true, isRetake: false, grade: "", status: "In Progress",
});

export default function CourseForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Course }) {
  const { semesters, currentSemester } = useCourses();
  const { draft, set } = useDraft<Course>(open, initial ?? blank(currentSemester?.id));

  // Changing the start time keeps the standard 90-minute length unless the user already chose a custom end.
  const setStart = (i: number, startTime: string) => {
    const b = draft.schedule[i];
    const followsDefault = !b.endTime || b.endTime === defaultEndTime(b.startTime);
    setBlock(i, { startTime, ...(followsDefault && isValidTime(startTime) ? { endTime: defaultEndTime(startTime) } : {}) });
  };
  const setBlock = (i: number, p: Partial<ClassSchedule>) => set("schedule", draft.schedule.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const toggleDay = (i: number, day: string) => {
    const b = draft.schedule[i];
    setBlock(i, { days: b.days.includes(day) ? b.days.filter((d) => d !== day) : [...b.days, day] });
  };
  const base = draft.attendanceBaseline ?? { present: 0, absent: 0, excused: 0 };

  return (
    <FormModal
      size="lg" open={open} onClose={onClose} title={initial ? `Edit ${initial.code}` : "Add course"} submitLabel={initial ? "Save changes" : "Add course"}
      onSubmit={async () => {
        if (!draft.code.trim()) return "Enter a course code, e.g. CSE115.";
        if (!draft.title.trim()) return "Enter the course title.";
        if (!(draft.credits >= 0)) return "Credits must be zero or more.";
        if (!draft.semesterId) return "Choose a semester. Add one first from Academics → Degree Planner if the list is empty.";
        for (const b of draft.schedule) {
          if (b.days.length === 0) return "Each class time needs at least one day selected.";
          // A blank end time is allowed — it means the standard 90-minute class.
          if ((b.endTime || defaultEndTime(b.startTime)) <= b.startTime) return "Class end time must be after its start time.";
        }
        const code = draft.code.trim().toUpperCase();
        const dupe = await db.courses.where({ semesterId: draft.semesterId, code }).first();
        if (dupe && dupe.id !== initial?.id) return `${code} is already in this semester.`;
        const hasBase = base.present + base.absent + base.excused > 0;
        const row: Course = {
          ...draft, code, title: draft.title.trim(),
          schedule: draft.schedule.map((b) => ({ ...b, endTime: b.endTime || defaultEndTime(b.startTime) })),
          status: draft.grade ? "Completed" : draft.status === "Planned" ? "Planned" : "In Progress",
          attendanceBaseline: hasBase ? base : undefined,
          requiredAttendance: draft.requiredAttendance || undefined,
          room: draft.room || undefined,
        };
        if (initial?.id !== undefined) await db.courses.put({ ...row, id: initial.id });
        else await db.courses.add(row);
      }}
      onDelete={initial?.id !== undefined ? async () => { await deleteCourseCascade(initial.id!); } : undefined}
      deleteLabel={`Delete ${initial?.code ?? "course"}`}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Course code">{(id) => <input id={id} className="input uppercase" value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder="CSE115" />}</Field>
        <Field label="Credits">{(id) => <input id={id} type="number" min={0} step="0.5" className="input" value={draft.credits} onChange={(e) => set("credits", Number(e.target.value))} />}</Field>
      </div>
      <Field label="Title">{(id) => <input id={id} className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Programming Language" />}</Field>
      <Field label="Semester">
        {(id) => (
          <select id={id} className="input" value={draft.semesterId || ""} onChange={(e) => set("semesterId", Number(e.target.value))}>
            <option value="">Select a semester</option>
            {semesters.map((s) => <option key={s.id} value={s.id}>{s.label}{s.isCurrent ? " (current)" : ""}</option>)}
          </select>
        )}
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Faculty">{(id) => <input id={id} className="input" value={draft.faculty} onChange={(e) => set("faculty", e.target.value)} />}</Field>
        <Field label="Section">{(id) => <input id={id} className="input" value={draft.section} onChange={(e) => set("section", e.target.value)} />}</Field>
        <Field label="Room">{(id) => <input id={id} className="input" value={draft.room ?? ""} onChange={(e) => set("room", e.target.value)} />}</Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="label !mb-0">Weekly class times</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("schedule", [...draft.schedule, { days: [], startTime: "09:00", endTime: defaultEndTime("09:00") }])}><Plus size={14} /> Add time</button>
        </div>
        {draft.schedule.length === 0 && <p className="text-xs text-ink-muted">No class times yet — add one so this course appears on your schedule and calendar.</p>}
        {draft.schedule.map((b, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Class days">
              {DAYS.map((d) => (
                <button key={d} type="button" aria-pressed={b.days.includes(d)} onClick={() => toggleDay(i, d)}
                  className={cn("chip", b.days.includes(d) ? "chip-on" : "chip-off")}>{d.slice(0, 3)}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input aria-label="Start time" type="time" className="input" value={b.startTime} onChange={(e) => setStart(i, e.target.value)} />
              <span className="text-ink-muted">–</span>
              <input aria-label="End time" type="time" className="input" value={b.endTime} onChange={(e) => setBlock(i, { endTime: e.target.value })} />
              <button type="button" className="icon-btn" aria-label="Remove class time" onClick={() => set("schedule", draft.schedule.filter((_, j) => j !== i))}><X size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Grade">{(id) => <select id={id} className="input" value={draft.grade} onChange={(e) => set("grade", e.target.value as Grade)}>{GRADES.map((g) => <option key={g} value={g}>{g || "Not graded yet"}</option>)}</select>}</Field>
        <Field label="Target grade">{(id) => <select id={id} className="input" value={draft.targetGrade ?? ""} onChange={(e) => set("targetGrade", (e.target.value || undefined) as Grade | undefined)}>{GRADES.map((g) => <option key={g} value={g}>{g || "None"}</option>)}</select>}</Field>
      </div>

      <div className="rounded-xl border border-border p-3">
        <ToggleRow label="Counts toward GPA" checked={draft.gpaCounting} onChange={(v) => set("gpaCounting", v)} />
        <ToggleRow label="Counts as degree credit" checked={draft.degreeCredit} onChange={(v) => set("degreeCredit", v)} />
        <ToggleRow label="This is a retake" checked={draft.isRetake} onChange={(v) => set("isRetake", v)} />
      </div>

      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Attendance settings</summary>
        <div className="mt-3 space-y-3">
          <Field label="Required attendance %" hint="Leave empty to use the default from Settings.">
            {(id) => <input id={id} type="number" min={0} max={100} className="input" value={draft.requiredAttendance ?? ""} onChange={(e) => set("requiredAttendance", e.target.value ? Number(e.target.value) : undefined)} />}
          </Field>
          <p className="text-xs text-ink-muted">Classes already held before you started logging:</p>
          <div className="grid grid-cols-3 gap-2">
            {(["present", "absent", "excused"] as const).map((k) => (
              <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                {(id) => <input id={id} type="number" min={0} className="input" value={base[k]} onChange={(e) => set("attendanceBaseline", { ...base, [k]: Math.max(0, Number(e.target.value) || 0) })} />}
              </Field>
            ))}
          </div>
        </div>
      </details>
    </FormModal>
  );
}
