const CACHE_NAME = "smart-reminder-cache-v2";
const OFFLINE_URL = "/offline.html";

// Assets cached during install
const STATIC_ASSETS = [
  "/",
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// INSTALL
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip external requests
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // API Strategy → Network First
  if (
    requestUrl.pathname.startsWith("/api/") ||
    requestUrl.port === "8000"
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (
            event.request.method === "GET" &&
            response.status === 200
          ) {
            const clone = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, clone);
              });
          }

          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return new Response(
              JSON.stringify({
                error: "offline",
                message: "Offline mode"
              }),
              {
                status: 503,
                headers: {
                  "Content-Type": "application/json"
                }
              }
            );
          });
        })
    );

    return;
  }

  // Images → Stale While Revalidate
  if (
    event.request.destination === "image" ||
    requestUrl.pathname.endsWith(".png") ||
    requestUrl.pathname.endsWith(".jpg") ||
    requestUrl.pathname.endsWith(".svg")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request)
          .then((cached) => {

            const networkFetch =
              fetch(event.request)
                .then((response) => {

                  if (response.status === 200) {
                    cache.put(
                      event.request,
                      response.clone()
                    );
                  }

                  return response;
                });

            return cached || networkFetch;
          });
      })
    );

    return;
  }

  // Navigation → Offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(OFFLINE_URL))
    );

    return;
  }

  // General Assets
  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request))
  );
});

// PUSH
self.addEventListener("push", (event) => {
  let data = {
    title: "Reminder",
    body: "You have a reminder"
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title,
      {
        body: data.body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        vibrate: [200, 100, 200],
        data: {
          url: data.url || "/dashboard"
        }
      }
    )
  );
});

// NOTIFICATION CLICK
self.addEventListener(
  "notificationclick",
  (event) => {

    event.notification.close();

    const url =
      event.notification.data.url;

    event.waitUntil(
      self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      })
        .then((clients) => {

          for (const client of clients) {

            if ("focus" in client) {
              client.focus();
              return client.navigate(url);
            }
          }

          return self.clients.openWindow(url);
        })
    );
  }
);

// BACKGROUND SYNC
self.addEventListener(
  "sync",
  (event) => {

    if (
      event.tag ===
      "sync-reminders"
    ) {

      event.waitUntil(
        self.clients.matchAll({
          includeUncontrolled: true
        })
          .then((clients) => {

            clients.forEach((client) => {

              client.postMessage({
                type:
                  "SYNC_REMINDERS"
              });

            });

          })
      );

    }

  }
);