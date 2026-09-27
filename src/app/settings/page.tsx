"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { Download, Upload, RotateCcw } from "lucide-react";
import { db } from "@/db/db";
import { useTheme } from "@/lib/theme";
import { Grade } from "@/types";

export default function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!settings) return null;
  const update = (patch: Partial<typeof settings>) => db.settings.update(settings.id!, patch);

  const exportData = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      semesters: await db.semesters.toArray(),
      courses: await db.courses.toArray(),
      routineItems: await db.routineItems.toArray(),
      tasks: await db.tasks.toArray(),
      studySessions: await db.studySessions.toArray(),
      exams: await db.exams.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `naffiz-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Backup downloaded.");
  };

  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await db.transaction("rw", [db.semesters, db.courses, db.routineItems, db.tasks, db.studySessions, db.exams, db.settings], async () => {
        await Promise.all([db.semesters.clear(), db.courses.clear(), db.routineItems.clear(), db.tasks.clear(), db.studySessions.clear(), db.exams.clear(), db.settings.clear()]);
        if (data.semesters) await db.semesters.bulkAdd(data.semesters);
        if (data.courses) await db.courses.bulkAdd(data.courses);
        if (data.routineItems) await db.routineItems.bulkAdd(data.routineItems);
        if (data.tasks) await db.tasks.bulkAdd(data.tasks);
        if (data.studySessions) await db.studySessions.bulkAdd(data.studySessions);
        if (data.exams) await db.exams.bulkAdd(data.exams);
        if (data.settings) await db.settings.bulkAdd(data.settings);
      });
      setStatus("Data restored successfully. Reload the app to see it everywhere.");
    } catch (e) {
      setStatus("Import failed — the file wasn't a valid Naffiz OS backup.");
    }
  };

  const resetApp = async () => {
    if (!confirm("This will permanently delete all data. Continue?")) return;
    await db.delete();
    window.location.reload();
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Profile</h2>
        <input defaultValue={settings.userName} onBlur={(e) => update({ userName: e.target.value })} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2 text-sm" />
        <p className="text-xs text-ink-faint">{settings.university} · {settings.department}</p>
        <label className="block text-xs text-ink-muted pt-1">
          Current semester number
          <input
            type="number" min={1} defaultValue={settings.semesterNumber}
            onBlur={(e) => update({ semesterNumber: parseInt(e.target.value) || 1 })}
            className="mt-1 w-24 rounded-lg border border-border bg-surface-sunken/50 px-3 py-2"
          />
        </label>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Reminders</h2>
        <p className="text-xs text-ink-faint">
          These preferences are saved now, but real push notifications on iPhone only work once the app is
          installed to your Home Screen (Settings → Backup for the install guide) and you grant notification
          permission — a browser tab alone can't deliver them.
        </p>
        {[
          { key: "remindStudyGoal" as const, label: "Daily study goal reminder" },
          { key: "remindUpcomingClass" as const, label: "Upcoming class reminder" },
          { key: "remindDeadlines" as const, label: "Assignment deadline reminder" },
          { key: "remindExams" as const, label: "Upcoming exam reminder" },
        ].map((r) => (
          <div key={r.key} className="flex items-center justify-between text-sm">
            <span>{r.label}</span>
            <input type="checkbox" checked={settings[r.key]} onChange={(e) => update({ [r.key]: e.target.checked } as any)} className="h-5 w-5 accent-accent" />
          </div>
        ))}
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Theme</h2>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)} className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize ${theme === t ? "bg-accent text-white" : "bg-surface-sunken/60"}`}>
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Grade Scale</h2>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(settings.gradeScale) as Grade[]).filter((g) => g).map((g) => (
            <label key={g} className="text-xs text-ink-muted">
              {g}
              <input
                type="number" step="0.1" defaultValue={settings.gradeScale[g]}
                onBlur={(e) => update({ gradeScale: { ...settings.gradeScale, [g]: parseFloat(e.target.value) } })}
                className="mt-1 w-full rounded-lg border border-border bg-surface-sunken/50 px-2 py-1"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Retake Rules</h2>
        <div className="flex items-center justify-between text-sm">
          <span>Retake replaces old grade in GPA</span>
          <input type="checkbox" checked={settings.retakeReplacesOldGrade} onChange={(e) => update({ retakeReplacesOldGrade: e.target.checked })} className="h-5 w-5 accent-accent" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Retake credit counts once</span>
          <input type="checkbox" checked={settings.retakeCreditCountsOnce} onChange={(e) => update({ retakeCreditCountsOnce: e.target.checked })} className="h-5 w-5 accent-accent" />
        </div>
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Daily Study Goal</h2>
        <p className="text-xs text-ink-faint">The Dashboard and Study Timer track your progress toward this every day.</p>
        <div className="flex items-center gap-2">
          <input
            type="number" step="0.5" min="0"
            defaultValue={(settings.dailyStudyGoalMinutes || 240) / 60}
            onBlur={(e) => update({ dailyStudyGoalMinutes: Math.round(parseFloat(e.target.value || "4") * 60) })}
            className="w-24 rounded-lg border border-border bg-surface-sunken/50 px-3 py-2"
          />
          <span className="text-sm text-ink-muted">hours / day</span>
        </div>
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Attendance Threshold</h2>
        <input type="number" defaultValue={settings.attendanceThreshold} onBlur={(e) => update({ attendanceThreshold: parseInt(e.target.value) })} className="w-full rounded-lg border border-border bg-surface-sunken/50 px-3 py-2" />
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Backup & Restore</h2>
        <button onClick={exportData} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-white"><Download size={16} /> Export JSON Backup</button>
        <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-sunken/60 py-3 font-semibold"><Upload size={16} /> Import Backup</button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        {status && <p className="text-xs text-ink-muted text-center">{status}</p>}
      </section>

      <section className="card p-4">
        <button onClick={resetApp} className="flex w-full items-center justify-center gap-2 rounded-xl bg-bad/10 py-3 font-semibold text-bad"><RotateCcw size={16} /> Reset Application</button>
      </section>
    </div>
  );
}
