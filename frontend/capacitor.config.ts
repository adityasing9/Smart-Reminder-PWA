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
      iconColor: "#10b981"
    }
  }
};

export default config;
