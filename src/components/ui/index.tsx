"use client";
import { ReactNode, useId } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Modal from "@/components/ui/Modal";

// ---------------------------------------------------------------- Layout
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <h2 className="section-title !mb-0">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- Feedback
export function EmptyState({
  icon: Icon, title, message, action,
}: { icon?: LucideIcon; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {Icon && <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Icon size={22} aria-hidden="true" /></span>}
      <p className="font-semibold">{title}</p>
      {message && <p className="max-w-sm text-sm text-ink-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-surface-sunken/70", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-40" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{message}</p>;
}

// ---------------------------------------------------------------- Data display
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "accent"; className?: string }) {
  const tones = {
    neutral: "bg-surface-sunken text-ink-muted",
    good: "bg-good/15 text-good",
    warn: "bg-warn/15 text-warn",
    bad: "bg-bad/15 text-bad",
    accent: "bg-accent-soft text-accent",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}

export function Progress({
  value, tone = "accent", label, className, thin,
}: { value: number; tone?: "accent" | "good" | "warn" | "bad"; label?: string; className?: string; thin?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  const bar = { accent: "bg-accent", good: "bg-good", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}
      className={cn("w-full overflow-hidden rounded-full bg-surface-sunken", thin ? "h-1.5" : "h-2.5", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tracking-tight tabular", tone === "good" && "text-good", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Form bits
export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children(id)}
      {hint && <p className="mt-1 text-[11px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  value, options, onChange, label,
}: { value?: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o} type="button" role="radio" aria-checked={value === o}
          onClick={() => onChange(o)} className={cn("chip", value === o ? "chip-on" : "chip-off")}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-surface-sunken")}
    >
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function CourseSelect({
  id, value, onChange, courses, placeholder = "No course", required,
}: {
  id?: string; value: number | undefined; onChange: (v: number | undefined) => void;
  courses: { id?: number; code: string; title?: string }[]; placeholder?: string; required?: boolean;
}) {
  return (
    <select id={id} required={required} className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}>
      <option value="">{placeholder}</option>
      {courses.map((c) => <option key={c.id} value={c.id}>{c.code}{c.title ? ` · ${c.title}` : ""}</option>)}
    </select>
  );
}

// ---------------------------------------------------------------- Dialogs
export function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel,
}: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal
      open={open} onClose={onCancel} title={title}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={onCancel}>Cancel</button>
          <button className={cn("btn flex-1", danger ? "bg-bad text-white" : "btn-primary")} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      }
    >
      <div className="text-sm text-ink-muted">{message}</div>
    </Modal>
  );
}
