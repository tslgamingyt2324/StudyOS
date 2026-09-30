"use client";
import { TimelineEntry } from "@/lib/degree";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

export default function SemesterTimeline({ entries, onSelect }: { entries: TimelineEntry[]; onSelect?: (e: TimelineEntry) => void }) {
  return (
    <ol className="relative space-y-3 border-l border-border pl-5">
      {entries.map((e) => {
        const Inner = (
          <>
            <span aria-hidden="true" className={cn("absolute -left-[26px] top-4 h-3 w-3 rounded-full border-2 border-surface-raised", e.status === "current" ? "bg-accent ring-4 ring-accent/20" : e.status === "past" ? "bg-good" : "bg-surface-sunken")} />
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{e.label}</p>
              {e.status === "current" ? <Badge tone="accent">Current</Badge> : e.status === "future" ? <Badge>Planned</Badge> : null}
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">
              {e.credits} credits{e.courseCount ? ` · ${e.courseCount} course${e.courseCount === 1 ? "" : "s"}` : ""}
              {e.gpa !== null ? <> · <span className="font-semibold text-ink">{e.gpa.toFixed(2)} GPA</span></> : e.status === "current" ? " · in progress" : ""}
            </p>
          </>
        );
        return (
          <li key={e.key} className="relative">
            {onSelect ? (
              <button type="button" onClick={() => onSelect(e)} className="card block w-full p-3.5 text-left transition hover:bg-surface-sunken/40">{Inner}</button>
            ) : <div className="card p-3.5">{Inner}</div>}
          </li>
        );
      })}
    </ol>
  );
}
