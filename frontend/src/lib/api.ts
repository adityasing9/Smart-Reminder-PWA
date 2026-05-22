import {
  getCachedReminders,
  saveCachedReminders,
  putCachedReminder,
  removeCachedReminder,
  queueSyncOperation,
  getSyncQueue,
  deleteSyncOperation,
  ReminderLocal
} from "./db";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Helper to get token
function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (error) {
    console.error("Failed to read token from localStorage:", error);
    return {};
  }
}

// Check network status
export function isOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

// Request Wrapper
async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || "Something went wrong");
  }

  return data;
}

// Auth API
export const authApi = {
  async register(name: string, email: string, password: string) {
    return request<any>("/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },

  async login(email: string, password: string) {
    const data = await request<any>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch (error) {
        console.error("Failed to write to localStorage:", error);
      }
    }
    return data;
  },

  logout() {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch (error) {
        console.error("Failed to remove from localStorage:", error);
      }
    }
  },

  getCurrentUser() {
    if (typeof window === "undefined") return null;
    try {
      const userStr = localStorage.getItem("user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error("Failed to read user from localStorage:", error);
      return null;
    }
  }
};

// Reminders API
export const remindersApi = {
  async getAll(): Promise<ReminderLocal[]> {
    if (!isOnline()) {
      console.log("Offline: Fetching reminders from IndexedDB");
      return getCachedReminders();
    }

    try {
      const serverReminders = await request<ReminderLocal[]>("/reminders");
      // Cache server reminders locally
      await saveCachedReminders(serverReminders);
      return serverReminders;
    } catch (error) {
      console.error("Failed to fetch from network, falling back to IndexedDB:", error);
      return getCachedReminders();
    }
  },

  async create(reminder: Omit<ReminderLocal, "id" | "user_id" | "status" | "created_at">): Promise<ReminderLocal> {
    const user = authApi.getCurrentUser();
    const tempId = -Math.floor(Math.random() * 1000000); // Temporary negative ID

    const localReminder: ReminderLocal = {
      ...reminder,
      id: tempId,
      user_id: user?.id || 0,
      status: "pending",
      created_at: new Date().toISOString(),
      is_local: true
    };

    if (!isOnline()) {
      console.log("Offline: Saving created reminder to queue");
      // Save locally
      await putCachedReminder(localReminder);
      // Queue create operation
      await queueSyncOperation("create", tempId, reminder);
      // Register sync event in Service Worker if possible
      registerBackgroundSync();
      return localReminder;
    }

    try {
      const created = await request<ReminderLocal>("/reminders", {
        method: "POST",
        body: JSON.stringify(reminder),
      });
      // Save to cache
      await putCachedReminder(created);
      return created;
    } catch (error) {
      console.error("Network failed. Queuing create offline:", error);
      await putCachedReminder(localReminder);
      await queueSyncOperation("create", tempId, reminder);
      registerBackgroundSync();
      return localReminder;
    }
  },

  async update(id: number, reminder: Partial<Omit<ReminderLocal, "id" | "user_id" | "created_at">>): Promise<ReminderLocal> {
    if (!isOnline()) {
      console.log("Offline: Saving updated reminder to queue");
      // Load current item
      const cachedReminders = await getCachedReminders();
      const current = cachedReminders.find((r) => r.id === id);
      if (!current) throw new Error("Reminder not found in local cache.");

      const updatedReminder = { ...current, ...reminder };
      await putCachedReminder(updatedReminder);

      // Queue update operation
      await queueSyncOperation("update", id, reminder);
      registerBackgroundSync();
      return updatedReminder;
    }

    try {
      const updated = await request<ReminderLocal>(`/reminders/${id}`, {
        method: "PUT",
        body: JSON.stringify(reminder),
      });
      await putCachedReminder(updated);
      return updated;
    } catch (error) {
      console.error("Network failed. Queuing update offline:", error);
      const cachedReminders = await getCachedReminders();
      const current = cachedReminders.find((r) => r.id === id);
      if (!current) throw new Error("Reminder not found.");

      const updatedReminder = { ...current, ...reminder };
      await putCachedReminder(updatedReminder);

      await queueSyncOperation("update", id, reminder);
      registerBackgroundSync();
      return updatedReminder;
    }
  },

  async delete(id: number): Promise<void> {
    if (!isOnline()) {
      console.log("Offline: Deleting reminder locally & queuing operation");
      await removeCachedReminder(id);
      await queueSyncOperation("delete", id, null);
      registerBackgroundSync();
      return;
    }

    try {
      await request<void>(`/reminders/${id}`, {
        method: "DELETE",
      });
      await removeCachedReminder(id);
    } catch (error) {
      console.error("Network failed. Queuing delete offline:", error);
      await removeCachedReminder(id);
      await queueSyncOperation("delete", id, null);
      registerBackgroundSync();
    }
  },

  async complete(id: number): Promise<ReminderLocal> {
    if (!isOnline()) {
      console.log("Offline: Completing reminder locally & queuing operation");
      const cachedReminders = await getCachedReminders();
      const current = cachedReminders.find((r) => r.id === id);
      if (!current) throw new Error("Reminder not found.");

      // Calculate rollover for local preview if repeatable
      let nextStatus = "completed";
      let nextDatetime = current.reminder_datetime;

      if (current.repeat_type && current.repeat_type !== "none") {
        // Just mock the rollover locally
        const current_dt = new Date(current.reminder_datetime);
        if (current.repeat_type === "daily") current_dt.setDate(current_dt.getDate() + 1);
        else if (current.repeat_type === "weekly") current_dt.setDate(current_dt.getDate() + 7);
        else if (current.repeat_type === "monthly") current_dt.setMonth(current_dt.getMonth() + 1);
        else if (current.repeat_type === "yearly") current_dt.setFullYear(current_dt.getFullYear() + 1);
        
        nextDatetime = current_dt.toISOString();
        nextStatus = "pending";
      }

      const updatedReminder = { ...current, status: nextStatus, reminder_datetime: nextDatetime };
      await putCachedReminder(updatedReminder);

      await queueSyncOperation("complete", id, null);
      registerBackgroundSync();
      return updatedReminder;
    }

    try {
      const updated = await request<ReminderLocal>(`/complete/${id}`, {
        method: "POST",
      });
      await putCachedReminder(updated);
      return updated;
    } catch (error) {
      console.error("Network failed. Queuing complete offline:", error);
      const cachedReminders = await getCachedReminders();
      const current = cachedReminders.find((r) => r.id === id);
      if (!current) throw new Error("Reminder not found.");

      const updatedReminder = { ...current, status: "completed" };
      await putCachedReminder(updatedReminder);

      await queueSyncOperation("complete", id, null);
      registerBackgroundSync();
      return updatedReminder;
    }
  }
};

// Web Push APIs
export const pushApi = {
  async getPublicKey() {
    return request<{ publicKey: string }>("/push/vapid-public-key");
  },

  async subscribe(subscription: any) {
    return request<any>("/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    });
  },

  async unsubscribe(endpoint: string) {
    return request<any>("/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    });
  }
};

// Trigger background sync in the SW if available
function registerBackgroundSync() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready.then((reg) => {
      // Register background sync (cast needed: Background Sync API not in default TS lib)
      (reg as any).sync?.register("sync-reminders").catch((err: any) => {
        console.error("Background sync registration failed:", err);
      });
    });
  }
}

// Synchronize all queued IndexedDB changes with the server
export async function synchronizeOfflineOperations(): Promise<boolean> {
  if (!isOnline()) return false;
  
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (!token) return false;

  const queue = await getSyncQueue();
  if (queue.length === 0) return true;

  console.log(`Starting synchronization of ${queue.length} operations...`);

  // Map of temporary offline ID -> permanent server ID
  const idMap = new Map<number, number>();

  for (const op of queue) {
    try {
      let currentReminderId = op.reminderId;
      // If the reminder is linked to an offline-created reminder, use the updated ID
      if (currentReminderId < 0 && idMap.has(currentReminderId)) {
        currentReminderId = idMap.get(currentReminderId)!;
      }

      if (op.action === "create") {
        const created = await request<ReminderLocal>("/reminders", {
          method: "POST",
          body: JSON.stringify(op.data),
        });
        idMap.set(op.reminderId, created.id);
        // Replace temporary negative id record with permanent one
        await removeCachedReminder(op.reminderId);
        await putCachedReminder(created);
      } 
      else if (op.action === "update") {
        // If this item was deleted later in the queue, we can skip updating it on server
        if (currentReminderId < 0 && !idMap.has(currentReminderId)) {
          // Item was created offline and never synced (maybe deleted offline too)
          await deleteSyncOperation(op.id!);
          continue;
        }
        await request<ReminderLocal>(`/reminders/${currentReminderId}`, {
          method: "PUT",
          body: JSON.stringify(op.data),
        });
      } 
      else if (op.action === "delete") {
        if (currentReminderId > 0) {
          await request<void>(`/reminders/${currentReminderId}`, {
            method: "DELETE",
          });
        }
      } 
      else if (op.action === "complete") {
        if (currentReminderId > 0) {
          await request<ReminderLocal>(`/complete/${currentReminderId}`, {
            method: "POST",
          });
        }
      }

      // Remove successfully synced operation from IndexedDB queue
      await deleteSyncOperation(op.id!);
    } catch (error) {
      console.error("Failed to sync operation:", op, error);
      // Stop and retry later if network error occurs
      return false;
    }
  }

  console.log("Offline synchronization complete! Refreshing reminders...");
  // Final fetch to synchronize state with server
  await remindersApi.getAll();
  return true;
}
