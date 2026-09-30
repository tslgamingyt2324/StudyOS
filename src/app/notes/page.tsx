"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, Eye, Pencil, Pin, PinOff, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { db } from "@/db/db";
import { Note } from "@/types";
import { noteMatches, useNotes } from "@/hooks/useNotes";
import { useCourses } from "@/hooks/useCourses";
import { renderMarkdown } from "@/lib/markdown";
import { parseTags } from "@/components/forms/TaskForm";
import { Badge, ConfirmDialog, CourseSelect, EmptyState, Field, PageSkeleton, Segmented } from "@/components/ui";
import { cn } from "@/lib/utils";
import { dateKey, shortDate } from "@/lib/dates";

type Scope = "Active" | "Archived";

function NotesInner() {
  const params = useSearchParams();
  const { notes, loading } = useNotes();
  const { courses, byId } = useCourses();
  const [scope, setScope] = useState<Scope>("Active");
  const [q, setQ] = useState("");
  const [courseFilter, setCourseFilter] = useState<number | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Local editing buffer so typing never fights the live query; saved with a short debounce.
  const [buf, setBuf] = useState<{ title: string; body: string; tags: string } | null>(null);
  const open = notes.find((n) => n.id === openId);

  useEffect(() => { const id = Number(params.get("open")); if (id) setOpenId(id); }, [params]);
  useEffect(() => { setBuf(open ? { title: open.title, body: open.body, tags: open.tags.join(", ") } : null); setPreview(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [openId, !!open]);

  // Debounced autosave with a flush: pending edits are written immediately when
  // the note is switched or the page is left, so the last keystrokes are never lost.
  const pending = useRef<{ id: number; title: string; body: string; tags: string } | null>(null);
  const flush = () => {
    const p = pending.current;
    pending.current = null;
    if (p) void db.notes.update(p.id, { title: p.title.trim() || "Untitled", body: p.body, tags: parseTags(p.tags), updatedAt: new Date().toISOString() });
  };
  useEffect(() => {
    if (!open || !buf) return;
    if (buf.title === open.title && buf.body === open.body && buf.tags === open.tags.join(", ")) { pending.current = null; return; }
    pending.current = { id: open.id!, ...buf };
    const t = window.setTimeout(flush, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buf, open]);
  useEffect(() => { const onHide = () => flush(); window.addEventListener("pagehide", onHide); return () => { window.removeEventListener("pagehide", onHide); flush(); }; }, []);
  const selectNote = (id: number | null) => { flush(); setOpenId(id); };

  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);
  const list = useMemo(() => notes.filter((n) => (scope === "Archived") === n.archived && noteMatches(n, q.trim()) && (courseFilter === "all" || n.courseId === courseFilter) && (!tagFilter || n.tags.includes(tagFilter))), [notes, scope, q, courseFilter, tagFilter]);

  const create = async () => {
    const now = new Date().toISOString();
    const id = await db.notes.add({ title: "Untitled", body: "", tags: [], pinned: false, archived: false, courseId: courseFilter === "all" ? undefined : courseFilter, createdAt: now, updatedAt: now });
    setScope("Active"); setOpenId(id as number);
  };
  const patch = (n: Note, p: Partial<Note>) => db.notes.update(n.id!, { ...p, updatedAt: new Date().toISOString() });

  if (loading) return <PageSkeleton />;

  const listPane = (
    <div className={cn("space-y-3", open && "hidden lg:block")}>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notes</h1>
        <button className="btn btn-primary" onClick={create}><Plus size={16} /> New note</button>
      </div>
      <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" /><input className="input pl-9" placeholder="Search notes" aria-label="Search notes" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Show" value={scope} options={["Active", "Archived"] as const} onChange={setScope} />
        <div className="min-w-[10rem] flex-1"><CourseSelect value={courseFilter === "all" ? undefined : courseFilter} courses={courses.filter((c) => notes.some((n) => n.courseId === c.id))} placeholder="All courses" onChange={(v) => setCourseFilter(v ?? "all")} /></div>
      </div>
      {allTags.length > 0 && <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1">{allTags.map((t) => <button key={t} aria-pressed={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? null : t)} className={cn("chip shrink-0", tagFilter === t ? "chip-on" : "chip-off")}>#{t}</button>)}</div>}

      {list.length === 0 ? (
        <div className="card"><EmptyState icon={StickyNote} title={notes.length === 0 ? "No notes yet" : "No notes match"} message={notes.length === 0 ? "Capture lecture notes, formulas and revision lists — and link them to a course." : "Try a different search or filter."} action={notes.length === 0 ? <button className="btn btn-primary" onClick={create}>Write your first note</button> : undefined} /></div>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id}>
              <button onClick={() => selectNote(n.id!)} aria-current={n.id === openId} className={cn("card block w-full p-3.5 text-left transition hover:bg-surface-sunken/40", n.id === openId && "ring-2 ring-accent/50")}>
                <span className="flex items-center gap-1.5">{n.pinned && <Pin size={12} className="shrink-0 text-accent" aria-label="Pinned" />}<span className="truncate text-sm font-semibold">{n.title}</span></span>
                <span className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{n.body.replace(/[#*`>\-\[\]]/g, "").trim() || "Empty note"}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">{n.courseId && <Badge tone="accent">{byId(n.courseId)?.code}</Badge>}{n.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}<span className="ml-auto">{shortDate(dateKey(n.updatedAt))}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {listPane}
      <div className={cn(!open && "hidden lg:block")}>
        {!open || !buf ? (
          <div className="card hidden lg:block"><EmptyState icon={StickyNote} title="Select a note" message="Pick one from the list, or start a new one." /></div>
        ) : (
          <div className="card space-y-3 p-4">
            <div className="flex items-center justify-between gap-1">
              <button className="btn btn-ghost btn-sm lg:hidden" onClick={() => selectNote(null)}><ArrowLeft size={14} /> Notes</button>
              <span className="hidden text-xs text-ink-muted lg:inline">Saved automatically · edited {shortDate(dateKey(open.updatedAt))}</span>
              <div className="ml-auto flex items-center">
                <button className="icon-btn" onClick={() => setPreview((p) => !p)} aria-pressed={preview} aria-label={preview ? "Edit" : "Preview"}>{preview ? <Pencil size={18} /> : <Eye size={18} />}</button>
                <button className="icon-btn" onClick={() => patch(open, { pinned: !open.pinned })} aria-pressed={open.pinned} aria-label={open.pinned ? "Unpin" : "Pin"}>{open.pinned ? <PinOff size={18} /> : <Pin size={18} />}</button>
                <button className="icon-btn" onClick={() => { flush(); patch(open, { archived: !open.archived }); setOpenId(null); }} aria-label={open.archived ? "Unarchive" : "Archive"}>{open.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}</button>
                <button className="icon-btn text-bad" onClick={() => setConfirmDelete(true)} aria-label="Delete note"><Trash2 size={18} /></button>
              </div>
            </div>
            <input aria-label="Note title" className="w-full bg-transparent text-xl font-bold outline-none placeholder:text-ink-faint" placeholder="Title" value={buf.title} onChange={(e) => setBuf({ ...buf, title: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Course">{(id) => <CourseSelect id={id} value={open.courseId} courses={courses} placeholder="No course" onChange={(v) => patch(open, { courseId: v })} />}</Field>
              <Field label="Tags">{(id) => <input id={id} className="input" value={buf.tags} onChange={(e) => setBuf({ ...buf, tags: e.target.value })} placeholder="exam, formulas" />}</Field>
            </div>
            {preview ? (
              buf.body.trim() ? <div className="prose-note min-h-[40dvh]" dangerouslySetInnerHTML={{ __html: renderMarkdown(buf.body) }} /> : <p className="min-h-[40dvh] text-sm text-ink-muted">Nothing to preview yet.</p>
            ) : (
              <textarea aria-label="Note body" className="input min-h-[45dvh] resize-y font-mono text-[14px] leading-relaxed" placeholder={"Write here. Markdown works:\n# Heading\n- list item\n- [ ] checklist\n**bold** and *italic*"} value={buf.body} onChange={(e) => setBuf({ ...buf, body: e.target.value })} />
            )}
            <p className="text-[11px] text-ink-faint">Created {shortDate(dateKey(open.createdAt))} · updated {shortDate(dateKey(open.updatedAt))}</p>
          </div>
        )}
      </div>
      <ConfirmDialog open={confirmDelete} danger title="Delete this note?" confirmLabel="Delete" message="This can't be undone. Consider archiving it instead." onCancel={() => setConfirmDelete(false)} onConfirm={async () => { setConfirmDelete(false); if (open?.id !== undefined) { await db.notes.delete(open.id); setOpenId(null); } }} />
    </div>
  );
}

export default function NotesPage() { return <Suspense fallback={<PageSkeleton />}><NotesInner /></Suspense>; }
