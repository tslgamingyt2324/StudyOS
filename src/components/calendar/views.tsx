"use client";
import { DragEvent } from "react";
import { Plus } from "lucide-react";
import { UnifiedEvent, SOURCE_STYLE } from "@/lib/calendar";
import { dateKey, formatClock, isSameDay, monthGrid, weekDays } from "@/lib/dates";
import { WEEKDAY_SHORT } from "@/lib/stats";
import { cn } from "@/lib/utils";

export interface ViewProps {
  anchor: Date;
  selected: string;
  weekStartsOn: number;
  byDate: Map<string, UnifiedEvent[]>;
  onSelect: (key: string) => void;
  onOpen: (e: UnifiedEvent) => void;
  onAdd: (key: string) => void;
  onMove: (uid: string, toKey: string) => void;
}

const timeLabel = (e: UnifiedEvent) => (e.allDay ? "All day" : `${formatClock(e.startTime)}${e.endTime ? ` – ${formatClock(e.endTime)}` : ""}`);

function Chip({ e, onOpen, compact }: { e: UnifiedEvent; onOpen: (e: UnifiedEvent) => void; compact?: boolean }) {
  const st = SOURCE_STYLE[e.source];
  const drag = (ev: DragEvent) => { ev.dataTransfer.setData("text/plain", e.uid); ev.dataTransfer.effectAllowed = "move"; };
  return (
    <button
      type="button" draggable={e.movable} onDragStart={e.movable ? drag : undefined}
      onClick={(ev) => { ev.stopPropagation(); onOpen(e); }}
      aria-label={`${st.label}: ${e.title}, ${timeLabel(e)}${e.done ? ", done" : ""}`}
      className={cn("flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight", st.chip, e.done && "line-through opacity-60", e.movable && "cursor-grab active:cursor-grabbing")}
    >
      {!compact && e.startTime && <span className="tabular opacity-80">{formatClock(e.startTime).replace(":00", "").replace(" ", "").toLowerCase()}</span>}
      <span className="truncate">{e.title}</span>
    </button>
  );
}

const allow = (ev: DragEvent) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; };

export function MonthView({ anchor, selected, weekStartsOn, byDate, onSelect, onOpen, onAdd, onMove }: ViewProps) {
  const grid = monthGrid(anchor, weekStartsOn);
  const today = new Date();
  const heads = Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(i + weekStartsOn) % 7]);
  return (
    <div role="grid" aria-label={anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })} className="card overflow-hidden">
      <div role="row" className="grid grid-cols-7 border-b border-border bg-surface-sunken/40">
        {heads.map((h) => <div key={h} role="columnheader" className="py-2 text-center text-[11px] font-semibold text-ink-muted">{h}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d) => {
          const key = dateKey(d);
          const list = byDate.get(key) ?? [];
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = isSameDay(d, today);
          const sel = key === selected;
          return (
            <div
              key={key} role="gridcell" aria-selected={sel}
              onDragOver={allow} onDrop={(ev) => { ev.preventDefault(); const uid = ev.dataTransfer.getData("text/plain"); if (uid) onMove(uid, key); }}
              className={cn("group relative min-h-[56px] border-b border-r border-border p-1 md:min-h-[104px]", !inMonth && "bg-surface-sunken/25", sel && "bg-accent-soft")}
            >
              <button type="button" onClick={() => onSelect(key)} onDoubleClick={() => onAdd(key)}
                aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${list.length} event${list.length === 1 ? "" : "s"}`}
                className="absolute inset-0" />
              <div className="pointer-events-none relative flex items-center justify-between">
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", isToday ? "bg-accent text-white" : inMonth ? "" : "text-ink-faint")}>{d.getDate()}</span>
                <button type="button" onClick={() => onAdd(key)} aria-label={`Add event on ${key}`} className="pointer-events-auto hidden h-6 w-6 items-center justify-center rounded-full text-ink-muted opacity-0 hover:bg-surface-sunken group-hover:opacity-100 focus-visible:opacity-100 md:flex"><Plus size={13} /></button>
              </div>
              {/* phones: dots; md+: labelled chips */}
              <div className="pointer-events-none relative mt-0.5 flex flex-wrap justify-center gap-0.5 md:hidden">
                {list.slice(0, 4).map((e) => <span key={e.uid} className={cn("h-1.5 w-1.5 rounded-full", SOURCE_STYLE[e.source].dot)} />)}
              </div>
              <div className="relative mt-0.5 hidden space-y-0.5 md:block">
                {list.slice(0, 3).map((e) => <Chip key={e.uid} e={e} onOpen={onOpen} />)}
                {list.length > 3 && <button type="button" onClick={() => onSelect(key)} className="px-1.5 text-[11px] font-medium text-ink-muted">+{list.length - 3} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeekView({ anchor, selected, weekStartsOn, byDate, onSelect, onOpen, onAdd, onMove }: ViewProps) {
  const days = weekDays(anchor, weekStartsOn);
  const today = new Date();
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((d) => {
        const key = dateKey(d);
        const list = byDate.get(key) ?? [];
        const isToday = isSameDay(d, today);
        return (
          <div key={key} onDragOver={allow} onDrop={(ev) => { ev.preventDefault(); const uid = ev.dataTransfer.getData("text/plain"); if (uid) onMove(uid, key); }}
            className={cn("card flex min-h-[96px] flex-col p-2 md:min-h-[320px]", key === selected && "ring-2 ring-accent/40")}>
            <div className="mb-1.5 flex items-center justify-between">
              <button type="button" onClick={() => onSelect(key)} className="flex items-center gap-2 text-left">
                <span className="text-xs font-semibold text-ink-muted">{WEEKDAY_SHORT[d.getDay()]}</span>
                <span className={cn("flex h-6 min-w-[24px] items-center justify-center rounded-full px-1 text-sm font-bold", isToday && "bg-accent text-white")}>{d.getDate()}</span>
              </button>
              <button type="button" onClick={() => onAdd(key)} aria-label={`Add event on ${key}`} className="icon-btn !min-h-[32px] !min-w-[32px]"><Plus size={14} /></button>
            </div>
            <div className="space-y-1">
              {list.length === 0 && <p className="text-[11px] text-ink-faint">Free</p>}
              {list.map((e) => (
                <div key={e.uid}><Chip e={e} onOpen={onOpen} /></div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DayView({ anchor, byDate, onOpen, onAdd }: ViewProps) {
  const key = dateKey(anchor);
  const list = byDate.get(key) ?? [];
  return (
    <div className="card divide-y divide-border">
      {list.length === 0 && (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <p className="font-semibold">Nothing scheduled</p>
          <p className="text-sm text-ink-muted">Enjoy the free time, or plan something.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => onAdd(key)}><Plus size={14} /> Add event</button>
        </div>
      )}
      {list.map((e) => {
        const st = SOURCE_STYLE[e.source];
        return (
          <button key={e.uid} type="button" onClick={() => onOpen(e)} className="flex w-full items-stretch gap-3 p-4 text-left transition hover:bg-surface-sunken/40">
            <span className={cn("w-1 shrink-0 rounded-full", st.dot)} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-semibold", e.done && "line-through opacity-60")}>{e.title}</span>
              <span className="block text-xs text-ink-muted">{timeLabel(e)}{e.location ? ` · ${e.location}` : ""}</span>
              {e.subtitle && <span className="block text-xs text-ink-muted">{e.subtitle}</span>}
            </span>
            <span className={cn("h-fit rounded-md px-1.5 py-0.5 text-[10px] font-semibold", st.chip)}>{st.label}</span>
          </button>
        );
      })}
    </div>
  );
}

