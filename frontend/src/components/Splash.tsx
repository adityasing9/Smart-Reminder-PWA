"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

export default function Splash() {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Trigger animations after mounting
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-50 overflow-hidden">
      {/* Background glowing circles */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-emerald-500/5 blur-[80px]" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-green-500/5 blur-[80px]" />

      <div className="flex flex-col items-center max-w-sm px-6 text-center">
        {/* Animated App Icon Wrapper */}
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-tr from-emerald-600 via-emerald-500 to-green-500 shadow-2xl shadow-emerald-500/30 transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) ${
            animate ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-12 opacity-0"
          }`}
        >
          <Bell className={`h-12 w-12 text-white transition-transform duration-700 delay-500 ${
            animate ? "scale-110 rotate-12" : "scale-90"
          }`} />
        </div>

        {/* Title */}
        <h1
          className={`mt-8 text-3xl font-bold tracking-tight text-slate-900 transition-all duration-700 delay-300 ${
            animate ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          Smart Reminder
        </h1>

        {/* Description */}
        <p
          className={`mt-2 text-sm text-slate-600 transition-all duration-700 delay-500 ${
            animate ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          Your intelligent offline-first scheduling assistant.
        </p>

        {/* Custom Progress/Loading Bar */}
        <div
          className={`mt-10 h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 transition-all duration-700 delay-700 ${
            animate ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
        >
          <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500 animate-infinite-loading" />
        </div>
      </div>
      
      {/* Styles for custom infinite loading keyframe animation */}
      <style jsx global>{`
        @keyframes infinite-loading {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-infinite-loading {
          animation: infinite-loading 1.8s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
