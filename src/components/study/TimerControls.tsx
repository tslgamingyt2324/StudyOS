"use client";
import { useState } from "react";
import { Check, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useStudyTimer } from "@/lib/studyTimer";
import { ConfirmDialog } from "@/components/ui";
import { cn } from "@/lib/utils";

const round = "flex items-center justify-center rounded-full shadow-lg transition active:scale-95";

/** Pause / Resume, Stop (saves), Reset (restart clock) and Discard (delete, confirmed). */
export default function TimerControls({ big }: { big?: boolean }) {
  const { active, pause, resume, finish, reset, discard } = useStudyTimer();
  const [confirm, setConfirm] = useState<"reset" | "discard" | null>(null);
  if (!active) return null;
  const running = active.status === "running";
  const size = big ? "h-20 w-20" : "h-16 w-16";
  return (
    <>
      <div className="flex items-start justify-center gap-5">
        {running
          ? <button onClick={pause} aria-label="Pause" className={cn(round, size, "bg-warn text-white")}><Pause size={26} /></button>
          : <button onClick={resume} aria-label="Resume" className={cn(round, size, "bg-accent text-white")}><Play size={26} /></button>}
        <button onClick={finish} aria-label="Stop and save session" className={cn(round, size, "bg-good text-white")}><Check size={28} /></button>
        <div className="flex flex-col gap-2">
          <button onClick={() => setConfirm("reset")} aria-label="Reset timer" className={cn(round, "h-9 w-9 bg-surface-sunken text-ink")}><RotateCcw size={16} /></button>
          <button onClick={() => setConfirm("discard")} aria-label="Discard session" className={cn(round, "h-9 w-9 bg-surface-sunken text-bad")}><Trash2 size={16} /></button>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink-muted">Stop saves the session · Reset restarts the clock · Discard deletes it</p>
      <ConfirmDialog
        open={confirm === "reset"} title="Reset the timer?" confirmLabel="Reset"
        message="The clock goes back to zero. Course and activity stay the same."
        onCancel={() => setConfirm(null)} onConfirm={async () => { setConfirm(null); await reset(); }}
      />
      <ConfirmDialog
        open={confirm === "discard"} danger title="Discard this session?" confirmLabel="Discard"
        message="The time you've tracked so far will not be saved."
        onCancel={() => setConfirm(null)} onConfirm={async () => { setConfirm(null); await discard(); }}
      />
    </>
  );
}
