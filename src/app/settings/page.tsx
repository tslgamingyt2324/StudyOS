"use client";
import { useRef, useState } from "react";
import { Bell, Download, RotateCcw, Upload, AlertTriangle } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/components/shell/Toast";
import Modal from "@/components/ui/Modal";
import { ErrorNote, Field, PageHeader, PageSkeleton, Segmented, ToggleRow } from "@/components/ui";
import { validateBackup, BackupCheck, describeCounts } from "@/lib/backup";
import { backupFilename, downloadJson, exportBackupObject, restoreBackup } from "@/db/backupIo";
import { deleteAllData } from "@/db/db";
import { showSystemNotification } from "@/components/shell/Background";
import { AppSettings, Grade } from "@/types";

const Card = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="card space-y-3 p-4" aria-label={title}>
    <div><h2 className="font-semibold">{title}</h2>{hint && <p className="text-xs text-ink-muted">{hint}</p>}</div>
    {children}
  </section>
);

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [check, setCheck] = useState<BackupCheck | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [notifPerm, setNotifPerm] = useState<string>(typeof Notification === "undefined" ? "unsupported" : Notification.permission);

  if (!settings) return <PageSkeleton />;
  const num = (v: string, fallback: number) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback; };
  const set = (patch: Partial<AppSettings>) => update(patch);

  const doExport = async () => {
    downloadJson(await exportBackupObject(), backupFilename());
    toast({ kind: "success", title: "Backup downloaded" });
  };

  const pickFile = async (file: File) => {
    setImportError(null);
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error("That file is over 50 MB — it can't be a StudyOS backup.");
      let json: unknown;
      try { json = JSON.parse(await file.text()); } catch { throw new Error("The file isn't valid JSON."); }
      const result = validateBackup(json);
      if (!result.ok) throw new Error(result.errors.slice(0, 3).join(" "));
      setCheck(result);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmRestore = async () => {
    if (!check) return;
    setRestoring(true);
    try {
      await restoreBackup(check);
      setCheck(null);
      toast({ kind: "success", title: "Backup restored", body: "Your data is back." });
    } catch (e) {
      setImportError(e instanceof Error ? `Restore failed and your existing data was left untouched. ${e.message}` : "Restore failed; your existing data was left untouched.");
      setCheck(null);
    } finally { setRestoring(false); }
  };

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
    if (p === "granted") await showSystemNotification({ id: "test", title: "StudyOS notifications are on", body: "You'll get reminders while StudyOS is open." });
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="Settings" subtitle="Everything is stored on this device." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card title="Profile">
            <Field label="Your name">{(id) => <input id={id} className="input" defaultValue={settings.userName} onBlur={(e) => set({ userName: e.target.value.trim() })} />}</Field>
            <Field label="University">{(id) => <input id={id} className="input" defaultValue={settings.university} onBlur={(e) => set({ university: e.target.value.trim() })} />}</Field>
            <Field label="Department / major">{(id) => <input id={id} className="input" defaultValue={settings.department} onBlur={(e) => set({ department: e.target.value.trim() })} />}</Field>
          </Card>

          <Card title="Academic record" hint="Your official transcript numbers. Stored as facts — they don't drift when course rows change.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Official CGPA">{(id) => <input id={id} type="number" step="0.01" min={0} max={4} className="input" defaultValue={settings.officialCGPA} onBlur={(e) => set({ officialCGPA: Math.min(4, Math.max(0, num(e.target.value, 0))) })} />}</Field>
              <Field label="Completed credits">{(id) => <input id={id} type="number" min={0} className="input" defaultValue={settings.officialCompletedCredits} onBlur={(e) => set({ officialCompletedCredits: Math.max(0, num(e.target.value, 0)) })} />}</Field>
              <Field label="Degree credits">{(id) => <input id={id} type="number" min={1} className="input" defaultValue={settings.degreeCredits} onBlur={(e) => set({ degreeCredits: Math.max(1, num(e.target.value, 120)) })} />}</Field>
              <Field label="Target CGPA">{(id) => <input id={id} type="number" step="0.01" min={0} max={4} className="input" defaultValue={settings.targetCGPA ?? ""} onBlur={(e) => set({ targetCGPA: e.target.value ? Math.min(4, num(e.target.value, 0)) : undefined })} />}</Field>
              <Field label="Semester number">{(id) => <input id={id} type="number" min={1} className="input" defaultValue={settings.semesterNumber} onBlur={(e) => set({ semesterNumber: Math.max(1, parseInt(e.target.value) || 1) })} />}</Field>
            </div>
          </Card>

          <Card title="Study & attendance">
            <Field label="Daily study goal (hours)">{(id) => <input id={id} type="number" step="0.5" min={0} className="input" defaultValue={(settings.dailyStudyGoalMinutes || 0) / 60} onBlur={(e) => set({ dailyStudyGoalMinutes: Math.round(Math.max(0, num(e.target.value, 2)) * 60) })} />}</Field>
            <Field label="Default required attendance (%)" hint="Individual courses can override this.">{(id) => <input id={id} type="number" min={0} max={100} className="input" defaultValue={settings.attendanceThreshold} onBlur={(e) => set({ attendanceThreshold: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })} />}</Field>
            <div><span className="label">Calendar week starts on</span>
              <Segmented label="Week start" value={(["Sunday", "Monday", "Saturday"] as const)[[0, 1, 6].indexOf(settings.weekStartsOn ?? 0)]} options={["Sunday", "Monday", "Saturday"] as const} onChange={(v) => set({ weekStartsOn: v === "Sunday" ? 0 : v === "Monday" ? 1 : 6 })} /></div>
          </Card>

          <Card title="Appearance">
            <Segmented label="Theme" value={theme} options={["light", "dark", "system"] as const} onChange={setTheme} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Reminders" hint="StudyOS is a local app, so reminders fire while it's open (or installed and running) — a closed app can't schedule notifications. Each reminder fires at most once.">
            <ToggleRow label="Daily study goal" checked={settings.remindStudyGoal} onChange={(v) => set({ remindStudyGoal: v })} />
            <ToggleRow label="Upcoming class" checked={settings.remindUpcomingClass} onChange={(v) => set({ remindUpcomingClass: v })} />
            <ToggleRow label="Assignment deadlines" checked={settings.remindDeadlines} onChange={(v) => set({ remindDeadlines: v })} />
            <ToggleRow label="Upcoming exams" hint="3 days before, the day before, and the day of" checked={settings.remindExams} onChange={(v) => set({ remindExams: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class alert (minutes before)">{(id) => <input id={id} type="number" min={1} max={120} className="input" defaultValue={settings.classReminderMinutes ?? 15} onBlur={(e) => set({ classReminderMinutes: Math.min(120, Math.max(1, parseInt(e.target.value) || 15)) })} />}</Field>
              <Field label="Study reminder after (hour, 0–23)">{(id) => <input id={id} type="number" min={0} max={23} className="input" defaultValue={settings.studyReminderHour ?? 18} onBlur={(e) => set({ studyReminderHour: Math.min(23, Math.max(0, parseInt(e.target.value) || 18)) })} />}</Field>
            </div>
            {notifPerm === "unsupported" ? <p className="text-xs text-ink-muted">This browser doesn&apos;t support system notifications — reminders appear inside the app instead.</p>
              : notifPerm === "granted" ? <p className="flex items-center gap-2 text-xs text-good"><Bell size={14} aria-hidden="true" /> System notifications are allowed.</p>
              : notifPerm === "denied" ? <p className="text-xs text-warn">Notifications are blocked in your browser settings — reminders will show inside the app.</p>
              : <button className="btn btn-secondary w-full" onClick={requestNotifications}><Bell size={16} /> Allow system notifications</button>}
          </Card>

          <Card title="Retake rules">
            <ToggleRow label="Retake replaces the old grade in GPA" checked={settings.retakeReplacesOldGrade} onChange={(v) => set({ retakeReplacesOldGrade: v })} />
            <ToggleRow label="Retake credit counts once" checked={settings.retakeCreditCountsOnce} onChange={(v) => set({ retakeCreditCountsOnce: v })} />
          </Card>

          <Card title="Grade scale">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(settings.gradeScale) as Grade[]).filter((g) => g).map((g) => (
                <Field key={g} label={g}>{(id) => <input id={id} type="number" step="0.1" min={0} max={4} className="input !px-2" defaultValue={settings.gradeScale[g]} onBlur={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) set({ gradeScale: { ...settings.gradeScale, [g]: v } }); }} />}</Field>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Backup & restore" hint="Export regularly — your data lives only in this browser. Restoring replaces everything currently on this device.">
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={doExport} className="btn btn-primary"><Download size={16} /> Export JSON backup</button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-secondary"><Upload size={16} /> Import backup…</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Choose backup file" onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
        {importError && <ErrorNote message={importError} />}
      </Card>

      <Card title="Danger zone">
        <button onClick={() => { setResetText(""); setResetOpen(true); }} className="btn btn-danger w-full"><RotateCcw size={16} /> Reset StudyOS…</button>
      </Card>
      <p className="text-center text-xs text-ink-faint">StudyOS · local-first · no accounts, no tracking, no external services</p>

      <Modal open={!!check} onClose={() => !restoring && setCheck(null)} title="Restore this backup?"
        footer={<div className="flex gap-2"><button className="btn btn-secondary flex-1" disabled={restoring} onClick={() => setCheck(null)}>Cancel</button><button className="btn btn-primary flex-1" disabled={restoring} onClick={confirmRestore}>{restoring ? "Restoring…" : "Replace my data"}</button></div>}>
        {check && (
          <div className="space-y-3 text-sm">
            <p>The file is valid{check.exportedAt ? <> and was exported on <b>{new Date(check.exportedAt).toLocaleString()}</b></> : ""}. It contains:</p>
            <ul className="list-disc pl-5 text-ink-muted">{describeCounts(check.counts).map((c) => <li key={c}>{c}</li>)}</ul>
            {check.warnings.map((w) => <p key={w} className="flex gap-2 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{w}</p>)}
            <p className="font-medium">This replaces everything currently on this device.</p>
            <button className="btn btn-secondary w-full" onClick={doExport}><Download size={15} /> Download my current data first</button>
          </div>
        )}
      </Modal>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset StudyOS?"
        footer={<div className="flex gap-2"><button className="btn btn-secondary flex-1" onClick={() => setResetOpen(false)}>Cancel</button>
          <button className="btn flex-1 bg-bad text-white" disabled={resetText !== "RESET"} onClick={async () => { await deleteAllData(); window.location.href = "/"; }}>Delete everything</button></div>}>
        <div className="space-y-3 text-sm">
          <p>This permanently deletes every course, task, note, session, goal and setting on this device. It cannot be undone.</p>
          <button className="btn btn-secondary w-full" onClick={doExport}><Download size={15} /> Download a backup first</button>
          <Field label="Type RESET to confirm">{(id) => <input id={id} className="input" autoComplete="off" autoCapitalize="characters" value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" />}</Field>
        </div>
      </Modal>
    </div>
  );
}
