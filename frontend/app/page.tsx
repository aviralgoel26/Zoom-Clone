"use client";

/**
 * page.tsx — Dashboard (Zoom Workplace Desktop)
 * ----------------------------------------------------
 * Pixel-matched replicate of official Zoom Workplace home screen.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  Plus,
  Calendar,
  Monitor,
  PenLine,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import {
  createInstantMeeting,
  getUpcomingMeetings,
  getRecentMeetings,
  Meeting,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface JoinModalState {
  meetingId: string;
  displayName: string;
  rememberName: boolean;
  noAudio: boolean;
  noVideo: boolean;
}

// ---------------------------------------------------------------------------
// Live Clock Hook
// ---------------------------------------------------------------------------
function useLiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const router = useRouter();
  const now = useLiveClock();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Meeting state
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Calendar banner dismissal
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Quick action loading
  const [isCreating, setIsCreating] = useState(false);

  // Join modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinModal, setJoinModal] = useState<JoinModalState>({
    meetingId: "",
    displayName: "Guest",
    rememberName: true,
    noAudio: false,
    noVideo: false,
  });

  // Sync displayName when user logs in or logs out
  useEffect(() => {
    if (user?.display_name) {
      setJoinModal((prev) => ({ ...prev, displayName: user.display_name }));
    }
  }, [user]);

  // Fetch meetings when user auth state changes (login/logout)
  useEffect(() => {
    const load = async () => {
      setLoadingMeetings(true);
      const uid = user?.id;
      const [upcoming, recent] = await Promise.all([
        getUpcomingMeetings(uid),
        getRecentMeetings(uid),
      ]);
      setUpcomingMeetings(upcoming);
      setRecentMeetings(recent);
      setLoadingMeetings(false);
    };
    load();
  }, [user?.id]);

  // Create instant meeting — host only via ?host=true (with offline fallback)
  const handleNewMeeting = async () => {
    setIsCreating(true);
    try {
      const meeting = await createInstantMeeting("Instant Meeting", user?.id);
      if (meeting?.meeting_code) {
        router.push(`/meeting/${meeting.meeting_code}?host=true`);
        return;
      }
      if (meeting?.id) {
        router.push(`/meeting/${meeting.id}?host=true`);
        return;
      }
    } catch {
      console.warn("[Dashboard] Backend API unavailable. Using client fallback meeting code.");
    } finally {
      setIsCreating(false);
    }

    // Fallback: Generate local 9-digit Meeting ID (XXX-XXX-XXX) if backend is unreachable
    const p1 = Math.floor(100 + Math.random() * 900);
    const p2 = Math.floor(100 + Math.random() * 900);
    const p3 = Math.floor(100 + Math.random() * 900);
    const fallbackCode = `${p1}-${p2}-${p3}`;
    router.push(`/meeting/${fallbackCode}?host=true`);
  };

  // Join via modal — no ?host param → participant role
  const handleJoinMeeting = useCallback(() => {
    const code = joinModal.meetingId.trim().replace(/\s/g, "");
    if (!code) return;
    setShowJoinModal(false);
    setJoinModal((prev) => ({ ...prev, meetingId: "" }));
    router.push(`/meeting/${code}`);
  }, [joinModal.meetingId, router]);

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/meeting/${code}`
    );
    setCopiedCode(code);
    showToast("Link Copied", `Meeting link for ${code} copied to clipboard.`, "success");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Clock formatters matching screenshot: "21:59", "Thursday, August 13, 2026"
  const timeDisplay = now
    ? now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "21:59";

  const dateDisplay = now
    ? now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Thursday, August 13, 2026";

  const formattedShortDate = now
    ? now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "Aug 13";

  return (
    <div className="relative w-full flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-56px)] bg-[#F4F5F7] py-8 px-6 select-none">
      
      {/* ── Top-Right Customization Star Button ──────────────────────── */}
      <button
        onClick={() => showToast("Theme & Customization", "Custom dashboard themes are queued for next release.", "coming-soon")}
        className="absolute top-4 right-6 p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        aria-label="Customize"
      >
        <Sparkles className="w-4.5 h-4.5" />
      </button>

      {/* ================================================================= */}
      {/* JOIN MEETING MODAL                                                 */}
      {/* ================================================================= */}
      {showJoinModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowJoinModal(false);
          }}
        >
          <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#131619]">
                Join meeting
              </h2>
              <button
                id="join-modal-close"
                onClick={() => setShowJoinModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#F4F5F7] text-[#6E7683] hover:text-[#131619] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input 1: Meeting ID */}
            <div>
              <label
                htmlFor="join-modal-meeting-id"
                className="block text-xs font-medium text-[#6E7683] mb-1.5"
              >
                Meeting ID or personal link name
              </label>
              <input
                id="join-modal-meeting-id"
                type="text"
                placeholder="e.g. 123-456-789"
                value={joinModal.meetingId}
                onChange={(e) =>
                  setJoinModal((prev) => ({
                    ...prev,
                    meetingId: e.target.value,
                  }))
                }
                onKeyDown={(e) => e.key === "Enter" && handleJoinMeeting()}
                autoFocus
                className="w-full h-10 px-3.5 text-sm rounded-xl border border-[#C8CBD0] focus:border-[#0E71EB] focus:ring-2 focus:ring-[#0E71EB]/15 transition-all outline-none bg-white text-[#131619]"
              />
            </div>

            {/* Input 2: Display Name */}
            <div>
              <label
                htmlFor="join-modal-display-name"
                className="block text-xs font-medium text-[#6E7683] mb-1.5"
              >
                Your name
              </label>
              <input
                id="join-modal-display-name"
                type="text"
                placeholder="Display name"
                value={joinModal.displayName}
                onChange={(e) =>
                  setJoinModal((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
                className="w-full h-10 px-3.5 text-sm rounded-xl border border-[#C8CBD0] focus:border-[#0E71EB] focus:ring-2 focus:ring-[#0E71EB]/15 transition-all outline-none bg-white text-[#131619]"
              />
            </div>

            <div className="h-px bg-[#E2E4E8]" />

            {/* Checkboxes */}
            <div className="flex flex-col gap-3">
              {(
                [
                  {
                    id: "cb-remember",
                    key: "rememberName" as const,
                    label: "Remember my name for future meetings",
                  },
                  {
                    id: "cb-no-audio",
                    key: "noAudio" as const,
                    label: "Don't connect to audio",
                  },
                  {
                    id: "cb-no-video",
                    key: "noVideo" as const,
                    label: "Turn off my video",
                  },
                ] as const
              ).map(({ id, key, label }) => (
                <label
                  key={id}
                  htmlFor={id}
                  className="flex items-center gap-3 cursor-pointer select-none"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={joinModal[key]}
                    onChange={(e) =>
                      setJoinModal((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="zoom-checkbox"
                  />
                  <span className="text-sm leading-tight text-[#131619]">
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="join-modal-cancel"
                onClick={() => setShowJoinModal(false)}
                className="h-9 px-4 text-sm font-medium rounded-xl border border-[#C8CBD0] text-[#131619] hover:bg-[#F4F5F7] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="join-modal-submit"
                onClick={handleJoinMeeting}
                disabled={!joinModal.meetingId.trim()}
                className="h-9 px-5 text-sm font-semibold rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#0E71EB] hover:bg-[#0B5EC4] cursor-pointer"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MAIN CONTAINER — Pixel-matched layout from screenshot             */}
      {/* ================================================================= */}
      <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto my-auto">
        
        {/* ── 1. LIVE CLOCK & DATE SECTION ─────────────────────── */}
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <h1 className="text-5xl font-bold text-[#131619] tracking-tight leading-none">
            {timeDisplay}
          </h1>
          <p className="text-sm text-[#6E7683] font-medium mt-2">
            {dateDisplay}
          </p>

          {/* User Welcome Pill */}
          {user && (
            <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0E71EB]/10 border border-[#0E71EB]/20 text-[#0E71EB] text-xs font-semibold animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-[#34C759]" />
              <span>Welcome back, {user.display_name}</span>
            </div>
          )}
        </div>

        {/* ── 2. 5-ICON QUICK ACTION ROW (Exact Squircle Design) ── */}
        <div className="flex items-center justify-center gap-7 mb-9">
          
          {/* New meeting — Orange #FF7426 */}
          <div className="flex flex-col items-center">
            <button
              id="action-new-meeting"
              onClick={handleNewMeeting}
              disabled={isCreating}
              className="w-14 h-14 rounded-[18px] flex items-center justify-center text-white shadow-xs bg-[#FF7426] hover:bg-[#E8651F] transition-all action-squircle action-squircle-orange disabled:opacity-60 cursor-pointer"
            >
              {isCreating ? (
                <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </button>
            <div
              className="flex items-center gap-1 mt-2 cursor-pointer hover:text-[#0E71EB] transition-colors"
              onClick={handleNewMeeting}
            >
              <span className="text-xs text-[#131619] font-medium">
                New meeting
              </span>
              <ChevronDown className="w-3 h-3 text-[#131619]" />
            </div>
          </div>

          {/* Join — Blue #0E71EB */}
          <div className="flex flex-col items-center">
            <button
              id="action-join"
              onClick={() => {
                setJoinModal((prev) => ({ ...prev, meetingId: "" }));
                setShowJoinModal(true);
              }}
              className="w-14 h-14 rounded-[18px] flex items-center justify-center text-white shadow-xs bg-[#0E71EB] hover:bg-[#0B5EC4] transition-all action-squircle cursor-pointer"
            >
              <Plus className="w-6 h-6 text-white stroke-[2.5]" />
            </button>
            <span className="text-xs text-[#131619] font-medium mt-2 text-center">
              Join
            </span>
          </div>

          {/* Schedule — Blue #0E71EB with 31 calendar icon */}
          <div className="flex flex-col items-center">
            <button
              id="action-schedule"
              onClick={() => router.push("/schedule")}
              className="w-14 h-14 rounded-[18px] flex items-center justify-center text-white shadow-xs bg-[#0E71EB] hover:bg-[#0B5EC4] transition-all action-squircle relative cursor-pointer"
            >
              <Calendar className="w-6 h-6 text-white" />
              <span className="absolute text-[8.5px] font-extrabold text-[#0E71EB] top-[24px]">
                31
              </span>
            </button>
            <span className="text-xs text-[#131619] font-medium mt-2 text-center">
              Schedule
            </span>
          </div>

          {/* Share screen — Blue #0E71EB with monitor icon */}
          <div className="flex flex-col items-center">
            <button
              id="action-share-screen"
              onClick={() => handleNewMeeting()}
              className="w-14 h-14 rounded-[18px] flex items-center justify-center text-white shadow-xs bg-[#0E71EB] hover:bg-[#0B5EC4] transition-all action-squircle cursor-pointer"
            >
              <Monitor className="w-6 h-6 text-white" />
            </button>
            <span className="text-xs text-[#131619] font-medium mt-2 text-center">
              Share screen
            </span>
          </div>

          {/* My Notes — Blue #0E71EB */}
          <div className="flex flex-col items-center">
            <button
              id="action-my-notes"
              onClick={() => showToast("Feature Coming Soon!", "My Notes module is queued for next release.", "coming-soon")}
              className="w-14 h-14 rounded-[18px] flex items-center justify-center text-white shadow-xs bg-[#0E71EB] hover:bg-[#0B5EC4] transition-all action-squircle cursor-pointer"
            >
              <PenLine className="w-5.5 h-5.5 text-white" />
            </button>
            <span className="text-xs text-[#131619] font-medium mt-2 text-center">
              My Notes
            </span>
          </div>
        </div>

        {/* ── 3. CALENDAR DISCONNECTED BANNER ──────────────────── */}
        {!bannerDismissed && (
          <div className="bg-[#F0F7FF] border border-[#D0E5FF] rounded-2xl p-4 flex items-center justify-between text-xs text-[#131619] w-full mb-6 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border border-[#0E71EB] flex items-center justify-center text-[#0E71EB] text-[11px] font-bold flex-shrink-0">
                i
              </div>
              <span className="text-[#333C4E] leading-relaxed text-[12px]">
                You haven&apos;t connected your calendar yet.{" "}
                <button
                  onClick={() => showToast("Calendar Sync", "Google & Outlook calendar sync queued for next release.", "coming-soon")}
                  className="text-[#0E71EB] hover:underline font-semibold cursor-pointer"
                >
                  Connect now
                </button>{" "}
                to manage all your meetings and events in one place.
              </span>
            </div>
            <button
              id="calendar-banner-close"
              aria-label="Dismiss calendar banner"
              onClick={() => setBannerDismissed(true)}
              className="p-1.5 rounded-lg hover:bg-[#D0E5FF]/50 text-[#6E7683] hover:text-[#131619] transition-colors flex-shrink-0 ml-3 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── 4. MAIN MEETINGS CARD BOX (Matched to Reference Image) ── */}
        <div className="bg-white rounded-2xl border border-[#E2E4E8] shadow-xs w-full overflow-hidden">
          
          {/* Card Top Header Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E4E8]">
            <button
              id="meetings-add-btn"
              aria-label="Add meeting"
              onClick={() => router.push("/schedule")}
              className="p-1.5 rounded-lg hover:bg-[#F4F5F7] text-[#6E7683] hover:text-[#131619] transition-colors cursor-pointer"
              title="Schedule a meeting"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => showToast("Date Filter", "Date range selector queued for next release.", "coming-soon")}
              className="flex items-center gap-1.5 font-bold text-sm text-[#131619] hover:text-[#0E71EB] transition-colors cursor-pointer"
            >
              <span>Today, {formattedShortDate}</span>
              <ChevronDown className="w-4 h-4 text-[#6E7683]" />
            </button>
            <div className="w-7" /> {/* spacer */}
          </div>

          {/* Sub-toolbar */}
          <div className="flex items-center justify-between px-5 py-2.5 bg-[#FAFBFD] border-b border-[#E2E4E8] text-xs">
            <div className="flex items-center gap-2.5">
              <button
                id="meetings-today-btn"
                onClick={() => showToast("Calendar Filter", "Filtering to Today", "info")}
                className="px-3 py-1 rounded-lg border border-[#E2E4E8] bg-white font-semibold text-[#131619] hover:bg-[#F4F5F7] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-xs"
              >
                <Calendar className="w-3.5 h-3.5 text-[#6E7683]" />
                <span>Today</span>
              </button>
              <div className="flex items-center text-[#6E7683] gap-1">
                <button
                  id="meetings-prev-day"
                  aria-label="Previous day"
                  onClick={() => showToast("Date Navigation", "Navigating dates", "info")}
                  className="p-1 rounded-lg hover:bg-[#EBECEF] hover:text-[#131619] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  id="meetings-next-day"
                  aria-label="Next day"
                  onClick={() => showToast("Date Navigation", "Navigating dates", "info")}
                  className="p-1 rounded-lg hover:bg-[#EBECEF] hover:text-[#131619] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button
              id="meetings-more-menu"
              aria-label="More options"
              onClick={() => showToast("Options", "Meeting list preferences queued for next release.", "coming-soon")}
              className="p-1.5 rounded-lg hover:bg-[#EBECEF] text-[#6E7683] hover:text-[#131619] transition-colors cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Card Body: Fully data-driven meeting list */}
          <div className="p-4 space-y-3">
            {loadingMeetings ? (
              // Skeleton loading state
              [0, 1].map((i) => (
                <div key={i} className="rounded-2xl p-4 border border-[#EBECEF] animate-pulse flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#E2E4E8] flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-[#E2E4E8] rounded w-2/5" />
                    <div className="h-3 bg-[#E2E4E8] rounded w-1/4" />
                  </div>
                </div>
              ))
            ) : !user ? (
              // ── Not signed in ────────────────────────────────────────────
              <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#EEF5FE] flex items-center justify-center">
                  <Video className="w-6 h-6 text-[#0E71EB]" />
                </div>
                <p className="text-sm font-semibold text-[#131619]">
                  Sign in to see your meetings
                </p>
                <p className="text-xs text-[#6E7683] max-w-[220px] leading-relaxed">
                  Your scheduled and recent meetings will appear here after you sign in.
                </p>
              </div>
            ) : upcomingMeetings.length === 0 && recentMeetings.length === 0 ? (
              // ── Signed in but no meetings ─────────────────────────────────
              <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F4F5F7] flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-[#6E7683]" />
                </div>
                <p className="text-sm font-semibold text-[#131619]">No meetings today</p>
                <p className="text-xs text-[#6E7683] max-w-[220px] leading-relaxed">
                  Schedule a meeting or start an instant one to get going.
                </p>
                <button
                  onClick={() => router.push("/schedule")}
                  className="mt-1 px-4 py-2 text-xs font-semibold text-[#0E71EB] rounded-xl border border-[#0E71EB]/30 hover:bg-[#EEF5FE] transition-colors cursor-pointer"
                >
                  + Schedule a meeting
                </button>
              </div>
            ) : (
              // ── Meeting rows ──────────────────────────────────────────────
              <>
                {/* Upcoming (scheduled) meetings */}
                {upcomingMeetings.map((m) => {
                  const dt = m.scheduled_at ? new Date(m.scheduled_at) : null;
                  const timeLabel = dt
                    ? dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
                    : "12:44";
                  const endMin = dt && m.duration_minutes
                    ? new Date(dt.getTime() + m.duration_minutes * 60000)
                        .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
                    : "12:47";
                  const dateLabel = dt
                    ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "Aug 13";
                  const isToday = dt
                    ? dt.toDateString() === new Date().toDateString()
                    : true;

                  const hostName = user?.display_name || "Aviral Goel";

                  return (
                    <div
                      key={`upcoming-${m.id}`}
                      className="bg-[#F8F9FA] rounded-2xl p-4 border border-[#EBECEF] flex items-center justify-between hover:bg-[#F1F3F5] transition-colors group shadow-2xs"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-white border border-[#E2E4E8] flex items-center justify-center text-[#0E71EB] shadow-2xs flex-shrink-0 mt-0.5">
                          <Video className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#131619] leading-tight">{m.title}</p>
                          <p className="text-xs text-[#6E7683] mt-1 font-medium leading-tight">
                            {isToday ? "Today" : dateLabel}, {formattedShortDate}
                          </p>
                          <p className="text-xs text-[#6E7683] mt-0.5 font-medium leading-tight">
                            {timeLabel} - {endMin}
                          </p>
                          <p className="text-[11.5px] text-[#6E7683] mt-0.5 font-normal">
                            Host: {hostName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyCode(m.meeting_code)}
                          className="p-1.5 rounded-md text-[#6E7683] hover:text-[#131619] cursor-pointer"
                          title="Copy meeting link"
                        >
                          {copiedCode === m.meeting_code
                            ? <Check className="w-4 h-4 text-[#34C759]" />
                            : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => router.push(`/meeting/${m.meeting_code}?host=true`)}
                          className="px-4 py-1.5 bg-[#0E71EB] hover:bg-[#0B5EC4] text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
                        >
                          Start
                        </button>
                        <button
                          aria-label="Meeting options"
                          onClick={() => showToast("Meeting Options", `Options for ${m.meeting_code}`, "info")}
                          className="p-1.5 rounded-lg hover:bg-[#E2E4E8] text-[#6E7683] hover:text-[#131619] transition-colors cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Recent (ended / active) meetings */}
                {recentMeetings.map((m) => {
                  const dt = m.created_at ? new Date(m.created_at) : null;
                  const dateLabel = dt
                    ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "Aug 13";
                  const isActive = m.status === "active";
                  const hostName = user?.display_name || "Aviral Goel";

                  return (
                    <div
                      key={`recent-${m.id}`}
                      className="bg-[#F8F9FA] rounded-2xl p-4 border border-[#EBECEF] flex items-center justify-between hover:bg-[#F1F3F5] transition-colors group shadow-2xs"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-white border border-[#E2E4E8] flex items-center justify-center text-[#6E7683] flex-shrink-0 mt-0.5">
                          <Video className="w-4.5 h-4.5 text-[#0E71EB]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#131619] leading-tight">{m.title}</p>
                            {isActive && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#34C759]/15 text-[#1D9E44]">LIVE</span>
                            )}
                          </div>
                          <p className="text-xs text-[#6E7683] mt-1 font-medium leading-tight">
                            Today, {dateLabel}
                          </p>
                          <p className="text-[11.5px] text-[#6E7683] mt-0.5 font-normal">
                            Host: {hostName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyCode(m.meeting_code)}
                          className="p-1.5 rounded-md text-[#6E7683] hover:text-[#131619] cursor-pointer"
                          title="Copy meeting link"
                        >
                          {copiedCode === m.meeting_code
                            ? <Check className="w-4 h-4 text-[#34C759]" />
                            : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => router.push(`/meeting/${m.meeting_code}`)}
                          className="px-4 py-1.5 bg-[#0E71EB] hover:bg-[#0B5EC4] text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
                        >
                          {isActive ? "Join" : "Start"}
                        </button>
                        <button
                          aria-label="Meeting options"
                          onClick={() => showToast("Meeting Options", `Options for ${m.meeting_code}`, "info")}
                          className="p-1.5 rounded-lg hover:bg-[#E2E4E8] text-[#6E7683] hover:text-[#131619] transition-colors cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Card Footer */}
          <div className="px-5 py-3 bg-white border-t border-[#E2E4E8] flex items-center justify-between text-xs">
            <button
              onClick={() => showToast("Feature Coming Soon!", "Meeting recordings module is queued for next release.", "coming-soon")}
              className="text-[#0E71EB] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              Open recordings &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
