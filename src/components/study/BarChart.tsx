"use client";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/dates";

export interface Bar { label: string; value: number; highlight?: boolean; sub?: string }

/** Minimal dependency-free bar chart. Values are minutes. Has a text alternative for screen readers. */
export function BarChart({ bars, goal, height = 120, caption }: { bars: Bar[]; goal?: number; height?: number; caption: string }) {
  const max = Math.max(1, goal ?? 0, ...bars.map((b) => b.value));
  return (
    <figure>
      <figcaption className="sr-only">{caption}: {bars.map((b) => `${b.label} ${formatMinutes(b.value)}`).join(", ")}</figcaption>
      <div className="relative flex items-end gap-1" style={{ height }} aria-hidden="true">
        {goal ? <div className="absolute inset-x-0 border-t border-dashed border-ink-faint/60" style={{ bottom: `${(goal / max) * 100}%` }} /> : null}
        {bars.map((b, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${b.label}: ${formatMinutes(b.value)}`}>
            <div className={cn("w-full rounded-t-md transition-[height] duration-500", b.highlight ? "bg-accent" : "bg-accent/45", b.value === 0 && "bg-surface-sunken")}
              style={{ height: `${Math.max(b.value === 0 ? 3 : 6, (b.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1" aria-hidden="true">
        {bars.map((b, i) => <span key={i} className={cn("min-w-0 flex-1 truncate text-center text-[10px]", b.highlight ? "font-semibold text-ink" : "text-ink-muted")}>{b.label}</span>)}
      </div>
    </figure>
  );
}

export function HBar({ label, value, max, sub }: { label: string; value: number; max: number; sub?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm"><span className="truncate font-medium">{label}</span><span className="shrink-0 tabular text-ink-muted">{formatMinutes(value)}{sub ? ` · ${sub}` : ""}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label={`${label}: ${formatMinutes(value)}`}><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(value / Math.max(1, max)) * 100}%` }} /></div>
    </div>
  );
}
