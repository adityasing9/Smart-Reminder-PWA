import { Capacitor } from "@capacitor/core";
import { LocalNotifications, ScheduleOptions, ActionPerformed } from "@capacitor/local-notifications";
import { ReminderLocal } from "./db";

export const REMINDERS_CHANNEL_ID = "reminders_channel_v1";

/**
 * Initializes the notification system:
 * - Creates high-priority notification channels on Android
 * - Sets up action types (e.g., Mark Done)
 * - Registers event listeners for notification clicks
 */
export async function initializeNotificationSystem(
  onNotificationClick?: (reminderId: number) => void
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // Running in web/PWA mode - handled by Web Push Service Worker
    return false;
  }

  try {
    // 1. Create High-Priority Notification Channel for Android
    await LocalNotifications.createChannel({
      id: REMINDERS_CHANNEL_ID,
      name: "Reminders & Alerts",
      description: "Critical notifications and alerts for your scheduled reminders",
      importance: 5, // High / Heads-up notification
      visibility: 1, // Public on lockscreen
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#10b981",
    });

    // 2. Register Action Types (Action buttons on notification)
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

    // 3. Listen for notification click
    LocalNotifications.addListener("localNotificationActionPerformed", (action: ActionPerformed) => {
      const reminderId = action.notification.extra?.reminderId;
      if (reminderId && onNotificationClick) {
        onNotificationClick(Number(reminderId));
      }
    });

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
      return status.display === "granted";
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

  // Only schedule if pending and time is in the future
  if (reminder.status === "completed") {
    await cancelNativeReminderNotification(reminder.id);
    return false;
  }

  const reminderDate = new Date(reminder.reminder_datetime);
  const now = new Date();

  // If time has already passed, don't schedule
  if (reminderDate.getTime() <= now.getTime()) {
    return false;
  }

  try {
    const priorityEmoji =
      reminder.priority === "high" ? "🚨 [HIGH] " : reminder.priority === "low" ? "ℹ️ " : "⏰ ";

    const scheduleOptions: ScheduleOptions = {
      notifications: [
        {
          id: reminder.id,
          title: `${priorityEmoji}${reminder.title}`,
          body: reminder.description || "It's time for your scheduled reminder!",
          schedule: {
            at: reminderDate,
            allowWhileIdle: true, // Bypasses Android Doze mode
          },
          channelId: REMINDERS_CHANNEL_ID,
          actionTypeId: "REMINDER_ACTIONS",
          extra: {
            reminderId: reminder.id,
          },
          sound: "default",
          smallIcon: "res://drawable/ic_stat_notification",
          largeIcon: "res://drawable/ic_launcher",
        },
      ],
    };

    await LocalNotifications.schedule(scheduleOptions);
    console.log(`Native notification scheduled for reminder #${reminder.id} at ${reminderDate.toLocaleString()}`);
    return true;
  } catch (err) {
    console.error(`Failed to schedule native notification for reminder #${reminder.id}:`, err);
    return false;
  }
}

/**
 * Cancels a scheduled local notification for a reminder
 */
export async function cancelNativeReminderNotification(reminderId: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: reminderId }],
    });
  } catch (err) {
    console.warn(`Could not cancel native notification #${reminderId}:`, err);
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

    const activeIds = new Set(activeReminders.map((r) => r.id));

    // 3. Cancel any notifications for reminders that were completed/deleted
    const idsToCancel = Array.from(pendingIds)
      .filter((id) => !activeIds.has(id))
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
