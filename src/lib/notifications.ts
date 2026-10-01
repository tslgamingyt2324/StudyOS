import { Reminder } from "@/lib/alerts";

/**
 * Local notification plumbing.
 *
 * What this CAN do: show a real system notification (via the service worker) whenever
 * StudyOS is running — foreground, or alive in the background — and catch up as soon as
 * the app is reopened.
 * What this CANNOT do: wake a fully closed / suspended app at an exact time. That needs
 * Web Push (a server sending a push message). The service worker already has a `push`
 * handler, so adding a push server later requires no change on the client.
 */

export type NotificationPermissionState = NotificationPermission | "unsupported";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

export function permissionState(): NotificationPermissionState {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ reports as "MacIntel" with touch support.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** The ACTIVE service worker registration, or null (never hangs: `ready` is raced against a timeout). */
export async function activeRegistration(timeoutMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return reg && reg.active ? reg : null;
  } catch {
    return null;
  }
}

export interface Diagnostics {
  supported: boolean;
  permission: NotificationPermissionState;
  serviceWorker: "ready" | "not-registered" | "unsupported";
  installed: boolean;
  ios: boolean;
}

export async function getDiagnostics(): Promise<Diagnostics> {
  const swSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const reg = swSupported ? await activeRegistration(1500) : null;
  return {
    supported: notificationsSupported(),
    permission: permissionState(),
    serviceWorker: !swSupported ? "unsupported" : reg ? "ready" : "not-registered",
    installed: isStandalonePwa(),
    ios: isIOS(),
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Shows a system notification. Uses the service worker (required on Android and iOS, where
 * `new Notification()` throws) and falls back to the constructor only where it is allowed.
 * Resolves true only when a notification was actually handed to the OS.
 */
export async function showSystemNotification(r: Pick<Reminder, "id" | "title" | "body" | "href">): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const options = {
    body: r.body,
    tag: r.id, // same id replaces instead of stacking — a second layer of duplicate protection
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    data: { href: r.href ?? "/", id: r.id },
  };
  try {
    const reg = await activeRegistration();
    if (reg) {
      await reg.showNotification(r.title, options);
      return true;
    }
    new Notification(r.title, options);
    return true;
  } catch {
    return false;
  }
}

export function sendTestNotification(): Promise<boolean> {
  return showSystemNotification({
    id: `test-${Date.now()}`,
    title: "StudyOS",
    body: "Notifications are working! Your StudyOS reminders are ready.",
    href: "/settings",
  });
}

// ---------------------------------------------------------------------------
// Fired-reminder ledger: guarantees each reminder id is delivered once.
// Entries live 7 days (not "until midnight"), so an id can never fire twice across a
// day boundary, and the store cannot grow without bound.
// ---------------------------------------------------------------------------
export const LEDGER_KEY = "studyos:fired-reminders:v2";
const LEDGER_TTL_MS = 7 * 24 * 3600 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Ledger = Record<string, number>;

export function readLedger(now = Date.now(), storage?: StorageLike | null): Ledger {
  const store = storage === undefined ? safeStorage() : storage;
  if (!store) return {};
  try {
    const raw = JSON.parse(store.getItem(LEDGER_KEY) ?? "{}") as Ledger;
    const live: Ledger = {};
    for (const [id, at] of Object.entries(raw)) if (typeof at === "number" && now - at < LEDGER_TTL_MS) live[id] = at;
    return live;
  } catch {
    return {}; // corrupted value — start fresh
  }
}

export function recordFired(id: string, now = Date.now(), storage?: StorageLike | null): void {
  const store = storage === undefined ? safeStorage() : storage;
  if (!store) return;
  try {
    const ledger = readLedger(now, store);
    ledger[id] = now;
    store.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch { /* storage full or blocked */ }
}

function safeStorage(): StorageLike | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

export type DeliveryResult = "system" | "in-app" | "deferred";

/**
 * Decides how to deliver one due reminder.
 *  - system notification when permitted and it succeeds
 *  - in-app toast when the page is visible (and system delivery is unavailable/failed)
 *  - "deferred" when neither works right now (page hidden, no system notification): the
 *    reminder is NOT recorded, so it is retried on resume while it is still relevant.
 */
export async function deliverReminder(
  r: Reminder,
  opts: { visible: boolean; toast: (r: Reminder) => void }
): Promise<DeliveryResult> {
  if (await showSystemNotification(r)) return "system";
  if (opts.visible) { opts.toast(r); return "in-app"; }
  return "deferred";
}
