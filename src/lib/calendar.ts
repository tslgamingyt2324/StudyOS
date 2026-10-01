import { CalendarEvent, Course, Exam, RoutineItem, StudySession, Task } from "@/types";
import { addDays, dateKey, dueInstant } from "@/lib/dates";
import { WEEKDAY_LONG } from "@/lib/stats";
import { classEndTime } from "@/lib/classTime";

export type EventSource = "class" | "exam" | "task" | "routine" | "study" | "event";

export interface UnifiedEvent {
  /** Unique across sources, e.g. "exam-12" or "class-3-2026-10-05-0". */
  uid: string;
  source: EventSource;
  refId?: number;
  title: string;
  subtitle?: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  courseId?: number;
  location?: string;
  /** Can be moved by dragging (its date is user-editable data). */
  movable: boolean;
  done?: boolean;
}

export const SOURCE_STYLE: Record<EventSource, { label: string; dot: string; chip: string }> = {
  class: { label: "Class", dot: "bg-accent", chip: "bg-accent/15 text-accent" },
  exam: { label: "Exam", dot: "bg-bad", chip: "bg-bad/15 text-bad" },
  task: { label: "Deadline", dot: "bg-warn", chip: "bg-warn/15 text-warn" },
  routine: { label: "Routine", dot: "bg-teal-500", chip: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
  study: { label: "Study", dot: "bg-good", chip: "bg-good/15 text-good" },
  event: { label: "Event", dot: "bg-violet-500", chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
};

export interface CalendarInput {
  from: Date;
  to: Date; // inclusive
  courses: Course[]; // courses whose class schedule should appear (current semester)
  allCourses: Course[]; // for code lookups
  exams: Exam[];
  tasks: Task[];
  routine: RoutineItem[];
  sessions: StudySession[];
  events: CalendarEvent[];
}

/** Expands every data source into concrete events for the requested range. */
export function buildEvents(input: CalendarInput): UnifiedEvent[] {
  const out: UnifiedEvent[] = [];
  const fromKey = dateKey(input.from);
  const toKey = dateKey(input.to);
  const code = (id?: number) => input.allCourses.find((c) => c.id === id)?.code;

  // Recurring: classes + routine, expanded day by day.
  for (let d = new Date(input.from.getFullYear(), input.from.getMonth(), input.from.getDate()); dateKey(d) <= toKey; d = addDays(d, 1)) {
    const key = dateKey(d);
    const dayName = WEEKDAY_LONG[d.getDay()];
    for (const c of input.courses) {
      (c.schedule ?? []).forEach((s, i) => {
        if (!s.days.includes(dayName)) return;
        out.push({
          uid: `class-${c.id}-${key}-${i}`, source: "class", refId: c.id, title: c.code,
          subtitle: c.title, date: key, startTime: s.startTime, endTime: classEndTime(s), allDay: false,
          courseId: c.id, location: c.room, movable: false,
        });
      });
    }
    for (const r of input.routine) {
      const applies = r.daysOfWeek.length === 0 ? r.date === key : r.daysOfWeek.includes(d.getDay());
      if (!applies) continue;
      out.push({
        uid: `routine-${r.id}-${key}`, source: "routine", refId: r.id, title: r.title, subtitle: r.category,
        date: key, startTime: r.startTime, endTime: r.endTime, allDay: false, movable: false,
        done: r.completedDates.includes(key),
      });
    }
  }

  for (const e of input.exams) {
    if (e.date < fromKey || e.date > toKey) continue;
    out.push({
      uid: `exam-${e.id}`, source: "exam", refId: e.id, title: `${code(e.courseId) ?? "Exam"} · ${e.title}`,
      subtitle: e.examType, date: e.date, startTime: e.time, allDay: !e.time, courseId: e.courseId,
      location: e.location, movable: true,
    });
  }

  for (const t of input.tasks) {
    if (!t.deadline) continue;
    const due = dueInstant(t.deadline);
    const key = dateKey(due);
    if (key < fromKey || key > toKey) continue;
    const hasTime = t.deadline.length > 10;
    out.push({
      uid: `task-${t.id}`, source: "task", refId: t.id, title: t.title,
      subtitle: [code(t.courseId), t.category].filter(Boolean).join(" · "), date: key,
      startTime: hasTime ? t.deadline.slice(11, 16) : undefined, allDay: !hasTime, courseId: t.courseId,
      movable: t.status !== "Completed", done: t.status === "Completed",
    });
  }

  for (const s of input.sessions) {
    if (!s.completed) continue;
    const start = new Date(s.startedAt);
    const key = dateKey(start);
    if (key < fromKey || key > toKey) continue;
    const end = new Date(start.getTime() + s.actualMinutes * 60000);
    const hh = (x: Date) => `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
    out.push({
      uid: `study-${s.id}`, source: "study", refId: s.id,
      title: `${s.isQuickStudy ? "Quick Study" : code(s.courseId) ?? "Study"} · ${s.actualMinutes}m`,
      subtitle: s.studyType, date: key, startTime: hh(start), endTime: hh(end), allDay: false,
      courseId: s.courseId, movable: false,
    });
  }

  for (const ev of input.events) {
    if (ev.date < fromKey || ev.date > toKey) continue;
    out.push({
      uid: `event-${ev.id}`, source: "event", refId: ev.id, title: ev.title, subtitle: ev.kind,
      date: ev.date, startTime: ev.allDay ? undefined : ev.startTime, endTime: ev.allDay ? undefined : ev.endTime,
      allDay: ev.allDay, courseId: ev.courseId, location: ev.location, movable: true,
    });
  }

  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });
}

export function groupByDate(events: UnifiedEvent[]): Map<string, UnifiedEvent[]> {
  const map = new Map<string, UnifiedEvent[]>();
  for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
  return map;
}

/** New deadline string after moving a task to `newDate`, preserving any time-of-day. */
export function moveDeadline(oldDeadline: string, newDate: string): string {
  return oldDeadline.length > 10 ? `${newDate}T${oldDeadline.slice(11, 16)}` : newDate;
}

