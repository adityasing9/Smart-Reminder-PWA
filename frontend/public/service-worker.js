const CACHE_NAME = "smart-reminder-cache-v2";
const OFFLINE_URL = "/offline.html";

// Assets to cache immediately on SW install
const STATIC_ASSETS = [
  "/",
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching offline fallback and static assets");
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip cross-origin requests entirely — let the browser handle CORS natively
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // 1. API Cache Strategy (Network First, fallback to cache)
  if (requestUrl.pathname.startsWith("/api/") || requestUrl.port === "8000") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone the response and save it to the cache if request is a GET
          if (event.request.method === "GET" && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network is offline, try to get from cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline error response if no cache matches
            return new Response(
              JSON.stringify({ error: "offline", message: "You are offline. Showing cached data." }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          });
        })
    );
    return;
  }

  // 2. Image Cache Strategy (Stale While Revalidate)
  if (
    event.request.destination === "image" ||
    requestUrl.pathname.endsWith(".png") ||
    requestUrl.pathname.endsWith(".jpg") ||
    requestUrl.pathname.endsWith(".svg")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 3. App Shell Strategy (Cache First for JS, CSS, fonts, static assets)
  // For navigation requests, fallback to offline.html if offline
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // General Assets Cache Strategy (Cache First, network fallback)
  const CACHE_NAME = "smart-reminder-v2";

  self.addEventListener("install", event => {
    self.skipWaiting();
  });

  self.addEventListener("activate", event => {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
    );

    self.clients.claim();
  });

  const CACHE_NAME = "smart-reminder-v2";

  self.addEventListener("install", event => {
    self.skipWaiting();
  });

  self.addEventListener("activate", event => {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
    );

    self.clients.claim();
  });

  self.addEventListener("fetch", event => {
    event.respondWith(
      fetch(event.request)
        .then(response => response)
        .catch(() => caches.match(event.request))
    );
  });

  // Push Notification Event
  self.addEventListener("push", (event) => {
    let data = { title: "Reminder", body: "You have a new reminder alert!" };
    if (event.data) {
      try {
        data = event.data.json();
      } catch (e) {
        data = { title: "Reminder", body: event.data.text() };
      }
    }

    const options = {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      vibrate: [200, 100, 200],
      data: {
        url: data.url || "/dashboard"
      },
      actions: [
        { action: "open", title: "View Details" },
        { action: "close", title: "Dismiss" }
      ],
      tag: data.tag || "general-reminder"
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Reminder Alert", options)
    );
  });

  // Notification Click Event
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    if (event.action === "close") {
      return;
    }

    const urlToOpen = event.notification.data.url;

    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
        // If a window is already open, focus it and navigate
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            return client.navigate(urlToOpen);
          }
        }
        // If no window is open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
    );
  });

  // Background Sync Event
  self.addEventListener("sync", (event) => {
    if (event.tag === "sync-reminders") {
      console.log("[Service Worker] Background sync event triggered");
      // We notify open clients to trigger database synchronization
      event.waitUntil(
        self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "SYNC_REMINDERS" });
          });
        })
      );
    }
  });
