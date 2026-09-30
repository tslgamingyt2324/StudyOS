"use client";
import { db } from "@/db/db";
import { CalendarEvent, CalendarEventKind } from "@/types";
import { useCourses } from "@/hooks/useCourses";
import { useDraft } from "@/hooks/useDraft";
import { dateKey } from "@/lib/dates";
import { CourseSelect, Field, Segmented, ToggleRow } from "@/components/ui";
import FormModal from "@/components/forms/FormModal";

const KINDS: CalendarEventKind[] = ["General", "Study", "Class", "Personal"];

export default function EventForm({ open, onClose, initial, defaults }: { open: boolean; onClose: () => void; initial?: CalendarEvent; defaults?: Partial<CalendarEvent> }) {
  const { currentCourses } = useCourses();
  const { draft, set } = useDraft<CalendarEvent>(open, initial ?? { title: "", kind: "General", date: dateKey(), allDay: false, startTime: "09:00", endTime: "10:00", ...defaults });

  return (
    <FormModal
      open={open} onClose={onClose} title={initial ? "Edit event" : "New event"} submitLabel={initial ? "Save changes" : "Add event"}
      onSubmit={async () => {
        if (!draft.title.trim()) return "Give the event a title.";
        if (!draft.date) return "Pick a date.";
        if (!draft.allDay && draft.startTime && draft.endTime && draft.endTime <= draft.startTime) return "End time must be after the start time.";
        const row: CalendarEvent = {
          ...draft, title: draft.title.trim(),
          startTime: draft.allDay ? undefined : draft.startTime, endTime: draft.allDay ? undefined : draft.endTime,
        };
        if (initial?.id !== undefined) await db.calendarEvents.put({ ...row, id: initial.id });
        else await db.calendarEvents.add(row);
      }}
      onDelete={initial?.id !== undefined ? async () => { await db.calendarEvents.delete(initial.id!); } : undefined}
      deleteLabel="Delete event"
    >
      <Field label="Title">{(id) => <input id={id} className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Study group, club meeting…" />}</Field>
      <div><span className="label">Kind</span><Segmented label="Event kind" value={draft.kind} options={KINDS} onChange={(v) => set("kind", v)} /></div>
      <Field label="Date">{(id) => <input id={id} type="date" className="input" value={draft.date} onChange={(e) => set("date", e.target.value)} />}</Field>
      <ToggleRow label="All day" checked={draft.allDay} onChange={(v) => set("allDay", v)} />
      {!draft.allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">{(id) => <input id={id} type="time" className="input" value={draft.startTime ?? ""} onChange={(e) => set("startTime", e.target.value)} />}</Field>
          <Field label="Ends">{(id) => <input id={id} type="time" className="input" value={draft.endTime ?? ""} onChange={(e) => set("endTime", e.target.value)} />}</Field>
        </div>
      )}
      <Field label="Course">{(id) => <CourseSelect id={id} value={draft.courseId} courses={currentCourses} onChange={(v) => set("courseId", v)} />}</Field>
      <Field label="Location">{(id) => <input id={id} className="input" value={draft.location ?? ""} onChange={(e) => set("location", e.target.value)} />}</Field>
      <Field label="Details">{(id) => <textarea id={id} className="input" value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />}</Field>
    </FormModal>
  );
}
