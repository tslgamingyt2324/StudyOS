"use client";
import { AttendanceStatus } from "@/types";
import { useCourses } from "@/hooks/useCourses";
import { useDraft } from "@/hooks/useDraft";
import { dateKey } from "@/lib/dates";
import { setAttendance } from "@/db/actions";
import { CourseSelect, Field, Segmented } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";

export default function AttendanceForm({ open, onClose, defaults }: { open: boolean; onClose: () => void; defaults?: { courseId?: number; date?: string } }) {
  const { currentCourses } = useCourses();
  const { draft, set } = useDraft<{ courseId?: number; date: string; status: AttendanceStatus }>(open, { courseId: defaults?.courseId, date: defaults?.date ?? dateKey(), status: "Present" });
  return (
    <FormModal
      open={open} onClose={onClose} title="Log attendance" description="Logging the same course and day again replaces the earlier entry." submitLabel="Save"
      onSubmit={async () => {
        if (!draft.courseId) return "Pick a course.";
        await setAttendance(draft.courseId, draft.date, draft.status);
      }}
    >
      <Field label="Course">{(id) => <CourseSelect id={id} value={draft.courseId} courses={currentCourses} placeholder="Select a course" onChange={(v) => set("courseId", v)} />}</Field>
      <Field label="Date">{(id) => <input id={id} type="date" className="input" max={dateKey()} value={draft.date} onChange={(e) => set("date", e.target.value)} />}</Field>
      <div><span className="label">Status</span><Segmented label="Attendance status" value={draft.status} options={["Present", "Absent", "Excused"] as const} onChange={(v) => set("status", v)} /></div>
    </FormModal>
  );
}
