import {
  getCachedReminders,
  saveCachedReminders,
  putCachedReminder,
  removeCachedReminder,
  getCachedReminderById,
  ReminderLocal,
} from "./db";

// Helper to get token from localStorage
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

// Helper to update backup in localStorage for extra durability
async function syncLocalStorageBackup(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const all = await getCachedReminders();
    localStorage.setItem("local_reminders_backup", JSON.stringify(all));
  } catch (e) {
    console.warn("Could not sync localStorage backup:", e);
  }
}

// ==========================================
// 100% LOCAL AUTH API (Uses localStorage)
// ==========================================
export const authApi = {
  async register(name: string, email: string, password?: string) {
    const newUser = {
      id: Date.now(),
      name: name.trim() || "User",
      email: email.trim().toLowerCase(),
    };

    if (typeof window !== "undefined") {
      try {
        const token = `local_token_${Date.now()}`;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(newUser));

        // Save into local registered users registry
        const existingUsersStr = localStorage.getItem("local_users_registry");
        const existingUsers = existingUsersStr ? JSON.parse(existingUsersStr) : [];
        existingUsers.push({ ...newUser, password: password || "" });
        localStorage.setItem("local_users_registry", JSON.stringify(existingUsers));
      } catch (error) {
        console.error("Failed to write user to localStorage:", error);
      }
    }

    return {
      access_token: `local_token_${Date.now()}`,
      user: newUser,
    };
  },

  async login(email: string, password?: string) {
    let user = {
      id: 1,
      name: email.split("@")[0] || "User",
      email: email.trim().toLowerCase(),
    };

    if (typeof window !== "undefined") {
      try {
        // Check if user exists in registry
        const existingUsersStr = localStorage.getItem("local_users_registry");
        if (existingUsersStr) {
          const existingUsers = JSON.parse(existingUsersStr);
          const found = existingUsers.find(
            (u: any) => u.email.toLowerCase() === email.trim().toLowerCase()
          );
          if (found) {
            user = { id: found.id, name: found.name, email: found.email };
          }
        }

        const token = `local_token_${Date.now()}`;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
      } catch (error) {
        console.error("Failed to write login state to localStorage:", error);
      }
    }

    return {
      access_token: `local_token_${Date.now()}`,
      user,
    };
  },

  continueAsGuest() {
    const guestUser = {
      id: 1,
      name: "Local User",
      email: "local@smartreminder.app",
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("token", "local_guest_token");
        localStorage.setItem("user", JSON.stringify(guestUser));
      } catch (e) {
        console.error("Failed to set guest session:", e);
      }
    }

    return guestUser;
  },

  logout() {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch (error) {
        console.error("Failed to remove token from localStorage:", error);
      }
    }
  },

  getCurrentUser() {
    if (typeof window === "undefined") {
      return { id: 1, name: "Local User", email: "local@smartreminder.app" };
    }
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) return JSON.parse(userStr);
      return { id: 1, name: "Local User", email: "local@smartreminder.app" };
    } catch (error) {
      console.error("Failed to read user from localStorage:", error);
      return { id: 1, name: "Local User", email: "local@smartreminder.app" };
    }
  },
};

// ==========================================
// 100% LOCAL REMINDERS API (Uses IndexedDB + localStorage)
// ==========================================
export const remindersApi = {
  async getAll(): Promise<ReminderLocal[]> {
    try {
      let reminders = await getCachedReminders();

      // Fallback to localStorage backup if IndexedDB was cleared
      if ((!reminders || reminders.length === 0) && typeof window !== "undefined") {
        const backupStr = localStorage.getItem("local_reminders_backup");
        if (backupStr) {
          try {
            reminders = JSON.parse(backupStr);
            // Restore back into IndexedDB
            if (reminders && reminders.length > 0) {
              await saveCachedReminders(reminders);
            }
          } catch (e) {
            console.error("Failed to parse localStorage backup:", e);
          }
        }
      }

      // Sort by reminder_datetime ascending
      return (reminders || []).sort(
        (a, b) => new Date(a.reminder_datetime).getTime() - new Date(b.reminder_datetime).getTime()
      );
    } catch (error) {
      console.error("Error in getAll reminders:", error);
      return [];
    }
  },

  async create(
    reminder: Omit<ReminderLocal, "id" | "user_id" | "status" | "created_at">
  ): Promise<ReminderLocal> {
    const user = authApi.getCurrentUser();
    const newId = Date.now(); // Guaranteed unique positive ID

    const newReminder: ReminderLocal = {
      ...reminder,
      id: newId,
      user_id: user?.id || 1,
      status: "pending",
      created_at: new Date().toISOString(),
      is_local: true,
    };

    // Save directly to IndexedDB
    await putCachedReminder(newReminder);
    await syncLocalStorageBackup();

    console.log("Reminder created locally:", newReminder);
    return newReminder;
  },

  async update(
    id: number,
    reminderData: Partial<Omit<ReminderLocal, "id" | "user_id" | "created_at">>
  ): Promise<ReminderLocal> {
    const existing = await getCachedReminderById(id);
    if (!existing) {
      throw new Error("Reminder not found.");
    }

    const updated: ReminderLocal = {
      ...existing,
      ...reminderData,
    };

    await putCachedReminder(updated);
    await syncLocalStorageBackup();

    console.log("Reminder updated locally:", updated);
    return updated;
  },

  async delete(id: number): Promise<void> {
    await removeCachedReminder(id);
    await syncLocalStorageBackup();
    console.log("Reminder deleted locally:", id);
  },

  async complete(id: number): Promise<ReminderLocal> {
    const existing = await getCachedReminderById(id);
    if (!existing) {
      throw new Error("Reminder not found.");
    }

    let nextStatus = "completed";
    let nextDatetime = existing.reminder_datetime;

    // Handle recurring reminders rollover locally
    if (existing.repeat_type && existing.repeat_type !== "none") {
      const currentDt = new Date(existing.reminder_datetime);
      if (existing.repeat_type === "daily") {
        currentDt.setDate(currentDt.getDate() + 1);
      } else if (existing.repeat_type === "weekly") {
        currentDt.setDate(currentDt.getDate() + 7);
      } else if (existing.repeat_type === "monthly") {
        currentDt.setMonth(currentDt.getMonth() + 1);
      } else if (existing.repeat_type === "yearly") {
        currentDt.setFullYear(currentDt.getFullYear() + 1);
      }
      nextDatetime = currentDt.toISOString();
      nextStatus = "pending";
    }

    const updated: ReminderLocal = {
      ...existing,
      status: nextStatus,
      reminder_datetime: nextDatetime,
    };

    await putCachedReminder(updated);
    await syncLocalStorageBackup();

    console.log("Reminder completed/rolled over locally:", updated);
    return updated;
  },
};

// ==========================================
// Offline Sync & Push Notification Stubs
// ==========================================
export async function synchronizeOfflineOperations(): Promise<boolean> {
  await syncLocalStorageBackup();
  return true;
}

export const pushApi = {
  async getPublicKey(): Promise<{ publicKey: string }> {
    return { publicKey: "" };
  },
  async subscribe(subscription: any): Promise<any> {
    return { success: true };
  },
  async unsubscribe(endpoint: string): Promise<any> {
    return { success: true };
  },
};
