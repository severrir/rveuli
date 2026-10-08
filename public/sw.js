/**
 * Service worker for რვეული.
 *
 * Two jobs: keep the shell openable when the signal drops, and receive the
 * evening reminder. It deliberately does not cache homework responses —
 * stale homework is worse than none, so the feed always goes to the network
 * and falls back to the last good list held by the page.
 *
 * Every path is resolved against this file's own location rather than the
 * domain root, so the same worker works at "/" and at "/<repo>/" on GitHub
 * Pages without being rebuilt.
 */

const SHELL_CACHE = "rveuli-shell-v2";
const ROOT = new URL("./", self.location);
const at = (path) => new URL(path, ROOT).pathname;

const SHELL = [
  at("./"),
  at("./index.html"),
  at("./manifest.webmanifest"),
  at("./icon.svg"),
  at("./icon-192.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // One bad entry must not fail the whole install.
      .then((c) => Promise.allSettled(SHELL.map((p) => c.add(p))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(ROOT.pathname)) return;

  // Navigations: network first, cached shell as the fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () => caches.match(at("./index.html")) ?? caches.match(at("./")),
      ),
    );
    return;
  }

  // Static assets: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "რვეული", {
      body: payload.body ?? "ხვალისთვის დავალება გაქვს.",
      icon: at("./icon-192.png"),
      badge: at("./icon-192.png"),
      lang: "ka",
      tag: "rveuli-daily",
      renotify: true,
      data: { url: payload.url ?? ROOT.href },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "./", ROOT).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.startsWith(ROOT.href) && "focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
