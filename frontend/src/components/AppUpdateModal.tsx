"use client";

import { useEffect, useState } from "react";
import { Download, Sparkles, X, ExternalLink, RefreshCw } from "lucide-react";
import { checkForAppUpdates, startAppUpdate, UpdateInfo } from "@/lib/appUpdater";

export default function AppUpdateModal() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check for updates on mount after 2 seconds
    const timer = setTimeout(async () => {
      const info = await checkForAppUpdates();
      if (info.hasUpdate) {
        setUpdateInfo(info);
        setIsOpen(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!isOpen || !updateInfo || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
        {/* Dismiss Button */}
        <button
          onClick={() => {
            setIsOpen(false);
            setDismissed(true);
          }}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon & Badge */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Update Available
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Version {updateInfo.latestVersion}
            </h3>
          </div>
        </div>

        {/* Description / Release Notes */}
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 max-h-36 overflow-y-auto leading-relaxed border border-slate-100">
          <p className="font-semibold text-slate-800 mb-1">What&apos;s New:</p>
          <div className="whitespace-pre-line text-slate-600">
            {updateInfo.releaseNotes}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          Installed: v{updateInfo.currentVersion} • Latest: v{updateInfo.latestVersion}
        </p>

        {/* Action Buttons */}
        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={() => {
              startAppUpdate(updateInfo.apkDownloadUrl, updateInfo.githubReleaseUrl);
            }}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Download className="h-4 w-4" />
            <span>Download APK</span>
          </button>

          <a
            href={updateInfo.githubReleaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 shadow-sm active:scale-95 transition-all"
            title="View on GitHub"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
