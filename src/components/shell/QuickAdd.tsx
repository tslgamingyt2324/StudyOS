"use client";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Timer, ListTodo, FileText, ClipboardList, CalendarPlus, Repeat, StickyNote, Target, UserCheck, History, LucideIcon,
} from "lucide-react";
import { Goal, Task, Exam, CalendarEvent, PlannedCourse } from "@/types";
import Modal from "@/components/ui/Modal";
import TaskForm from "@/components/forms/TaskForm";
import ExamForm from "@/components/forms/ExamForm";
import EventForm from "@/components/forms/EventForm";
import RoutineForm from "@/components/forms/RoutineForm";
import NoteForm from "@/components/forms/NoteForm";
import GoalForm from "@/components/forms/GoalForm";
import AttendanceForm from "@/components/forms/AttendanceForm";
import StudyLogForm from "@/components/forms/StudyLogForm";
import CourseForm from "@/components/forms/CourseForm";
import SemesterForm from "@/components/forms/SemesterForm";
import PlannedCourseForm from "@/components/forms/PlannedCourseForm";

export type FormKind =
  | "menu" | "task" | "assignment" | "exam" | "event" | "routine" | "note" | "goal" | "attendance" | "study-log"
  | "course" | "semester" | "planned-course";

interface Defaults {
  task?: Partial<Task>; exam?: Partial<Exam>; event?: Partial<CalendarEvent>; goal?: Partial<Goal>;
  courseId?: number; date?: string; planned?: Partial<PlannedCourse>;
}
interface Ctx { open: (kind: FormKind, defaults?: Defaults) => void }
const QuickAddCtx = createContext<Ctx>({ open: () => {} });
export const useQuickAdd = () => useContext(QuickAddCtx);

export const QUICK_ACTIONS: { kind: FormKind | "timer"; label: string; icon: LucideIcon; hint: string }[] = [
  { kind: "timer", label: "Start studying", icon: Timer, hint: "Open the timer" },
  { kind: "study-log", label: "Study session", icon: History, hint: "Log past time" },
  { kind: "task", label: "Task", icon: ListTodo, hint: "To-do item" },
  { kind: "assignment", label: "Assignment", icon: FileText, hint: "Graded work" },
  { kind: "exam", label: "Exam", icon: ClipboardList, hint: "Quiz, midterm, final" },
  { kind: "event", label: "Calendar event", icon: CalendarPlus, hint: "Anything on a date" },
  { kind: "routine", label: "Routine", icon: Repeat, hint: "Repeating block" },
  { kind: "note", label: "Note", icon: StickyNote, hint: "Capture an idea" },
  { kind: "goal", label: "Goal", icon: Target, hint: "Track progress" },
  { kind: "attendance", label: "Attendance", icon: UserCheck, hint: "Present / absent" },
];

/** Global creation dialogs. Any screen can open one with `useQuickAdd().open("task")`. */
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<FormKind | null>(null);
  // A form is mounted only while open (plus a short grace period so its exit
  // animation can play) — closed forms hold no live database queries.
  const [mounted, setMounted] = useState<FormKind | null>(null);
  const [defaults, setDefaults] = useState<Defaults>({});
  const router = useRouter();
  const open = useCallback((k: FormKind, d: Defaults = {}) => { setDefaults(d); setKind(k); }, []);
  const close = useCallback(() => setKind(null), []);
  useEffect(() => {
    if (kind) { setMounted(kind); return; }
    const t = window.setTimeout(() => setMounted(null), 450);
    return () => window.clearTimeout(t);
  }, [kind]);
  const is = (...k: FormKind[]) => mounted !== null && k.includes(mounted);

  return (
    <QuickAddCtx.Provider value={{ open }}>
      {children}
      <Modal open={kind === "menu"} onClose={close} title="Quick add" description="Create anything without leaving this page.">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.kind} type="button"
              onClick={() => { if (a.kind === "timer") { close(); router.push("/study/timer"); } else setKind(a.kind); }}
              className="flex min-h-[92px] flex-col items-start gap-1.5 rounded-2xl border border-border bg-surface-sunken/40 p-3 text-left transition hover:bg-surface-sunken/70 active:scale-[0.98]"
            >
              <a.icon size={20} className="text-accent" aria-hidden="true" />
              <span className="text-sm font-semibold leading-tight">{a.label}</span>
              <span className="text-[11px] text-ink-muted">{a.hint}</span>
            </button>
          ))}
        </div>
      </Modal>
      {is("task", "assignment") && <TaskForm open={kind === "task" || kind === "assignment"} onClose={close} defaults={{ category: mounted === "assignment" ? "Assignment" : "Task", ...defaults.task }} />}
      {is("exam") && <ExamForm open={kind === "exam"} onClose={close} defaults={defaults.exam} />}
      {is("event") && <EventForm open={kind === "event"} onClose={close} defaults={defaults.event} />}
      {is("routine") && <RoutineForm open={kind === "routine"} onClose={close} />}
      {is("note") && <NoteForm open={kind === "note"} onClose={close} defaults={{ courseId: defaults.courseId }} />}
      {is("goal") && <GoalForm open={kind === "goal"} onClose={close} defaults={defaults.goal} />}
      {is("attendance") && <AttendanceForm open={kind === "attendance"} onClose={close} defaults={{ courseId: defaults.courseId, date: defaults.date }} />}
      {is("study-log") && <StudyLogForm open={kind === "study-log"} onClose={close} defaults={{ courseId: defaults.courseId }} />}
      {is("course") && <CourseForm open={kind === "course"} onClose={close} />}
      {is("semester") && <SemesterForm open={kind === "semester"} onClose={close} />}
      {is("planned-course") && <PlannedCourseForm open={kind === "planned-course"} onClose={close} defaults={defaults.planned} />}
    </QuickAddCtx.Provider>
  );
}
