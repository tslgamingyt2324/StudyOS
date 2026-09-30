"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pause, Timer } from "lucide-react";
import { useStudyTimer } from "@/lib/studyTimer";
import { useCourses } from "@/hooks/useCourses";

/** Small persistent indicator so a running timer is never out of sight. */
export default function ActiveTimerPill() {
  const { active, elapsedSeconds, remainingSeconds } = useStudyTimer();
  const { byId } = useCourses();
  const pathname = usePathname();
  if (!active || pathname.startsWith("/study/timer") || pathname.startsWith("/study/focus")) return null;

  const quick = active.mode === "Quick";
  const secs = quick ? elapsedSeconds : Math.abs(remainingSeconds);
  const clock = `${quick || remainingSeconds >= 0 ? "" : "+"}${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const paused = active.status === "paused";

  return (
    <Link
      href="/study/timer"
      aria-label={`Study timer ${paused ? "paused" : "running"} at ${clock}. Open timer.`}
      className="fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-pop lg:bottom-6"
      style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {paused ? <Pause size={14} aria-hidden="true" /> : <Timer size={14} aria-hidden="true" />}
      <span className="tabular">{clock}</span>
      <span className="hidden text-white/80 xs:inline">· {quick ? "Quick Study" : byId(active.courseId)?.code ?? "Study"}</span>
    </Link>
  );
}
