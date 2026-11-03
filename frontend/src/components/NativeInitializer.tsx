"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  initializeNotificationSystem, 
  syncAllNativeReminderNotifications,
  checkNotificationPermission,
  requestNotificationPermission 
} from "@/lib/nativeNotifications";
import { getCachedReminders } from "@/lib/db";

export default function NativeInitializer() {
  const router = useRouter();

  useEffect(() => {
    const setupNativeAlarms = async () => {
      // 1. Initialize Android channel with sound and action buttons
      await initializeNotificationSystem((reminderId: number) => {
        console.log("User tapped notification for reminder:", reminderId);
        router.push(`/reminder/edit?id=${reminderId}`);
      });

      // 2. Proactively request permission on startup if not yet granted
      const granted = await checkNotificationPermission();
      if (!granted) {
        console.log("Requesting notification permission on startup...");
        await requestNotificationPermission();
      }

      // 3. Schedule upcoming reminders from local cache into Android AlarmManager
      try {
        const cached = await getCachedReminders();
        if (cached && cached.length > 0) {
          await syncAllNativeReminderNotifications(cached);
        }
      } catch (e) {
        console.warn("Could not sync native reminder alarms on startup:", e);
      }
    };

    setupNativeAlarms();
  }, [router]);

  return null;
}
