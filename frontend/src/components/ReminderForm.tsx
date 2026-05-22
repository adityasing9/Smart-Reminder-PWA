"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock, AlertCircle, RefreshCw, Folder } from "lucide-react";
import { ReminderLocal } from "@/lib/db";

interface ReminderFormProps {
  initialData?: ReminderLocal | null;
  onSubmit: (data: {
    title: string;
    description: string | null;
    reminder_datetime: string;
    priority: string;
    category: string;
    repeat_type: string;
  }) => void;
  isLoading?: boolean;
}

export default function ReminderForm({ initialData, onSubmit, isLoading = false }: ReminderFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("general");
  const [repeatType, setRepeatType] = useState("none");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || "");
      setPriority(initialData.priority);
      setCategory(initialData.category);
      setRepeatType(initialData.repeat_type);

      const dt = new Date(initialData.reminder_datetime);
      // Format YYYY-MM-DD for input[type="date"]
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      setDate(`${year}-${month}-${day}`);
      
      // Format HH:MM for input[type="time"]
      const hours = String(dt.getHours()).padStart(2, "0");
      const minutes = String(dt.getMinutes()).padStart(2, "0");
      setTime(`${hours}:${minutes}`);
    } else {
      // Set defaults for a new reminder
      const now = new Date();
      // Add 1 hour to current time
      now.setHours(now.getHours() + 1);
      
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      setDate(`${year}-${month}-${day}`);

      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setTime(`${hours}:${minutes}`);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!date) {
      setError("Date is required.");
      return;
    }
    if (!time) {
      setError("Time is required.");
      return;
    }

    // Parse date and time into ISO string
    const reminderDatetime = new Date(`${date}T${time}`).toISOString();

    onSubmit({
      title,
      description: description.trim() || null,
      reminder_datetime: reminderDatetime,
      priority,
      category,
      repeat_type: repeatType,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-24">
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-xs font-semibold text-slate-600">
          Reminder Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Complete DSA practice"
          disabled={isLoading}
          maxLength={200}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="description" className="text-xs font-semibold text-slate-600">
          Description (Optional)
        </label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details, links, or notes..."
          disabled={isLoading}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        />
      </div>

      {/* Date & Time Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="date" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>Date</span>
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="time" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Time</span>
          </label>
          <input
            type="time"
            id="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Priority & Repeat Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="priority" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
            <span>Priority</span>
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="repeat" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            <span>Repeat</span>
          </label>
          <select
            id="repeat"
            value={repeatType}
            onChange={(e) => setRepeatType(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label htmlFor="category" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <Folder className="h-3.5 w-3.5 text-slate-400" />
          <span>Category</span>
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isLoading}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        >
          <option value="general">General</option>
          <option value="personal">Personal</option>
          <option value="work">Work</option>
          <option value="study">Study</option>
          <option value="health">Health</option>
          <option value="finance">Finance</option>
        </select>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:shadow-emerald-600/35 hover:from-emerald-700 hover:to-green-600 active:scale-98 disabled:opacity-50"
      >
        {isLoading
          ? "Saving..."
          : initialData
          ? "Save Changes"
          : "Create Reminder"}
      </button>
    </form>
  );
}
