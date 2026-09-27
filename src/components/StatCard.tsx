"use client";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnimatedNumber({ value, decimals = 2 }: { value: number; decimals?: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => v.toFixed(decimals));

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.8, ease: "easeOut" });
    return controls.stop;
  }, [value]);

  return <motion.span>{rounded}</motion.span>;
}

export default function StatCard({
  label, value, decimals = 2, sublabel, icon: Icon, tone = "default", delay = 0, textOverride,
}: {
  label: string;
  value: number;
  decimals?: number;
  sublabel?: string;
  icon?: LucideIcon;
  tone?: "default" | "good" | "warn" | "bad";
  delay?: number;
  /** Show this text instead of the animated number — e.g. "Not available" when there's no grade yet. */
  textOverride?: string;
}) {
  const toneClass = {
    default: "text-ink",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="card p-4 flex flex-col gap-1 shadow-card"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {Icon && <Icon size={16} className="text-ink-faint" />}
      </div>
      <span className={cn(textOverride ? "text-lg font-semibold" : "text-2xl font-bold tracking-tight", toneClass)}>
        {textOverride ?? <AnimatedNumber value={value} decimals={decimals} />}
      </span>
      {sublabel && <span className="text-[11px] text-ink-faint">{sublabel}</span>}
    </motion.div>
  );
}
