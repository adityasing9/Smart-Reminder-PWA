"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { initializeNotificationSystem, syncAllNativeReminderNotifications } from "@/lib/nativeNotifications";
import { getCachedReminders } from "@/lib/db";

export default function NativeInitializer() {
  const router = useRouter();

  useEffect(() => {
    // 1. Initialize Android channels, action types, and click handlers
    initializeNotificationSystem((reminderId: number) => {
      console.log("User tapped notification for reminder:", reminderId);
      router.push(`/reminder/edit?id=${reminderId}`);
    });

    // 2. Schedule upcoming reminders from local cache into Android AlarmManager
    const scheduleAlarms = async () => {
      try {
        const cached = await getCachedReminders();
        if (cached && cached.length > 0) {
          await syncAllNativeReminderNotifications(cached);
        }
      } catch (e) {
        console.warn("Could not sync native reminder alarms on startup:", e);
      }
    };

    scheduleAlarms();
  }, [router]);

  return null;
}
