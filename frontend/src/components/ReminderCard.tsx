"use client";

import Link from "next/link";
import { Clock, RefreshCw, Calendar, AlertTriangle, Edit2, Trash2 } from "lucide-react";
import { ReminderLocal } from "@/lib/db";

interface ReminderCardProps {
  reminder: ReminderLocal;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function ReminderCard({ reminder, onComplete, onDelete }: ReminderCardProps) {
  const isOverdue = reminder.status === "overdue" || 
    (reminder.status === "pending" && new Date(reminder.reminder_datetime) < new Date());

  // Date Formatting Helper
  const formatReminderDate = (dateStr: string) => {
    const dt = new Date(dateStr);
    const now = new Date();
    
    const isToday = dt.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = dt.toDateString() === tomorrow.toDateString();

    const timeOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
    const timeStr = dt.toLocaleTimeString([], timeOptions);

    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;

    const dateOptions: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${dt.toLocaleDateString([], dateOptions)} at ${timeStr}`;
  };

  // Priority Styles
  const getPriorityStyles = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-rose-50 text-rose-600 border-rose-100";
      case "medium":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "low":
        return "bg-sky-50 text-sky-600 border-sky-100";
      default:
        return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white p-4 transition-all duration-300 active:scale-[0.99] ${
        reminder.status === "completed"
          ? "border-slate-100 opacity-60 shadow-none"
          : isOverdue
          ? "border-rose-200 bg-rose-50/20 shadow-sm"
          : "border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Completion Checkbox */}
        <button
          onClick={() => onComplete(reminder.id)}
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
            reminder.status === "completed"
              ? "border-emerald-500 bg-emerald-500 text-white"
              : isOverdue
              ? "border-rose-400 hover:bg-rose-50"
              : "border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50"
          }`}
          aria-label={reminder.status === "completed" ? "Mark incomplete" : "Mark complete"}
        >
          {reminder.status === "completed" && (
            <svg
              className="h-3.5 w-3.5 stroke-[3]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
            </svg>
          )}
        </button>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <Link href={`/reminder/${reminder.id}`} className="block">
            <h3
              className={`text-base font-semibold leading-6 text-slate-800 truncate transition-colors ${
                reminder.status === "completed" ? "line-through text-slate-400" : "group-hover:text-emerald-600"
              }`}
            >
              {reminder.title}
            </h3>
            {reminder.description && (
              <p
                className={`mt-1 text-xs text-slate-500 line-clamp-2 ${
                  reminder.status === "completed" ? "line-through text-slate-300" : ""
                }`}
              >
                {reminder.description}
              </p>
            )}
          </Link>

          {/* Metadata Badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Time Stamp */}
            <div
              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                isOverdue && reminder.status !== "completed"
                  ? "bg-rose-50 text-rose-600 border-rose-100"
                  : "bg-slate-100 text-slate-600 border-slate-200/60"
              }`}
            >
              {isOverdue && reminder.status !== "completed" ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              <span>{formatReminderDate(reminder.reminder_datetime)}</span>
            </div>

            {/* Recurrence Indicator */}
            {reminder.repeat_type && reminder.repeat_type !== "none" && (
              <div className="flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-md">
                <RefreshCw className="h-2.5 w-2.5 animate-spin-slow" />
                <span className="capitalize">{reminder.repeat_type}</span>
              </div>
            )}

            {/* Priority Badge */}
            <div
              className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${getPriorityStyles(
                reminder.priority
              )}`}
            >
              {reminder.priority}
            </div>

            {/* Category Tag */}
            {reminder.category && (
              <div className="text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/50 px-2 py-0.5 rounded-md capitalize">
                {reminder.category}
              </div>
            )}

            {/* Local Offline Banner */}
            {reminder.is_local && (
              <div className="text-[10px] font-semibold bg-cyan-50 text-cyan-600 border border-cyan-100 px-2 py-0.5 rounded-md">
                Unsaved (Offline)
              </div>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-1 self-start">
          <Link
            href={`/reminder/${reminder.id}`}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Edit reminder"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => onDelete(reminder.id)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            aria-label="Delete reminder"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </div>
  );
}
