"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, CalendarRange, AlertCircle } from "lucide-react";
import { remindersApi } from "@/lib/api";
import { getCachedReminderById, ReminderLocal } from "@/lib/db";
import ReminderForm from "@/components/ReminderForm";

export default function ReminderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [reminder, setReminder] = useState<ReminderLocal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    loadReminder();
  }, [id]);

  const loadReminder = async () => {
    setIsLoading(true);
    setError("");
    try {
      // 1. Load from IndexedDB immediately for instant offline-first rendering
      const localData = await getCachedReminderById(id);
      if (localData) {
        setReminder(localData);
      }

      // 2. Fetch fresh data if online (optional fallback check)
      // Since reminders list is already stashed, getCachedReminderById is normally highly accurate
    } catch (err: any) {
      setError("Failed to load reminder details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (formData: any) => {
    setIsSaving(true);
    setError("");
    try {
      await remindersApi.update(id, formData);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to update reminder.");
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;

    setIsSaving(true);
    try {
      await remindersApi.delete(id);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to delete reminder.");
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] px-4 pt-6 text-slate-800">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 shadow-sm active:scale-95 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
          <CalendarRange className="h-4.5 w-4.5 text-emerald-600" />
          <span>Edit Reminder</span>
        </h2>
        {/* Delete Button */}
        <button
          onClick={handleDelete}
          disabled={isSaving}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100/50 shadow-sm active:scale-95 transition-all"
          aria-label="Delete reminder"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Container */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <span className="mt-3 text-sm font-medium">Loading details...</span>
          </div>
        ) : reminder ? (
          <ReminderForm
            initialData={reminder}
            onSubmit={handleUpdate}
            isLoading={isSaving}
          />
        ) : (
          <div className="py-16 text-center text-slate-500">
            <p className="font-medium text-slate-700">Reminder not found.</p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
            >
              Return to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
