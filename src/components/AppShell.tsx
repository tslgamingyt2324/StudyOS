"use client";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { runDataMigrations } from "@/db/db";
import { ThemeProvider } from "@/lib/theme";
import { StudyTimerProvider } from "@/lib/studyTimer";
import { ToastProvider } from "@/components/shell/Toast";
import { QuickAddProvider, useQuickAdd } from "@/components/shell/QuickAdd";
import { BottomNav, SectionTabs, Sidebar } from "@/components/shell/Navigation";
import CommandPalette from "@/components/shell/CommandPalette";
import SessionComplete from "@/components/shell/SessionComplete";
import ActiveTimerPill from "@/components/shell/ActiveTimerPill";
import { AchievementWatcher, ReminderEngine } from "@/components/shell/Background";
import { ErrorNote } from "@/components/ui";

function Frame({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const quick = useQuickAdd();
  const pathname = usePathname();
  const focus = pathname.startsWith("/study/focus");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (focus) return <main id="main">{children}<SessionComplete /></main>;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <Sidebar onSearch={() => setSearchOpen(true)} onQuickAdd={() => quick.open("menu")} />
      <div className="lg:pl-64">
        <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          <div className="mb-3 flex justify-end lg:hidden">
            <button onClick={() => setSearchOpen(true)} className="icon-btn -mb-2" aria-label="Search"><SearchIcon /></button>
          </div>
          <SectionTabs />
          {children}
        </main>
      </div>
      <BottomNav onQuickAdd={() => quick.open("menu")} />
      <ActiveTimerPill />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <SessionComplete />
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runDataMigrations()
      .catch((e) => setError(e instanceof Error ? e.message : "Local storage could not be opened."))
      .finally(() => setReady(true));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface" role="status" aria-label="Loading StudyOS">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6">
        <h1 className="text-xl font-bold">StudyOS can't open its storage</h1>
        <ErrorNote message={error} />
        <p className="text-sm text-ink-muted">Private browsing modes and some storage-restricted browsers block IndexedDB. Try a normal window, then reload.</p>
      </div>
    );
  }
  return (
    <ThemeProvider>
      <ToastProvider>
        <StudyTimerProvider>
          <QuickAddProvider>
            <Frame>{children}</Frame>
            <ReminderEngine />
            <AchievementWatcher />
          </QuickAddProvider>
        </StudyTimerProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
