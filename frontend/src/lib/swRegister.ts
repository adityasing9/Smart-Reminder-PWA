import { pushApi, synchronizeOfflineOperations } from "./api";

// Helper to convert base64 VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js");
    console.log("Service Worker registered successfully with scope:", registration.scope);

    // Setup message listener from service worker
    navigator.serviceWorker.addEventListener("message", async (event) => {
      if (event.data && event.data.type === "SYNC_REMINDERS") {
        console.log("SW requested synchronization");
        await synchronizeOfflineOperations();
      }
    });

    // Check online status and sync immediately
    if (navigator.onLine) {
      await synchronizeOfflineOperations();
    }

    // Monitor online event to sync
    window.addEventListener("online", () => {
      console.log("Browser back online. Running synchronization...");
      synchronizeOfflineOperations();
    });

    return registration;
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}

// Subscribe to Web Push notifications
export async function subscribeUserToPush(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Web Push notifications are not supported by this browser.");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Fetch public VAPID key
      const { publicKey } = await pushApi.getPublicKey();
      if (!publicKey) {
        throw new Error("VAPID public key not found from API.");
      }

      // Convert VAPID key to correct binary format
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);

      // Subscribe user
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as any
      });
    }

    // Parse subscription keys
    const jsonSub = subscription.toJSON();
    const payload = {
      endpoint: jsonSub.endpoint,
      keys: {
        p256dh: jsonSub.keys?.p256dh || "",
        auth: jsonSub.keys?.auth || ""
      }
    };

    // Send subscription to server
    await pushApi.subscribe(payload);
    console.log("User successfully subscribed to push notifications:", subscription);
    return true;
  } catch (error) {
    console.error("Failed to subscribe user to push notifications:", error);
    return false;
  }
}

// Check push notification enrollment status
export async function checkPushSubscription(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (error) {
    console.error("Error checking push subscription:", error);
    return false;
  }
}

// Unsubscribe user
export async function unsubscribeUserFromPush(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // Unsubscribe locally
      await subscription.unsubscribe();
      // Remove on server
      await pushApi.unsubscribe(subscription.endpoint);
      console.log("User unsubscribed from push notifications.");
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error unsubscribing from push notifications:", error);
    return false;
  }
}
