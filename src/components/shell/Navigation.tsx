"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreHorizontal, Plus, Search, StickyNote, Settings, Target, Timer, LucideIcon } from "lucide-react";
import { NAV, groupFor, isActive } from "@/lib/nav";
import { cn } from "@/lib/utils";
import Modal from "@/components/ui/Modal";

export function Sidebar({ onSearch, onQuickAdd }: { onSearch: () => void; onQuickAdd: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface-raised lg:flex" aria-label="Primary">
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white" aria-hidden="true">S</span>
        <span className="text-lg font-bold tracking-tight">StudyOS</span>
      </div>
      <div className="space-y-2 px-3 pb-2">
        <button onClick={onQuickAdd} className="btn btn-primary w-full"><Plus size={16} /> Quick add</button>
        <button onClick={onSearch} className="btn btn-secondary w-full justify-between font-normal text-ink-muted">
          <span className="flex items-center gap-2"><Search size={15} /> Search</span>
          <kbd className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</kbd>
        </button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {NAV.map((g) => (
          <div key={g.key}>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">{g.key === "home" ? "Home" : g.label}</p>
            {g.items.map((i) => {
              const active = isActive(pathname, i.href, g.items.some((o) => o !== i && o.href.startsWith(i.href + "/")));
              return (
                <Link
                  key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-[38px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", active ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-surface-sunken/60 hover:text-ink")}
                >
                  <i.icon size={17} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" /> {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

// Mobile bottom bar: exactly five equal slots — Home · Academics · [+] · Planner · More.
const LEFT_TABS = [NAV[0], NAV[1]];
const RIGHT_TABS = [NAV[2]];
const MORE_ITEMS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: "/study/timer", label: "Study", hint: "Timer, sessions, analytics", icon: Timer },
  { href: "/notes", label: "Notes", hint: "Capture and search ideas", icon: StickyNote },
  { href: "/study/goals", label: "Goals", hint: "Targets and progress", icon: Target },
  { href: "/settings", label: "Settings", hint: "Reminders, theme, backup", icon: Settings },
];
const MORE_KEYS = ["study", "knowledge", "system"];

export function BottomNav({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const current = groupFor(pathname);
  const moreActive = !!current && MORE_KEYS.includes(current.key);
  // Close the sheet if the route changes underneath it (e.g. back button).
  useEffect(() => { setMore(false); }, [pathname]);

  const slot = "flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 transition-colors active:bg-surface-sunken/60";
  const tab = (g: (typeof NAV)[number]) => {
    const active = current?.key === g.key;
    return (
      <Link key={g.key} href={g.href} aria-current={active ? "page" : undefined} className={slot}>
        <g.icon size={22} strokeWidth={active ? 2.4 : 1.8} className={active ? "text-accent" : "text-ink-muted"} aria-hidden="true" />
        <span className={cn("max-w-full truncate text-[10px] font-medium", active ? "text-accent" : "text-ink-muted")}>{g.label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border backdrop-blur-xl lg:hidden"
        style={{
          background: "color-mix(in srgb, rgb(var(--surface-raised)) 88%, transparent)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          // Symmetric side insets (the larger of the two) so the centre slot stays on the screen's centre line in landscape.
          paddingInline: "max(env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))",
        }}>
        {/* Five equal columns: the middle column's centre IS the screen centre — no offsets or margins. */}
        <div className="mx-auto grid max-w-xl grid-cols-5 items-center px-1">
          {LEFT_TABS.map(tab)}
          <div className="flex items-center justify-center">
            <button type="button" onClick={onQuickAdd} aria-label="Quick add" aria-haspopup="dialog"
              className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-pop ring-4 ring-[rgb(var(--surface))] transition active:scale-95">
              <Plus size={28} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
          {RIGHT_TABS.map(tab)}
          <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" aria-label="More" aria-current={moreActive ? "page" : undefined} className={slot}>
            <MoreHorizontal size={22} strokeWidth={moreActive ? 2.4 : 1.8} className={moreActive ? "text-accent" : "text-ink-muted"} aria-hidden="true" />
            <span className={cn("text-[10px] font-medium", moreActive ? "text-accent" : "text-ink-muted")}>More</span>
          </button>
        </div>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="More">
        <div className="space-y-1">
          {MORE_ITEMS.map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setMore(false)} className="flex min-h-[56px] items-center gap-3 rounded-xl px-3 hover:bg-surface-sunken/50 active:bg-surface-sunken/70">
              <i.icon size={20} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0"><span className="block font-medium">{i.label}</span><span className="block truncate text-xs text-ink-muted">{i.hint}</span></span>
            </Link>
          ))}
        </div>
      </Modal>
    </>
  );
}

/** Section sub-navigation shown at the top of each area (mobile-friendly, scrolls sideways). */
export function SectionTabs() {
  const pathname = usePathname();
  const g = groupFor(pathname);
  if (!g || g.items.length < 2) return null;
  return (
    <nav aria-label={`${g.label} sections`} className="scroll-thin -mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max min-w-full gap-1 rounded-xl bg-surface-sunken/60 p-1 sm:w-full">
        {g.items.map((i) => {
          const active = pathname === i.href || (i.href !== g.items[0].href && pathname.startsWith(i.href + "/")) || (i.href === g.items[0].href && pathname === i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
              className={cn("flex min-h-[36px] flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors", active ? "bg-surface-raised text-ink shadow-card" : "text-ink-muted hover:text-ink")}>
              {i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

