// StudyOS service worker. All user data lives in IndexedDB, which works offline
// on its own; this worker only keeps the app shell (pages + assets) available.
const CACHE = "studyos-v2";
const ROUTES = [
  "/", "/academics", "/academics/courses", "/academics/gpa", "/academics/attendance", "/academics/retakes",
  "/academics/degree", "/planner/calendar", "/planner/tasks", "/planner/exams", "/planner/routine",
  "/planner/schedule", "/study/timer", "/study/records", "/study/analytics", "/study/goals", "/study/focus",
  "/notes", "/settings", "/manifest.json", "/icon-192.png", "/icon-512.png",
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

// Tapping a reminder focuses StudyOS (or opens it).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => "focus" in c);
      return open ? open.focus() : self.clients.openWindow("/");
    })
  );
});
