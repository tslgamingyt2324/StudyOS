"use client";
import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCircle2, Trophy } from "lucide-react";
import Link from "next/link";

type ToastKind = "success" | "reminder" | "achievement";
interface ToastItem { id: number; kind: ToastKind; title: string; body?: string; href?: string }
const Ctx = createContext<{ toast: (t: Omit<ToastItem, "id">) => void }>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++counter;
    setItems((cur) => [...cur.slice(-2), { ...t, id }]);
    window.setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), t.kind === "success" ? 3500 : 8000);
  }, []);
  const icons = { success: CheckCircle2, reminder: Bell, achievement: Trophy };

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 px-4"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }} role="status" aria-live="polite"
      >
        <AnimatePresence>
          {items.map((t) => {
            const Icon = icons[t.kind];
            const inner = (
              <>
                <Icon size={18} className={t.kind === "success" ? "text-good" : "text-accent"} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.body && <p className="text-xs text-ink-muted">{t.body}</p>}
                </div>
              </>
            );
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                className="card pointer-events-auto flex w-full max-w-sm items-start gap-3 p-3 shadow-pop">
                {t.href ? <Link href={t.href} className="flex items-start gap-3">{inner}</Link> : inner}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
