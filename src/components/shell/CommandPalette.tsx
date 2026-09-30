"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Search, BookOpen, ListTodo, ClipboardList, StickyNote, Timer, Target, CalendarDays, CornerDownLeft, Compass, Plus, LucideIcon,
} from "lucide-react";
import { db } from "@/db/db";
import { NAV } from "@/lib/nav";
import { QUICK_ACTIONS, useQuickAdd } from "@/components/shell/QuickAdd";
import { shortDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/dates";
import Modal from "@/components/ui/Modal";

interface Result { id: string; group: string; title: string; subtitle?: string; icon: LucideIcon; run: () => void }

const GROUP_ORDER = ["Actions", "Pages", "Courses", "Tasks", "Exams", "Notes", "Study sessions", "Goals", "Calendar events"];
const has = (hay: string | undefined, q: string) => !!hay && hay.toLowerCase().includes(q);

/** Global search (Ctrl/⌘ + K). Data is only queried while the palette is open. */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const quick = useQuickAdd();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const data = useLiveQuery(async () => {
    if (!open) return null;
    const [courses, tasks, exams, notes, sessions, goals, events] = await Promise.all([
      db.courses.toArray(), db.tasks.toArray(), db.exams.toArray(), db.notes.toArray(),
      db.studySessions.toArray(), db.goals.toArray(), db.calendarEvents.toArray(),
    ]);
    return { courses, tasks, exams, notes, sessions, goals, events };
  }, [open]);

  useEffect(() => { if (open) { setQuery(""); setCursor(0); } }, [open]);
  useEffect(() => setCursor(0), [query]);

  const go = (href: string) => () => { onClose(); router.push(href); };

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Result[] = [];
    const code = (id?: number) => data?.courses.find((c) => c.id === id)?.code;

    if (!q) {
      QUICK_ACTIONS.slice(0, 5).forEach((a) => out.push({
        id: `a-${a.kind}`, group: "Actions", title: a.kind === "timer" ? a.label : `Add ${a.label.toLowerCase()}`, subtitle: a.hint, icon: a.kind === "timer" ? Timer : Plus,
        run: () => { onClose(); if (a.kind === "timer") router.push("/study/timer"); else quick.open(a.kind); },
      }));
      NAV.flatMap((g) => g.items).slice(0, 8).forEach((p) => out.push({ id: `p-${p.href}`, group: "Pages", title: p.label, icon: p.icon, run: go(p.href) }));
      return out;
    }
    QUICK_ACTIONS.filter((a) => has(a.label, q) || has(a.hint, q)).forEach((a) => out.push({
      id: `a-${a.kind}`, group: "Actions", title: a.kind === "timer" ? a.label : `Add ${a.label.toLowerCase()}`, subtitle: a.hint, icon: Plus,
      run: () => { onClose(); if (a.kind === "timer") router.push("/study/timer"); else quick.open(a.kind); },
    }));
    NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))).filter((p) => has(p.label, q) || has(p.group, q))
      .forEach((p) => out.push({ id: `p-${p.href}`, group: "Pages", title: p.label, subtitle: p.group, icon: Compass, run: go(p.href) }));
    if (!data) return out;

    data.courses.filter((c) => has(c.code, q) || has(c.title, q) || has(c.faculty, q)).slice(0, 6)
      .forEach((c) => out.push({ id: `c-${c.id}`, group: "Courses", title: `${c.code} · ${c.title}`, subtitle: `${c.credits} credits`, icon: BookOpen, run: go(`/academics/courses/${c.id}`) }));
    data.tasks.filter((t) => has(t.title, q) || has(t.description, q) || (t.tags ?? []).some((x) => has(x, q))).slice(0, 6)
      .forEach((t) => out.push({ id: `t-${t.id}`, group: "Tasks", title: t.title, subtitle: [code(t.courseId), t.status].filter(Boolean).join(" · "), icon: ListTodo, run: go("/planner/tasks") }));
    data.exams.filter((e) => has(e.title, q) || has(e.topics, q) || has(code(e.courseId), q)).slice(0, 5)
      .forEach((e) => out.push({ id: `e-${e.id}`, group: "Exams", title: `${code(e.courseId) ?? ""} ${e.title}`.trim(), subtitle: shortDate(e.date), icon: ClipboardList, run: go("/planner/exams") }));
    data.notes.filter((n) => has(n.title, q) || has(n.body, q) || n.tags.some((x) => has(x, q))).slice(0, 6)
      .forEach((n) => out.push({ id: `n-${n.id}`, group: "Notes", title: n.title, subtitle: [code(n.courseId), n.archived ? "Archived" : ""].filter(Boolean).join(" · "), icon: StickyNote, run: go(`/notes?open=${n.id}`) }));
    data.sessions.filter((s) => s.completed && (has(s.taskLabel, q) || has(s.accomplished, q) || has(s.studyType, q) || has(code(s.courseId), q))).slice(-5).reverse()
      .forEach((s) => out.push({ id: `s-${s.id}`, group: "Study sessions", title: `${s.isQuickStudy ? "Quick Study" : code(s.courseId) ?? "Study"} · ${formatMinutes(s.actualMinutes)}`, subtitle: `${shortDate(s.startedAt.slice(0, 10))}${s.taskLabel ? " · " + s.taskLabel : ""}`, icon: Timer, run: go("/study/records") }));
    data.goals.filter((g) => has(g.title, q) || has(g.description, q)).slice(0, 4)
      .forEach((g) => out.push({ id: `g-${g.id}`, group: "Goals", title: g.title, subtitle: g.status, icon: Target, run: go("/study/goals") }));
    data.events.filter((e) => has(e.title, q) || has(e.description, q) || has(e.location, q)).slice(0, 5)
      .forEach((e) => out.push({ id: `v-${e.id}`, group: "Calendar events", title: e.title, subtitle: shortDate(e.date), icon: CalendarDays, run: go("/planner/calendar") }));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, data]);

  const grouped = useMemo(() => {
    const map = new Map<string, Result[]>();
    for (const r of results) map.set(r.group, [...(map.get(r.group) ?? []), r]);
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [results]);
  const flat = grouped.flatMap((g) => g.items);

  useEffect(() => { listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [cursor]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(flat.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); flat[cursor]?.run(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Search">
      <div onKeyDown={onKey} className="-mx-1">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            className="input pl-9" placeholder="Search courses, tasks, exams, notes, goals…" value={query} onChange={(e) => setQuery(e.target.value)}
            role="combobox" aria-expanded="true" aria-controls="search-results" aria-activedescendant={flat[cursor] ? `sr-${flat[cursor].id}` : undefined} aria-label="Search"
          />
        </div>
        <div ref={listRef} id="search-results" role="listbox" className="mt-3 max-h-[50dvh] space-y-3 overflow-y-auto">
          {query && !data && <p className="py-6 text-center text-sm text-ink-muted">Searching…</p>}
          {query && data && flat.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No results for “{query}”.</p>}
          {grouped.map((g) => (
            <div key={g.group}>
              <p className="section-title px-1">{g.group}</p>
              {g.items.map((r) => {
                const idx = flat.indexOf(r);
                const sel = idx === cursor;
                return (
                  <button
                    key={r.id} id={`sr-${r.id}`} role="option" aria-selected={sel} type="button" onClick={r.run} onMouseMove={() => setCursor(idx)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${sel ? "bg-accent-soft" : ""}`}
                  >
                    <r.icon size={16} className="shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      {r.subtitle && <span className="block truncate text-xs text-ink-muted">{r.subtitle}</span>}
                    </span>
                    {sel && <CornerDownLeft size={14} className="text-ink-muted" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
