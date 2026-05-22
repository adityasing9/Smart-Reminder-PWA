"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";
import Splash from "@/components/Splash";

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token exists safely
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        // User is already logged in, redirect directly to dashboard
        router.push("/dashboard");
        return;
      }
    } catch (error) {
      console.error("localStorage access failed:", error);
    }

    // Show splash screen for 2.5 seconds, then show welcome landing
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  if (loading) {
    return <Splash />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-slate-50 px-6 py-12 text-center overflow-hidden relative">
      {/* Glow elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-green-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mt-12">
        {/* App Logo */}
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-tr from-emerald-600 to-green-500 text-white shadow-xl shadow-emerald-600/20">
          <Bell className="h-8 w-8" />
        </div>

        <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Never Forget A
          <span className="block mt-1 bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
            Single Task.
          </span>
        </h1>

        <p className="mt-4 text-base text-slate-600 leading-relaxed">
          Stay synchronized. Manage your tasks seamlessly on the web, offline, and right on your home screen.
        </p>

        {/* Features preview */}
        <div className="mt-8 w-full space-y-3">
          {[
            { title: "Offline Support", desc: "View and create reminders without internet" },
            { title: "Home Screen App", desc: "Behaves like a native app when installed" },
            { title: "Web Push Alerts", desc: "Get notified on time, even when closed" }
          ].map((feat, i) => (
            <div key={i} className="flex items-start text-left gap-3 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="mt-1 flex h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-slate-800">{feat.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="w-full max-w-xs space-y-3 mt-8 z-10">
        <Link
          href="/register"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-transform hover:from-emerald-700 hover:to-green-600 active:scale-98"
        >
          <span>Get Started</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-600 transition-colors shadow-sm"
        >
          I already have an account
        </Link>
      </div>
    </div>
  );
}
