"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/db/db";

type ThemeMode = "light" | "dark" | "system";
const ThemeContext = createContext<{ theme: ThemeMode; setTheme: (t: ThemeMode) => void }>({
  theme: "system",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");

  useEffect(() => {
    db.settings.toCollection().first().then((s) => {
      if (s?.theme) setThemeState(s.theme);
    });
  }, []);

  // Mirror the choice into localStorage so the inline script in layout.tsx can
  // apply it before first paint next time.
  useEffect(() => {
    try { localStorage.setItem("studyos:theme", theme); } catch { /* blocked storage */ }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const isDark =
        theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = async (t: ThemeMode) => {
    setThemeState(t);
    const s = await db.settings.toCollection().first();
    if (s?.id) await db.settings.update(s.id, { theme: t });
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
