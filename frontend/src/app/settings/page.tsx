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
  ShieldAlert, 
  AlertCircle 
} from "lucide-react";
import { authApi, synchronizeOfflineOperations } from "@/lib/api";
import { 
  checkPushSubscription, 
  subscribeUserToPush, 
  unsubscribeUserFromPush 
} from "@/lib/swRegister";
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
    const subscribed = await checkPushSubscription();
    setNotificationsEnabled(subscribed);
    setLoadingPush(false);
  };

  const handleNotificationToggle = async () => {
    setFeedbackMsg("");
    if (notificationsEnabled) {
      const success = await unsubscribeUserFromPush();
      if (success) {
        setNotificationsEnabled(false);
      } else {
        setFeedbackMsg("Failed to unsubscribe.");
      }
    } else {
      // Request permission & subscribe
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setFeedbackMsg("Notification permission was denied.");
        return;
      }
      
      const success = await subscribeUserToPush();
      if (success) {
        setNotificationsEnabled(true);
      } else {
        setFeedbackMsg("Could not enroll push token with server.");
      }
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
      } else {
        setFeedbackMsg("Could not complete sync. Check connection.");
      }
    } catch (err: any) {
      setFeedbackMsg("Sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
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
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-600 shadow-sm">
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
                <span>Push Alerts</span>
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-[200px]">
                Receive instant notifications on this device when reminders trigger.
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
