"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, CheckCircle2, ChevronDown } from "lucide-react";
import {
  Diagnostics, getDiagnostics, requestNotificationPermission, sendTestNotification,
} from "@/lib/notifications";

const PERM_LABEL = { granted: "Granted", denied: "Denied", default: "Not requested", unsupported: "Unsupported" } as const;
const SW_LABEL = { ready: "Ready", "not-registered": "Not registered", unsupported: "Unsupported" } as const;

/** Permission, test button and diagnostics for system notifications. */
export default function NotificationPanel({ classRemindersOn, onEnableClassReminders }: {
  classRemindersOn: boolean;
  onEnableClassReminders: () => void;
}) {
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(() => { void getDiagnostics().then(setDiag); }, []);
  useEffect(() => {
    refresh();
    // Permission can be changed in system settings while the app is in the background.
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  if (!diag) return <div className="h-12 animate-pulse rounded-xl bg-surface-sunken/50" aria-hidden="true" />;

  const allow = async () => {
    setBusy(true); setResult(null);
    const p = await requestNotificationPermission();
    if (p === "granted" && !classRemindersOn) {
      onEnableClassReminders();
      setResult({ ok: true, text: "Notifications allowed. Upcoming-class reminders were switched on for you." });
    }
    refresh(); setBusy(false);
  };
  const test = async () => {
    setBusy(true); setResult(null);
    const ok = await sendTestNotification();
    setResult(ok
      ? { ok: true, text: "Test sent. If you don't see it, check that Do Not Disturb / Focus is off." }
      : { ok: false, text: "Couldn't show a notification. Check the diagnostics below." });
    setBusy(false);
  };

  const needsInstall = diag.ios && !diag.installed;

  return (
    <div className="space-y-3">
      {diag.permission === "unsupported" ? (
        <p className="text-xs text-ink-muted">This browser doesn&apos;t support system notifications — reminders appear inside the app instead.</p>
      ) : diag.permission === "granted" ? (
        <>
          <p className="flex items-center gap-2 text-sm font-medium text-good"><CheckCircle2 size={16} aria-hidden="true" /> Notifications are enabled</p>
          <button className="btn btn-secondary w-full" onClick={test} disabled={busy} aria-label="Send a test notification"><BellRing size={16} aria-hidden="true" /> Test Notification</button>
        </>
      ) : diag.permission === "denied" ? (
        <p className="text-xs text-warn">Notifications are blocked for StudyOS. Re-enable them in your browser or phone settings (Settings → Notifications → StudyOS), then return here. Until then reminders appear inside the app.</p>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium">Notifications are currently disabled.</p>
            <p className="text-xs text-ink-muted">Allow notifications to receive class and study reminders.</p>
          </div>
          <button className="btn btn-primary w-full" onClick={allow} disabled={busy || needsInstall} aria-label="Allow notifications"><Bell size={16} aria-hidden="true" /> Allow Notifications</button>
        </>
      )}

      {needsInstall && (
        <p className="rounded-xl bg-warn/10 p-3 text-xs text-warn">
          On iPhone, notifications only work after you add StudyOS to your Home Screen (Share → Add to Home Screen) and open it from there (iOS 16.4 or later).
        </p>
      )}
      {result && <p role="status" className={`text-xs ${result.ok ? "text-good" : "text-warn"}`}>{result.text}</p>}
      {diag.permission === "granted" && !classRemindersOn && (
        <p className="text-xs text-warn">&ldquo;Upcoming class&rdquo; is switched off above, so class reminders won&apos;t be sent.</p>
      )}

      <details className="group rounded-xl border border-border">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold text-ink-muted">
          Notification Diagnostics <ChevronDown size={14} className="transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <dl className="space-y-1.5 border-t border-border px-3 py-2.5 text-xs">
          {([
            ["Notification support", diag.supported ? "Supported" : "Unsupported"],
            ["Permission", PERM_LABEL[diag.permission]],
            ["Service worker", SW_LABEL[diag.serviceWorker]],
            ["PWA", diag.installed ? "Installed" : "Browser"],
          ] as const).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-ink-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
        <p className="border-t border-border px-3 py-2.5 text-[11px] leading-relaxed text-ink-muted">
          Reminders are checked while StudyOS is running and the moment you reopen it. A phone can suspend a closed app, so exact-time alerts with the app fully closed aren&apos;t possible without a push server.
        </p>
      </details>
    </div>
  );
}
