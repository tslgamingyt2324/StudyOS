"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SubTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 rounded-xl bg-surface-sunken/60 p-1">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex-1 rounded-lg py-2 text-center text-xs font-semibold transition-colors",
              active ? "bg-surface-raised text-ink shadow-card" : "text-ink-muted"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
