import { Capacitor } from "@capacitor/core";
import { LocalNotifications, ScheduleOptions, ActionPerformed } from "@capacitor/local-notifications";
import { ReminderLocal } from "./db";

// Use versioned channel ID to force Android to register fresh channel settings (sound, importance, vibration)
export const REMINDERS_CHANNEL_ID = "smart_reminders_channel_v3";
export const LEGACY_CHANNEL_IDS = ["reminders_channel_v1", "reminders_channel_v2"];

/**
 * Ensures an ID is within Android's 32-bit signed integer range (1 <= id <= 2,147,483,647).
 * Android's LocalNotification plugin rejects IDs greater than Integer.MAX_VALUE with IDENTIFIER_NOT_INT.
 */
export function toSafeNotificationId(id: number): number {
  const numeric = Math.abs(Math.floor(Number(id) || 1));
  const safe = numeric % 2000000000;
  return safe === 0 ? 1 : safe;
}

/**
 * Initializes the notification system:
 * - Deletes legacy silent channels
 * - Creates high-priority notification channel with custom audio chime and vibration
 * - Registers action types (e.g., Mark Done, View Details)
 * - Registers event listeners for notification clicks
 */
export async function initializeNotificationSystem(
  onNotificationClick?: (reminderId: number) => void
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    // 1. Clean up old/broken channels if they exist
    for (const oldId of LEGACY_CHANNEL_IDS) {
      try {
        await LocalNotifications.deleteChannel({ id: oldId });
      } catch {
        // Ignore deletion failure if channel did not exist
      }
    }

    // 2. Create High-Priority Notification Channel for Android
    await LocalNotifications.createChannel({
      id: REMINDERS_CHANNEL_ID,
      name: "Reminders & Alarms",
      description: "Critical audible alerts and heads-up notifications for scheduled reminders",
      importance: 5, // High / Heads-up notification with sound and popup
      visibility: 1, // Public on lockscreen
      sound: "reminder_alert.wav",
      vibration: true,
      lights: true,
      lightColor: "#10b981",
    });

    // 3. Register Action Types (Action buttons on notification)
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: "REMINDER_ACTIONS",
          actions: [
            {
              id: "view",
              title: "View Details",
            },
            {
              id: "complete",
              title: "Mark Done",
            },
          ],
        },
      ],
    });

    // 4. Listen for notification click
    LocalNotifications.addListener("localNotificationActionPerformed", (action: ActionPerformed) => {
      const reminderId = action.notification.extra?.reminderId;
      if (reminderId && onNotificationClick) {
        onNotificationClick(Number(reminderId));
      }
    });

    console.log("Native notification system initialized with channel:", REMINDERS_CHANNEL_ID);
    return true;
  } catch (err) {
    console.error("Failed to initialize native notification system:", err);
    return false;
  }
}

/**
 * Requests notification permissions from the operating system
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.requestPermissions();
      const isGranted = status.display === "granted";
      console.log("Native notification permission requested, result:", status.display);
      return isGranted;
    } catch (err) {
      console.error("Native notification permission request failed:", err);
      return false;
    }
  }

  // Web fallback
  if (typeof window !== "undefined" && "Notification" in window) {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

/**
 * Checks if notification permission is currently granted
 */
export async function checkNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display === "granted";
    } catch {
      return false;
    }
  }

  if (typeof window !== "undefined" && "Notification" in window) {
    return Notification.permission === "granted";
  }

  return false;
}

/**
 * Schedules a local notification for an individual reminder
 */
export async function scheduleNativeReminderNotification(reminder: ReminderLocal): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  // Completed reminders do not get alarms
  if (reminder.status === "completed") {
    await cancelNativeReminderNotification(reminder.id);
    return false;
  }

  const reminderDate = new Date(reminder.reminder_datetime);
  const now = new Date();

  // If time has already passed, don't schedule
  if (reminderDate.getTime() <= now.getTime()) {
    console.log(`Reminder #${reminder.id} time is in the past (${reminder.reminder_datetime}), skipping alarm.`);
    return false;
  }

  const safeId = toSafeNotificationId(reminder.id);

  try {
    const priorityEmoji =
      reminder.priority === "high" ? "🚨 [HIGH] " : reminder.priority === "low" ? "ℹ️ " : "⏰ ";

    const scheduleOptions: ScheduleOptions = {
      notifications: [
        {
          id: safeId,
          title: `${priorityEmoji}${reminder.title}`,
          body: reminder.description || "It's time for your scheduled reminder!",
          schedule: {
            at: reminderDate,
            allowWhileIdle: true, // Guarantees wake-up even during Android Doze mode
          },
          channelId: REMINDERS_CHANNEL_ID,
          actionTypeId: "REMINDER_ACTIONS",
          extra: {
            reminderId: reminder.id,
          },
          sound: "reminder_alert.wav",
          smallIcon: "ic_stat_notification",
        },
      ],
    };

    await LocalNotifications.schedule(scheduleOptions);
    console.log(`[ALARM SCHEDULED] ID: ${safeId} (reminder #${reminder.id}) at ${reminderDate.toLocaleString()}`);
    return true;
  } catch (err) {
    console.error(`Failed to schedule native notification for reminder #${reminder.id} (ID: ${safeId}):`, err);
    return false;
  }
}

/**
 * Cancels a scheduled local notification for a reminder
 */
export async function cancelNativeReminderNotification(reminderId: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const safeId = toSafeNotificationId(reminderId);
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: safeId }],
    });
    console.log(`[ALARM CANCELLED] ID: ${safeId} for reminder #${reminderId}`);
  } catch (err) {
    console.warn(`Could not cancel native notification ID #${safeId}:`, err);
  }
}

/**
 * Schedules an immediate test notification (fires in 3 seconds) with sound and heads-up banner
 */
export async function scheduleTestNotification(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // Web test notification
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("🔔 Test Reminder Alert", {
          body: "Notifications and alerts are active!",
        });
        return true;
      }
    }
    return false;
  }

  try {
    const triggerAt = new Date(Date.now() + 3000); // 3 seconds from now
    const testId = 999999;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: testId,
          title: "🔔 Sound & Alert Test",
          body: "Great! Native notifications, exact alarms, and audio chime are working perfectly on your device.",
          schedule: {
            at: triggerAt,
            allowWhileIdle: true,
          },
          channelId: REMINDERS_CHANNEL_ID,
          actionTypeId: "REMINDER_ACTIONS",
          sound: "reminder_alert.wav",
          smallIcon: "ic_stat_notification",
        },
      ],
    });

    console.log("Test notification scheduled for 3 seconds from now.");
    return true;
  } catch (err) {
    console.error("Failed to schedule test notification:", err);
    return false;
  }
}

/**
 * Synchronizes all upcoming reminders with native Android alarms.
 * Runs on startup, login, and background sync to guarantee zero missed alerts.
 */
export async function syncAllNativeReminderNotifications(reminders: ReminderLocal[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Get currently scheduled notifications
    const pending = await LocalNotifications.getPending();
    const pendingIds = new Set(pending.notifications.map((n) => n.id));

    const now = new Date().getTime();

    // 2. Identify active reminders that need to be scheduled
    const activeReminders = reminders.filter(
      (r) => r.status === "pending" && new Date(r.reminder_datetime).getTime() > now
    );

    const activeSafeIds = new Set(activeReminders.map((r) => toSafeNotificationId(r.id)));

    // 3. Cancel any notifications for reminders that were completed/deleted (ignoring testId 999999)
    const idsToCancel = Array.from(pendingIds)
      .filter((id) => id !== 999999 && !activeSafeIds.has(id))
      .map((id) => ({ id }));

    if (idsToCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: idsToCancel });
    }

    // 4. Schedule or reschedule all active reminders
    for (const reminder of activeReminders) {
      await scheduleNativeReminderNotification(reminder);
    }

    console.log(`Synced ${activeReminders.length} native reminder notifications.`);
  } catch (err) {
    console.error("Failed to sync native reminder notifications:", err);
  }
}
