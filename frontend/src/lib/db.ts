import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface ReminderLocal {
  id: number; // Negative for offline-only items, positive for server items
  user_id: number;
  title: string;
  description: string | null;
  reminder_datetime: string;
  priority: string;
  category: string;
  repeat_type: string;
  status: string; // pending, completed, overdue
  created_at: string;
  is_local?: boolean; // Flag to show it's created offline
}

export interface SyncOperation {
  id?: number;
  action: "create" | "update" | "delete" | "complete";
  reminderId: number;
  data: any;
  timestamp: number;
}

interface ReminderDB extends DBSchema {
  reminders: {
    key: number;
    value: ReminderLocal;
  };
  sync_queue: {
    key: number;
    value: SyncOperation;
    indexes: { "by-timestamp": number };
  };
}

const DB_NAME = "smart-reminder-pwa-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ReminderDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ReminderDB>> {
  if (typeof window === "undefined") {
    // Return a dummy promise for server-side Next.js rendering
    return new Promise(() => {});
  }
  if (!dbPromise) {
    dbPromise = openDB<ReminderDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store for active and completed reminders
        db.createObjectStore("reminders", { keyPath: "id" });
        // Store for queued mutations while offline
        const syncStore = db.createObjectStore("sync_queue", {
          keyPath: "id",
          autoIncrement: true,
        });
        syncStore.createIndex("by-timestamp", "timestamp");
      },
    });
  }
  return dbPromise;
}

// Reminders cache operations
export async function getCachedReminders(): Promise<ReminderLocal[]> {
  try {
    const db = await getDB();
    return await db.getAll("reminders");
  } catch (error) {
    console.error("IndexedDB error in getCachedReminders:", error);
    return [];
  }
}

export async function saveCachedReminders(reminders: ReminderLocal[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction("reminders", "readwrite");
    // Clear existing cache
    await tx.store.clear();
    // Save new cache
    for (const reminder of reminders) {
      await tx.store.put(reminder);
    }
    await tx.done;
  } catch (error) {
    console.error("IndexedDB error in saveCachedReminders:", error);
  }
}

export async function getCachedReminderById(id: number): Promise<ReminderLocal | undefined> {
  try {
    const db = await getDB();
    return await db.get("reminders", id);
  } catch (error) {
    console.error("IndexedDB error in getCachedReminderById:", error);
    return undefined;
  }
}

export async function putCachedReminder(reminder: ReminderLocal): Promise<void> {
  try {
    const db = await getDB();
    await db.put("reminders", reminder);
  } catch (error) {
    console.error("IndexedDB error in putCachedReminder:", error);
  }
}

export async function removeCachedReminder(id: number): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("reminders", id);
  } catch (error) {
    console.error("IndexedDB error in removeCachedReminder:", error);
  }
}

// Sync Queue operations
export async function queueSyncOperation(
  action: "create" | "update" | "delete" | "complete",
  reminderId: number,
  data: any
): Promise<void> {
  try {
    const db = await getDB();
    await db.add("sync_queue", {
      action,
      reminderId,
      data,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("IndexedDB error in queueSyncOperation:", error);
  }
}

export async function getSyncQueue(): Promise<SyncOperation[]> {
  try {
    const db = await getDB();
    const tx = db.transaction("sync_queue", "readonly");
    const index = tx.store.index("by-timestamp");
    return await index.getAll();
  } catch (error) {
    console.error("IndexedDB error in getSyncQueue:", error);
    return [];
  }
}

export async function deleteSyncOperation(id: number): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("sync_queue", id);
  } catch (error) {
    console.error("IndexedDB error in deleteSyncOperation:", error);
  }
}

export async function clearSyncQueue(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction("sync_queue", "readwrite");
    await tx.store.clear();
    await tx.done;
  } catch (error) {
    console.error("IndexedDB error in clearSyncQueue:", error);
  }
}
