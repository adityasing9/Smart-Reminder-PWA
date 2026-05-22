"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, AlertCircle, RefreshCw, CalendarRange, CheckCircle2 } from "lucide-react";
import { remindersApi, authApi, isOnline } from "@/lib/api";
import { ReminderLocal } from "@/lib/db";
import ReminderCard from "@/components/ReminderCard";
import BottomNavigation from "@/components/BottomNavigation";

export default function DashboardPage() {
  const router = useRouter();
  const [reminders, setReminders] = useState<ReminderLocal[]>([]);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Load user profile & reminders on mount
  useEffect(() => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        router.push("/login");
        return;
      }
      setUser(authApi.getCurrentUser());
      fetchReminders();
    } catch (error) {
      console.error("localStorage access failed:", error);
      router.push("/login");
    }
  }, [router]);

  const fetchReminders = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await remindersApi.getAll();
      setReminders(data);
    } catch (err: any) {
      setError(err.message || "Failed to load reminders.");
    } finally {
      setIsLoading(false);
    }
  };

  // Complete a reminder
  const handleComplete = async (id: number) => {
    try {
      const updated = await remindersApi.complete(id);
      // Update local state immediately
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? updated : r))
      );
    } catch (err: any) {
      console.error("Failed to complete reminder:", err);
    }
  };

  // Delete a reminder
  const handleCleanDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    
    try {
      await remindersApi.delete(id);
      // Remove from state immediately
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      console.error("Failed to delete reminder:", err);
    }
  };

  // Organize reminders into status categories
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Filter based on search & category select
  const filteredReminders = reminders.filter((r) => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || r.category.toLowerCase() === selectedCategory.toLowerCase();
    
    return matchesSearch && matchesCategory;
  });

  const activeReminders = filteredReminders.filter((r) => r.status !== "completed");
  
  // Overdue
  const overdueReminders = activeReminders.filter((r) => {
    const rDate = new Date(r.reminder_datetime);
    return r.status === "overdue" || rDate < now;
  });

  // Today
  const todayReminders = activeReminders.filter((r) => {
    const rDate = new Date(r.reminder_datetime);
    return r.status !== "overdue" && rDate >= now && rDate <= endOfToday;
  });

  // Upcoming
  const upcomingReminders = activeReminders.filter((r) => {
    const rDate = new Date(r.reminder_datetime);
    return r.status !== "overdue" && rDate > endOfToday;
  });

  // Recent Completed
  const completedReminders = filteredReminders.filter((r) => r.status === "completed");

  const categories = ["all", "general", "personal", "work", "study", "health", "finance"];

  return (
    <div className="min-h-screen bg-[#f0f2f5] px-4 pt-6 pb-24 text-slate-800">
      {/* Header Profile Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500">Welcome back</span>
          <h2 className="text-xl font-bold text-slate-900 capitalize">
            {user ? `Hello, ${user.name}!` : "Hello!"}
          </h2>
        </div>
        <button 
          onClick={fetchReminders}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 shadow-sm active:scale-95 transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Search Input */}
      <div className="mt-5 relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search reminders..."
          className="w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all shadow-sm"
        />
      </div>

      {/* Category Pills Slider */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold capitalize border transition-all ${
              selectedCategory === cat
                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/10"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3.5 text-xs text-rose-600 shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* List Sections */}
      {isLoading && reminders.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="mt-3 text-sm font-medium">Loading your agenda...</span>
        </div>
      ) : reminders.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100">
            <CalendarRange className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">All caught up!</h3>
          <p className="mt-2 text-xs text-slate-500 max-w-xs leading-relaxed">
            No reminders scheduled. Tap the green plus button below to create one.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Overdue Section */}
          {overdueReminders.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                Overdue ({overdueReminders.length})
              </h4>
              <div className="space-y-2.5">
                {overdueReminders.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    onComplete={handleComplete}
                    onDelete={handleCleanDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Today Section */}
          {todayReminders.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Today ({todayReminders.length})
              </h4>
              <div className="space-y-2.5">
                {todayReminders.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    onComplete={handleComplete}
                    onDelete={handleCleanDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Section */}
          {upcomingReminders.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Upcoming ({upcomingReminders.length})
              </h4>
              <div className="space-y-2.5">
                {upcomingReminders.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    onComplete={handleComplete}
                    onDelete={handleCleanDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active Empty Fallback */}
          {activeReminders.length === 0 && (
            <div className="py-8 text-center text-slate-400">
              <p className="text-xs">No active reminders match your filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation Shell */}
      <BottomNavigation />
    </div>
  );
}
