const CACHE_NAME = "time-calculator-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/service-worker.js",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

// Install service worker and cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(urlsToCache).catch((error) => {
        console.warn("Some files could not be cached:", error);
        // Continue with installation even if some files fail to cache
        return Promise.resolve();
      });
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Fetch resources from cache if available
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Update cache if there are any changes to assets
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Handle background sync for notifications
self.addEventListener("sync", (event) => {
  if (event.tag === "time-reminder") {
    event.waitUntil(handleTimeReminder());
  }
});

// Handle push notifications
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || "Time reminder!",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: "time-reminder",
      requireInteraction: true,
      actions: [
        {
          action: "dismiss",
          title: "Dismiss"
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Time Reminder", options)
    );
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  if (event.action === "dismiss") {
    return;
  }

  // Open the app when notification is clicked
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      } else {
        return self.clients.openWindow("/");
      }
    })
  );
});

// Handle periodic background sync (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-reminders") {
    event.waitUntil(checkScheduledReminders());
  }
});

// Function to handle time reminders
async function handleTimeReminder() {
  try {
    // Get stored reminder data
    const reminderData = await getStoredReminder();
    if (reminderData && reminderData.targetTime) {
      const now = new Date();
      const targetTime = new Date(reminderData.targetTime);
      
      if (now >= targetTime) {
        // Show notification
        await self.registration.showNotification("Time Reminder", {
          body: `It's time! Your calculated time (${reminderData.displayTime}) has arrived.`,
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
          tag: "time-reminder",
          requireInteraction: true
        });
        
        // Clear the stored reminder
        await clearStoredReminder();
      }
    }
  } catch (error) {
    console.error("Error handling time reminder:", error);
  }
}

// Function to check scheduled reminders periodically
async function checkScheduledReminders() {
  try {
    const reminderData = await getStoredReminder();
    if (reminderData && reminderData.targetTime) {
      const now = new Date();
      const targetTime = new Date(reminderData.targetTime);
      
      if (now >= targetTime) {
        await handleTimeReminder();
      }
    }
  } catch (error) {
    console.error("Error checking reminders:", error);
  }
}

// Helper functions for storing/retrieving reminder data
async function getStoredReminder() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match("/reminder-data");
    if (response) {
      return await response.json();
    }
  } catch (error) {
    console.error("Error getting stored reminder:", error);
  }
  return null;
}

async function storeReminder(reminderData) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify(reminderData), {
      headers: { "Content-Type": "application/json" }
    });
    await cache.put("/reminder-data", response);
  } catch (error) {
    console.error("Error storing reminder:", error);
  }
}

async function clearStoredReminder() {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete("/reminder-data");
  } catch (error) {
    console.error("Error clearing stored reminder:", error);
  }
}

// Expose functions to main thread
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SET_REMINDER") {
    storeReminder(event.data.reminderData);
  } else if (event.data && event.data.type === "CLEAR_REMINDER") {
    clearStoredReminder();
  } else if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.notification.title, {
      body: event.data.notification.body,
      icon: event.data.notification.icon || "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: "time-reminder",
      requireInteraction: true
    });
  }
});
