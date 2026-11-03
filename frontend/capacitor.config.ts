import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.smartreminder.app",
  appName: "Smart Reminder",
  webDir: "out",
  server: {
    androidScheme: "https",
    cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_notification",
      iconColor: "#10b981",
      sound: "reminder_alert.wav"
    }
  }
};

export default config;
