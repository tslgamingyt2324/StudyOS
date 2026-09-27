"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, GraduationCap, CalendarClock, Timer, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home, match: "/" },
  { href: "/academics", label: "Academics", icon: GraduationCap, match: "/academics" },
  { href: "/planner/routine", label: "Planner", icon: CalendarClock, match: "/planner" },
  { href: "/study/timer", label: "Study", icon: Timer, match: "/study" },
  { href: "/settings", label: "More", icon: Settings, match: "/settings" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl"
      style={{
        background: "color-mix(in srgb, var(--surface-raised) 85%, transparent)",
        borderColor: "var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex max-w-xl items-stretch justify-between px-2">
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = match === "/" ? pathname === "/" : pathname.startsWith(match);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-2 min-h-[44px] justify-center"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={cn(active ? "text-accent" : "text-ink-faint")}
              />
              <span className={cn("text-[10px] font-medium", active ? "text-accent" : "text-ink-faint")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
