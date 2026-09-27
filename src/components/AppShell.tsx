"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, Timer, ListTodo, FileText, StickyNote, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { runDataMigrations } from "@/db/db";
import { ThemeProvider } from "@/lib/theme";
import { StudyTimerProvider } from "@/lib/studyTimer";
import BottomNav from "@/components/BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    runDataMigrations().finally(() => setReady(true));
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const quickActions = [
    { label: "Start Study Session", icon: Timer, go: "/study/timer" },
    { label: "Add Task", icon: ListTodo, go: "/planner/tasks?new=1" },
    { label: "Add Exam", icon: GraduationCap, go: "/planner/exams?new=1" },
    { label: "Add Routine Item", icon: FileText, go: "/planner/routine?new=1" },
    { label: "Add Note to Course", icon: StickyNote, go: "/academics/courses" },
  ];

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <StudyTimerProvider>
      <div className="mx-auto min-h-screen max-w-xl pb-28">{children}</div>
      <BottomNav />

      <button
        onClick={() => setSheetOpen(true)}
        aria-label="Quick add"
        className="fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }}
      >
        <Plus size={26} />
      </button>

      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl card p-5"
              style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-surface-sunken" />
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Quick Add</h3>
                <button onClick={() => setSheetOpen(false)}><X size={20} className="text-ink-muted" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => { setSheetOpen(false); router.push(a.go); }}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-surface-sunken/60 p-4 active:scale-95 transition-transform min-h-[88px] justify-center"
                  >
                    <a.icon size={22} className="text-accent" />
                    <span className="text-xs font-medium text-center">{a.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </StudyTimerProvider>
    </ThemeProvider>
  );
}
