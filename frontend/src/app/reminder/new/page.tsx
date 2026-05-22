"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BellPlus } from "lucide-react";
import { remindersApi } from "@/lib/api";
import ReminderForm from "@/components/ReminderForm";

export default function NewReminderPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (formData: any) => {
    setIsLoading(true);
    setError("");
    try {
      await remindersApi.create(formData);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to create reminder.");
      setIsLoading(false);
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
          <BellPlus className="h-4.5 w-4.5 text-emerald-600" />
          <span>New Reminder</span>
        </h2>
        {/* Placeholder to balance layout */}
        <div className="w-10 h-10" />
      </div>

      {error && (
        <div className="mt-5 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 shadow-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Form Container */}
      <div className="mt-6">
        <ReminderForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
}
