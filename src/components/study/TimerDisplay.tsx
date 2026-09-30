"use client";
import { motion } from "framer-motion";
import { useStudyTimer } from "@/lib/studyTimer";
import { cn } from "@/lib/utils";

/** Circular timer face driven by the persistent timer context. */
export default function TimerDisplay({ size = "md", idleLabel = "Ready" }: { size?: "md" | "xl"; idleLabel?: string }) {
  const { active, elapsedSeconds, remainingSeconds, isOvertime } = useStudyTimer();
  const quick = active?.mode === "Quick";
  const running = active?.status === "running";
  const secs = quick ? elapsedSeconds : Math.abs(remainingSeconds);
  const h = Math.floor(secs / 3600);
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const clock = `${!quick && isOvertime ? "+" : ""}${h > 0 ? `${h}:` : ""}${mm}:${ss}`;
  const progress = active && !quick ? Math.min(1, elapsedSeconds / (active.plannedMinutes * 60)) : 0;
  const c = 2 * Math.PI * 90;
  const label = !active ? idleLabel : quick ? (running ? "Quick Study" : "Paused") : isOvertime ? "Overtime — keep going" : running ? "Focusing" : "Paused";

  return (
    <div
      className={cn("relative mx-auto flex items-center justify-center", size === "xl" ? "h-72 w-72 sm:h-96 sm:w-96" : "h-56 w-56")}
      role="timer" aria-label={`${label} ${clock}`}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="90" fill="none" stroke="rgb(var(--surface-sunken))" strokeWidth={size === "xl" ? 6 : 10} />
        <motion.circle
          cx="100" cy="100" r="90" fill="none" stroke="rgb(var(--accent))" strokeWidth={size === "xl" ? 6 : 10} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }}
          animate={quick ? { strokeDashoffset: 0, opacity: running ? [0.35, 1, 0.35] : 0.6 } : { strokeDashoffset: c * (1 - progress) }}
          transition={quick && running ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5, ease: "linear" }}
        />
      </svg>
      <div className="text-center">
        <p className={cn("font-bold tabular-nums tracking-tight", size === "xl" ? "text-6xl sm:text-7xl" : "text-4xl")} aria-hidden="true">{clock}</p>
        <p className="mt-1 text-xs text-ink-muted" aria-hidden="true">{label}</p>
      </div>
    </div>
  );
}
