"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Settings, 
  User, 
  Bell, 
  BellOff, 
  Database, 
  RefreshCw, 
  LogOut, 
  Sparkles,
  Download,
  CheckCircle,
  ExternalLink,
  AlertCircle 
} from "lucide-react";
import { authApi, synchronizeOfflineOperations } from "@/lib/api";
import { 
  checkPushSubscription, 
  subscribeUserToPush, 
  unsubscribeUserFromPush 
} from "@/lib/swRegister";
import { 
  checkNotificationPermission, 
  requestNotificationPermission,
  syncAllNativeReminderNotifications
} from "@/lib/nativeNotifications";
import { 
  checkForAppUpdates, 
  startAppUpdate, 
  CURRENT_APP_VERSION, 
  UpdateInfo 
} from "@/lib/appUpdater";
import { getCachedReminders, getSyncQueue } from "@/lib/db";
import BottomNavigation from "@/components/BottomNavigation";

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [loadingPush, setLoadingPush] = useState(true);

  // App Update state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    
    setProfile(authApi.getCurrentUser());
    loadDiagnostics();
    checkPushStatus();
  }, [router]);

  const loadDiagnostics = async () => {
    const cached = await getCachedReminders();
    const queue = await getSyncQueue();
    setCacheCount(cached.length);
    setSyncQueueCount(queue.length);
  };

  const checkPushStatus = async () => {
    setLoadingPush(true);
    // Check both native permission and web push subscription
    const nativePerm = await checkNotificationPermission();
    const webSubscribed = await checkPushSubscription();
    setNotificationsEnabled(nativePerm || webSubscribed);
    setLoadingPush(false);
  };

  const handleNotificationToggle = async () => {
    setFeedbackMsg("");
    if (notificationsEnabled) {
      const success = await unsubscribeUserFromPush();
      setNotificationsEnabled(false);
      setFeedbackMsg(success ? "Notifications turned off." : "Notifications disabled locally.");
    } else {
      // 1. Request native permission
      const granted = await requestNotificationPermission();
      if (!granted) {
        setFeedbackMsg("Notification permission was denied in device settings.");
        return;
      }
      
      // 2. Also register web push if available
      await subscribeUserToPush();
      setNotificationsEnabled(true);
      setFeedbackMsg("Notifications enabled! Alarms and alerts are active.");

      // Sync upcoming reminders into native alarms immediately
      const cached = await getCachedReminders();
      await syncAllNativeReminderNotifications(cached);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setFeedbackMsg("");
    try {
      const success = await synchronizeOfflineOperations();
      if (success) {
        setFeedbackMsg("Sync complete! Database fully updated.");
        await loadDiagnostics();
        const cached = await getCachedReminders();
        await syncAllNativeReminderNotifications(cached);
      } else {
        setFeedbackMsg("Could not complete sync. Check connection.");
      }
    } catch (err: any) {
      setFeedbackMsg("Sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateMessage("");
    try {
      const info = await checkForAppUpdates();
      setUpdateInfo(info);
      if (info.hasUpdate) {
        setUpdateMessage(`New update available: v${info.latestVersion}`);
      } else {
        setUpdateMessage(`You're up to date! (v${CURRENT_APP_VERSION})`);
      }
    } catch (err) {
      setUpdateMessage("Could not check updates. Check internet connection.");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleLogout = () => {
    authApi.logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] px-4 pt-6 pb-24 text-slate-800">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-emerald-600" />
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
      </div>

      {feedbackMsg && (
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-600 shadow-sm animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      <div className="mt-6 space-y-5">
        {/* Profile Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
            <User className="h-3.5 w-3.5" />
            <span>Profile details</span>
          </h3>
          {profile && (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800 capitalize">{profile.name}</p>
              <p className="text-xs text-slate-500">{profile.email}</p>
            </div>
          )}
        </div>

        {/* Notifications Config Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                {notificationsEnabled ? <Bell className="h-3.5 w-3.5 text-emerald-600" /> : <BellOff className="h-3.5 w-3.5 text-slate-400" />}
                <span>Reminder Notifications</span>
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-[200px]">
                High-priority native device alarms &amp; notifications when reminders trigger.
              </p>
            </div>
            
            {/* Toggle Switch */}
            <button
              onClick={handleNotificationToggle}
              disabled={loadingPush}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                notificationsEnabled ? "bg-emerald-600" : "bg-slate-200"
              } ${loadingPush ? "opacity-50" : ""}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  notificationsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* In-App Update Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>App Version &amp; Updates</span>
              </h3>
              <p className="text-xs font-medium text-slate-700">
                Installed Version: <span className="font-bold text-slate-900">v{CURRENT_APP_VERSION}</span>
              </p>
            </div>
            <button
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isCheckingUpdate ? "animate-spin text-emerald-600" : ""}`} />
              <span>{isCheckingUpdate ? "Checking..." : "Check"}</span>
            </button>
          </div>

          {updateMessage && (
            <div className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
              updateInfo?.hasUpdate 
                ? "bg-amber-50 text-amber-700 border border-amber-100" 
                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
            }`}>
              {updateInfo?.hasUpdate ? <Sparkles className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
              <span>{updateMessage}</span>
            </div>
          )}

          {updateInfo?.hasUpdate && (
            <div className="pt-1">
              <button
                onClick={() => startAppUpdate(updateInfo.apkDownloadUrl, updateInfo.githubReleaseUrl)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download &amp; Install APK (v{updateInfo.latestVersion})</span>
              </button>
            </div>
          )}
        </div>

        {/* Storage / Offline Diagnostic Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-slate-500" />
            <span>Offline Diagnostics</span>
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
              <span className="block text-xl font-bold text-slate-800">{cacheCount}</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Cached Tasks</span>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
              <span className={`block text-xl font-bold ${syncQueueCount > 0 ? "text-amber-600" : "text-slate-800"}`}>
                {syncQueueCount}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Sync Queue</span>
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 py-3 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>Synchronize Now</span>
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-50 border border-rose-100 hover:bg-rose-100/50 py-3.5 text-sm font-semibold text-rose-600 transition-colors shadow-sm"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Navigation */}
      <BottomNavigation />
    </div>
  );
}
