// StudyOS service worker. All user data lives in IndexedDB, which works offline
// on its own; this worker only keeps the app shell (pages + assets) available.
const CACHE = "studyos-v4";
const ROUTES = [
  "/", "/academics", "/academics/courses", "/academics/gpa", "/academics/attendance", "/academics/retakes",
  "/academics/degree", "/planner/calendar", "/planner/tasks", "/planner/exams", "/planner/routine",
  "/planner/schedule", "/study/timer", "/study/records", "/study/analytics", "/study/goals", "/study/focus",
  "/notes", "/settings", "/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/badge-96.png", "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Add each route independently so one failure doesn't abort the install.
      Promise.all(ROUTES.map((url) => cache.add(url).catch(() => undefined)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first (so updates show immediately), cache fallback when offline.
// Same-origin GET only — nothing cross-origin is ever cached or contacted.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req, { ignoreSearch: req.mode === "navigate" });
        if (hit) return hit;
        if (req.mode === "navigate") return (await caches.match(url.pathname)) || (await caches.match("/"));
        return Response.error();
      })
  );
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
// Reminders are *created* by the page (ReminderEngine) and displayed through
// registration.showNotification(). Tapping one opens/focuses StudyOS on the page named in
// notification.data.href. A service worker cannot wake itself at a future time — see the
// `push` handler below for the one mechanism that can.

function safeHref(href) {
  // Only same-origin, in-app paths.
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//") ? href : "/";
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = safeHref(event.notification.data && event.notification.data.href);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      const open = list.find((c) => "focus" in c);
      if (open) {
        await open.focus();
        // The already-open app routes itself (no reload, no lost state).
        open.postMessage({ type: "studyos:navigate", href });
        return;
      }
      return self.clients.openWindow(href);
    })
  );
});

// Dormant until a push server exists: when one sends {title, body, href, tag}, the
// notification shows even if StudyOS is closed. Nothing on the client needs to change.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  event.waitUntil(
    self.registration.showNotification(data.title || "StudyOS", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      data: { href: safeHref(data.href) },
    })
  );
});
