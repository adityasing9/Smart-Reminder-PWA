"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { isOnline, synchronizeOfflineOperations } from "@/lib/api";

export default function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setOnline(isOnline());

    const handleOnline = async () => {
      setOnline(true);
      setSyncing(true);
      setShowStatus(true);
      
      // Trigger sync immediately when connection returns
      const success = await synchronizeOfflineOperations();
      
      setSyncing(false);
      // Keep success message for 3 seconds, then hide
      setTimeout(() => {
        setShowStatus(false);
      }, 3000);
    };

    const handleOffline = () => {
      setOnline(false);
      setShowStatus(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check: if offline on load, show it
    if (!navigator.onLine) {
      setOnline(false);
      setShowStatus(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showStatus && online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-2 pointer-events-none">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md transition-all transform duration-300 ${
          !online
            ? "bg-rose-500/90 text-white translate-y-2 border border-rose-400/20"
            : syncing
            ? "bg-indigo-600/90 text-white translate-y-2 border border-indigo-400/20"
            : "bg-emerald-500/90 text-white translate-y-2 border border-emerald-400/20"
        }`}
      >
        {!online ? (
          <>
            <WifiOff className="h-3.5 w-3.5 animate-pulse" />
            <span>Offline Mode — Changes Queued</span>
          </>
        ) : syncing ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>Syncing offline items...</span>
          </>
        ) : (
          <>
            <svg
              className="h-3.5 w-3.5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
            <span>Back Online — Synced Successfully</span>
          </>
        )}
      </div>
    </div>
  );
}
