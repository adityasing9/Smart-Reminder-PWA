"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowLeft, RefreshCw, AlertCircle, Trash2 } from "lucide-react";
import { remindersApi } from "@/lib/api";
import { ReminderLocal } from "@/lib/db";
import ReminderCard from "@/components/ReminderCard";
import BottomNavigation from "@/components/BottomNavigation";

export default function CompletedPage() {
  const router = useRouter();
  const [completedReminders, setCompletedReminders] = useState<ReminderLocal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchCompleted();
  }, [router]);

  const fetchCompleted = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await remindersApi.getAll();
      const completed = data.filter((r) => r.status === "completed");
      setCompletedReminders(completed);
    } catch (err: any) {
      setError(err.message || "Failed to load completed reminders.");
    } finally {
      setIsLoading(false);
    }
  };

  // Restore reminder back to pending status
  const handleRestore = async (id: number) => {
    try {
      // Toggle back to active
      const updated = await remindersApi.update(id, { status: "pending" });
      setCompletedReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      console.error("Failed to restore reminder:", err);
    }
  };

  const handleCleanDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this reminder permanently?")) return;
    
    try {
      await remindersApi.delete(id);
      setCompletedReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      console.error("Failed to delete reminder:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] px-4 pt-6 pb-24 text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>Completed</span>
        </h2>
        <button 
          onClick={fetchCompleted}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 shadow-sm active:scale-95 transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3.5 text-xs text-rose-600 shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* List */}
      {isLoading && completedReminders.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="mt-3 text-sm font-medium">Loading archive...</span>
        </div>
      ) : completedReminders.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800 font-sans">No completed items</h3>
          <p className="mt-2 text-xs text-slate-500 max-w-xs leading-relaxed">
            Completed reminders will appear here. Get started on your tasks to fill it up!
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {completedReminders.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              onComplete={handleRestore} // Toggling on complete will restore it
              onDelete={handleCleanDelete}
            />
          ))}
        </div>
      )}

      {/* Bottom Nav */}
      <BottomNavigation />
    </div>
  );
}
