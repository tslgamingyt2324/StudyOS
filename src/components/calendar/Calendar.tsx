"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus } from "lucide-react";
import { db } from "@/db/db";
import { useCalendar } from "@/hooks/useCalendar";
import { useSettings } from "@/hooks/useSettings";
import { useCourses } from "@/hooks/useCourses";
import { useQuickAdd } from "@/components/shell/QuickAdd";
import { useToast } from "@/components/shell/Toast";
import Modal from "@/components/ui/Modal";
import { PageSkeleton, Segmented, Badge } from "@/components/ui";
import { DayView, MonthView, WeekView } from "@/components/calendar/views";
import EventForm from "@/components/forms/EventForm";
import ExamForm from "@/components/forms/ExamForm";
import TaskForm from "@/components/forms/TaskForm";
import RoutineForm from "@/components/forms/RoutineForm";
import { groupByDate, moveDeadline, SOURCE_STYLE, UnifiedEvent } from "@/lib/calendar";
import { addDays, dateKey, formatClock, longDate, monthGrid, parseKey, weekDays, shortDate } from "@/lib/dates";
import { CalendarEvent, Exam, RoutineItem, Task } from "@/types";
import { cn } from "@/lib/utils";

type View = "Month" | "Week" | "Day";

export default function Calendar() {
  const router = useRouter();
  const quick = useQuickAdd();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { byId } = useCourses();
  const wso = settings?.weekStartsOn ?? 0;

  const [view, setView] = useState<View>("Month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dateKey());
  const [detail, setDetail] = useState<UnifiedEvent | null>(null);
  const [edit, setEdit] = useState<{ kind: "event"; row?: CalendarEvent } | { kind: "exam"; row: Exam } | { kind: "task"; row: Task } | { kind: "routine"; row: RoutineItem } | null>(null);

  const [from, to] = useMemo(() => {
    if (view === "Month") { const g = monthGrid(anchor, wso); return [g[0], g[41]]; }
    if (view === "Week") { const w = weekDays(anchor, wso); return [w[0], w[6]]; }
    return [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()), new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())];
  }, [view, anchor, wso]);
  const { events, loading } = useCalendar(from, to);
  const byDate = useMemo(() => groupByDate(events), [events]);

  if (!settings) return <PageSkeleton />;

  const step = (dir: -1 | 1) => setAnchor((a) =>
    view === "Month" ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, dir * (view === "Week" ? 7 : 1)));
  const goToday = () => { const t = new Date(); setAnchor(t); setSelected(dateKey(t)); };
  const title = view === "Month" ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : view === "Week" ? `${shortDate(dateKey(from))} – ${shortDate(dateKey(to))}, ${to.getFullYear()}`
    : anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const addOn = (key: string) => quick.open("event", { event: { date: key } });

  const move = async (uid: string, toKey: string) => {
    const e = events.find((x) => x.uid === uid);
    if (!e || !e.movable || e.date === toKey || e.refId === undefined) return;
    if (e.source === "event") await db.calendarEvents.update(e.refId, { date: toKey });
    else if (e.source === "exam") await db.exams.update(e.refId, { date: toKey });
    else if (e.source === "task") {
      const t = await db.tasks.get(e.refId);
      if (t?.deadline) await db.tasks.update(e.refId, { deadline: moveDeadline(t.deadline, toKey) });
    }
    toast({ kind: "success", title: `Moved to ${longDate(toKey)}`, body: e.title });
  };

  const openEdit = async (e: UnifiedEvent) => {
    if (e.refId === undefined) return;
    if (e.source === "event") { const row = await db.calendarEvents.get(e.refId); if (row) setEdit({ kind: "event", row }); }
    if (e.source === "exam") { const row = await db.exams.get(e.refId); if (row) setEdit({ kind: "exam", row }); }
    if (e.source === "task") { const row = await db.tasks.get(e.refId); if (row) setEdit({ kind: "task", row }); }
    if (e.source === "routine") { const row = await db.routineItems.get(e.refId); if (row) setEdit({ kind: "routine", row }); }
    setDetail(null);
  };
  const href = (e: UnifiedEvent) =>
    e.source === "class" ? `/academics/courses/${e.refId}` : e.source === "exam" ? "/planner/exams" : e.source === "task" ? "/planner/tasks"
    : e.source === "routine" ? "/planner/routine" : e.source === "study" ? "/study/records" : "";

  const dayList = view === "Month" ? byDate.get(selected) ?? [] : [];
  const props = { anchor, selected, weekStartsOn: wso, byDate, onSelect: setSelected, onOpen: setDetail, onAdd: addOn, onMove: move };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button className="icon-btn" onClick={() => step(-1)} aria-label={`Previous ${view.toLowerCase()}`}><ChevronLeft size={20} /></button>
          <h1 className="min-w-[10ch] text-center text-lg font-bold tracking-tight sm:text-2xl" aria-live="polite">{title}</h1>
          <button className="icon-btn" onClick={() => step(1)} aria-label={`Next ${view.toLowerCase()}`}><ChevronRight size={20} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-secondary btn-sm" onClick={goToday}>Today</button>
          <Segmented label="Calendar view" value={view} options={["Month", "Week", "Day"] as const} onChange={(v) => { setView(v); if (v === "Day") setAnchor(parseKey(selected)); }} />
          <button className="btn btn-primary btn-sm" onClick={() => addOn(selected)}><Plus size={14} /> Event</button>
        </div>
      </header>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted" aria-label="Legend">
        {Object.entries(SOURCE_STYLE).map(([k, s]) => <li key={k} className="flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", s.dot)} />{s.label}</li>)}
      </ul>

      {loading ? <PageSkeleton /> : view === "Month" ? <MonthView {...props} /> : view === "Week" ? <WeekView {...props} /> : <DayView {...props} />}

      {view === "Month" && !loading && (
        <section aria-label={`Events on ${longDate(selected)}`} className="md:hidden">
          <div className="mb-2 flex items-center justify-between"><h2 className="section-title !mb-0">{longDate(selected)}</h2><button className="btn btn-ghost btn-sm" onClick={() => addOn(selected)}><Plus size={14} /> Add</button></div>
          {dayList.length === 0 ? <p className="card p-4 text-sm text-ink-muted">Nothing scheduled.</p> : (
            <div className="card divide-y divide-border">{dayList.map((e) => (
              <button key={e.uid} onClick={() => setDetail(e)} className="flex w-full items-center gap-3 p-3.5 text-left">
                <span className={cn("h-8 w-1 rounded-full", SOURCE_STYLE[e.source].dot)} aria-hidden="true" />
                <span className="min-w-0 flex-1"><span className={cn("block truncate text-sm font-medium", e.done && "line-through opacity-60")}>{e.title}</span><span className="block text-xs text-ink-muted">{e.allDay ? "All day" : formatClock(e.startTime)}{e.location ? ` · ${e.location}` : ""}</span></span>
                <Badge>{SOURCE_STYLE[e.source].label}</Badge>
              </button>))}</div>
          )}
        </section>
      )}
      <p className="hidden text-[11px] text-ink-faint md:block">Tip: drag your own events, exams and deadlines to another day to reschedule them.</p>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? ""} description={detail ? SOURCE_STYLE[detail.source].label : undefined}
        footer={detail && (
          <div className="flex gap-2">
            {["event", "exam", "task", "routine"].includes(detail.source) && <button className="btn btn-primary flex-1" onClick={() => openEdit(detail)}><Pencil size={15} /> Edit</button>}
            {href(detail) && <button className="btn btn-secondary flex-1" onClick={() => { const h = href(detail); setDetail(null); router.push(h); }}><ExternalLink size={15} /> Open {detail.source === "class" ? "course" : detail.source === "task" ? "tasks" : detail.source === "exam" ? "exams" : detail.source === "routine" ? "routine" : "sessions"}</button>}
          </div>
        )}>
        {detail && (
          <dl className="space-y-3 text-sm">
            <div><dt className="label">When</dt><dd>{longDate(detail.date)} · {detail.allDay ? "All day" : `${formatClock(detail.startTime)}${detail.endTime ? ` – ${formatClock(detail.endTime)}` : ""}`}</dd></div>
            {detail.courseId && <div><dt className="label">Course</dt><dd>{byId(detail.courseId)?.code} · {byId(detail.courseId)?.title}</dd></div>}
            {detail.location && <div><dt className="label">Location</dt><dd>{detail.location}</dd></div>}
            {detail.subtitle && <div><dt className="label">Details</dt><dd>{detail.subtitle}</dd></div>}
            {detail.done !== undefined && <div><dt className="label">Status</dt><dd>{detail.done ? "Done" : "Not done"}</dd></div>}
            {detail.movable && <p className="text-xs text-ink-muted">Drag this to another day on the calendar to reschedule.</p>}
          </dl>
        )}
      </Modal>

      {edit?.kind === "event" && <EventForm open initial={edit.row} onClose={() => setEdit(null)} />}
      {edit?.kind === "exam" && <ExamForm open initial={edit.row} onClose={() => setEdit(null)} />}
      {edit?.kind === "task" && <TaskForm open initial={edit.row} onClose={() => setEdit(null)} />}
      {edit?.kind === "routine" && <RoutineForm open initial={edit.row} onClose={() => setEdit(null)} />}
    </div>
  );
}
