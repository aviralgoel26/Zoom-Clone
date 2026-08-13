"use client";

/**
 * app/schedule/page.tsx
 * ---------------------
 * Schedule Meeting form page.
 * Collects meeting details and POSTs to FastAPI /api/meetings/schedule.
 * On success, navigates back to the dashboard where the meeting appears
 * in the "Upcoming" tab.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  FileText,
  ArrowLeft,
  Check,
  Loader2,
  Video,
} from "lucide-react";
import { scheduleMeeting } from "@/lib/api";

export default function SchedulePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",         // yyyy-MM-dd
    time: "",         // HH:mm
    duration: "60",   // minutes as string
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.title || !form.date || !form.time) {
      setError("Title, date, and time are required.");
      return;
    }

    // Combine date + time → ISO 8601 string in local timezone, then convert to UTC
    const localDatetime = new Date(`${form.date}T${form.time}:00`);
    if (isNaN(localDatetime.getTime())) {
      setError("Invalid date or time.");
      return;
    }

    setSubmitting(true);
    try {
      await scheduleMeeting({
        title: form.title,
        description: form.description || undefined,
        scheduled_at: localDatetime.toISOString(),
        duration_minutes: parseInt(form.duration, 10) || 60,
      });
      setSuccess(true);
      // Navigate home after short delay so user sees the success state
      setTimeout(() => router.push("/"), 1500);
    } catch (err) {
      setError("Failed to schedule meeting. Is the backend running?");
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Minimum date for picker = today
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-[#131314] flex flex-col">
      {/* Header */}
      <header className="bg-[#1C1C1E] border-b border-[#2C2C2E] px-6 py-4 flex items-center gap-4">
        <button
          id="schedule-back"
          onClick={() => router.push("/")}
          className="p-2 rounded-lg hover:bg-[#2C2C2E] text-[#8E8E93] hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#0E72ED] rounded-lg flex items-center justify-center">
            <Video className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-semibold">Schedule Meeting</span>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-8 max-w-lg w-full shadow-2xl">

          {success ? (
            /* Success state */
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-[#34C759]/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-[#34C759]" />
              </div>
              <h2 className="text-white font-bold text-xl mb-2">
                Meeting Scheduled!
              </h2>
              <p className="text-[#8E8E93] text-sm">
                Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="mb-6">
                <h1 className="text-white font-bold text-xl">New Scheduled Meeting</h1>
                <p className="text-[#8E8E93] text-sm mt-1">
                  Set up a meeting in advance and share the link.
                </p>
              </div>

              {/* Title */}
              <FormField
                label="Meeting Title"
                icon={<FileText className="w-4 h-4" />}
              >
                <input
                  id="schedule-title"
                  type="text"
                  placeholder="e.g. Sprint Planning Q3"
                  value={form.title}
                  onChange={update("title")}
                  required
                  className="w-full bg-[#2C2C2E] text-white placeholder-[#8E8E93] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0E72ED] transition"
                />
              </FormField>

              {/* Description */}
              <FormField
                label="Description (optional)"
                icon={<FileText className="w-4 h-4" />}
              >
                <textarea
                  id="schedule-description"
                  placeholder="Add meeting agenda or notes..."
                  value={form.description}
                  onChange={update("description")}
                  rows={3}
                  className="w-full bg-[#2C2C2E] text-white placeholder-[#8E8E93] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0E72ED] transition resize-none"
                />
              </FormField>

              {/* Date + Time row */}
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Date" icon={<Calendar className="w-4 h-4" />}>
                  <input
                    id="schedule-date"
                    type="date"
                    value={form.date}
                    min={todayStr}
                    onChange={update("date")}
                    required
                    className="w-full bg-[#2C2C2E] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0E72ED] transition [color-scheme:dark]"
                  />
                </FormField>
                <FormField label="Time" icon={<Clock className="w-4 h-4" />}>
                  <input
                    id="schedule-time"
                    type="time"
                    value={form.time}
                    onChange={update("time")}
                    required
                    className="w-full bg-[#2C2C2E] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0E72ED] transition [color-scheme:dark]"
                  />
                </FormField>
              </div>

              {/* Duration */}
              <FormField label="Duration" icon={<Clock className="w-4 h-4" />}>
                <select
                  id="schedule-duration"
                  value={form.duration}
                  onChange={update("duration")}
                  className="w-full bg-[#2C2C2E] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0E72ED] transition"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </FormField>

              {/* Error message */}
              {error && (
                <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-xl px-4 py-3 text-[#FF3B30] text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                id="schedule-submit"
                type="submit"
                disabled={submitting}
                className="w-full bg-[#0E72ED] hover:bg-[#1A7FF0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Schedule Meeting
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormField — labelled input wrapper
// ---------------------------------------------------------------------------
interface FormFieldProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function FormField({ label, icon, children }: FormFieldProps) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[#8E8E93] text-xs font-medium mb-1.5">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}
