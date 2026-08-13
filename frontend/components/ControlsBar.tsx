"use client";

/**
 * ControlsBar.tsx
 * ---------------
 * Bottom floating toolbar for the in-meeting dark UI.
 * Matches Zoom Workplace Desktop v7.1.5 Screenshot 6.
 *
 * Controls (left → right):
 *  🎤 Mute/Unmute       — toggles local audio track (with chevron)
 *  📹 Start/Stop Video  — toggles local video track (with chevron)
 *  |  divider
 *  👥 Participants      — toggles participant side panel (count badge)
 *  💬 Chat              — toggles chat panel
 *  😀 React             — emoji reactions (placeholder popover)
 *  🟢 Share Screen      — getDisplayMedia() screen share (bright green when active)
 *  🔧 Host Tools        — host-only options popover
 *  ⋯  More              — floating popover with additional options
 *  🔗 Copy Link         — copies meeting URL to clipboard
 *  |  divider
 *  🚪 Leave / End       — leaves (participant) or ends (host) meeting
 *
 * MORE POPOVER ITEMS:
 *  - Breakout Rooms   (placeholder)
 *  - Whiteboards      (placeholder)
 *  - Settings         (placeholder)
 *  - Stop Incoming Video (toggle — low-bandwidth mode)
 *  - Reset Toolbar    (no-op, future feature)
 */

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  Link,
  PhoneOff,
  Check,
  MoreHorizontal,
  Monitor,
  Layout,
  Settings,
  EyeOff,
  RotateCcw,
  X,
  MessageSquare,
  Smile,
  Wrench,
  ChevronUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ControlsBarProps {
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isHost: boolean;
  participantCount: number;
  isScreenSharing: boolean;
  stopIncomingVideo: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleParticipants: () => void;
  onShareScreen: () => void;
  onToggleStopIncomingVideo: () => void;
  onLeave: () => void;
  onEndMeetingForAll?: () => void;
  showParticipants: boolean;
  showChat?: boolean;
  onToggleChat?: () => void;
}

// ---------------------------------------------------------------------------
// Main ControlsBar
// ---------------------------------------------------------------------------
export default function ControlsBar({
  isAudioMuted,
  isVideoOff,
  isHost,
  participantCount,
  isScreenSharing,
  stopIncomingVideo,
  onToggleAudio,
  onToggleVideo,
  onToggleParticipants,
  onShareScreen,
  onToggleStopIncomingVideo,
  onLeave,
  onEndMeetingForAll,
  showParticipants,
  showChat = false,
  onToggleChat,
}: ControlsBarProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReactMenu, setShowReactMenu] = useState(false);
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const moreMenuRef   = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const reactMenuRef  = useRef<HTMLDivElement>(null);
  const reactBtnRef   = useRef<HTMLButtonElement>(null);
  const hostMenuRef   = useRef<HTMLDivElement>(null);
  const hostBtnRef    = useRef<HTMLButtonElement>(null);
  const leaveModalRef = useRef<HTMLDivElement>(null);
  const leaveBtnRef   = useRef<HTMLButtonElement>(null);

  const handleCopyLink = async () => {
    // Copy direct participant URL without ?host=true
    const cleanUrl = window.location.origin + window.location.pathname;
    await navigator.clipboard.writeText(cleanUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Close any popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(e.target as Node)
      ) {
        setShowMoreMenu(false);
      }
      if (
        reactMenuRef.current &&
        !reactMenuRef.current.contains(e.target as Node) &&
        reactBtnRef.current &&
        !reactBtnRef.current.contains(e.target as Node)
      ) {
        setShowReactMenu(false);
      }
      if (
        hostMenuRef.current &&
        !hostMenuRef.current.contains(e.target as Node) &&
        hostBtnRef.current &&
        !hostBtnRef.current.contains(e.target as Node)
      ) {
        setShowHostMenu(false);
      }
      if (
        leaveModalRef.current &&
        !leaveModalRef.current.contains(e.target as Node) &&
        leaveBtnRef.current &&
        !leaveBtnRef.current.contains(e.target as Node)
      ) {
        setShowLeaveModal(false);
      }
    };

    if (showMoreMenu || showReactMenu || showHostMenu || showLeaveModal) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu, showReactMenu, showHostMenu, showLeaveModal]);

  return (
    <div className="fixed bottom-0 left-0 right-0 flex items-center justify-center pb-5 z-40 pointer-events-none">
      <div className="pointer-events-auto relative flex items-center gap-1 bg-[#1C1C1E]/95 backdrop-blur-xl border border-[#2C2C2E] rounded-2xl px-3 py-2.5 shadow-2xl">

        {/* ── Audio toggle (with chevron) ───────────────────── */}
        <ControlButtonWithChevron
          id="ctrl-audio"
          icon={isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          label={isAudioMuted ? "Unmute" : "Mute"}
          active={isAudioMuted}
          activeColor="red"
          onClick={onToggleAudio}
          onChevronClick={() => {}}
        />

        {/* ── Video toggle (with chevron) ───────────────────── */}
        <ControlButtonWithChevron
          id="ctrl-video"
          icon={isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          label={isVideoOff ? "Start Video" : "Stop Video"}
          active={isVideoOff}
          activeColor="red"
          onClick={onToggleVideo}
          onChevronClick={() => {}}
        />

        <Divider />

        {/* ── Participants ──────────────────────────────────── */}
        <ControlButton
          id="ctrl-participants"
          icon={
            <div className="relative">
              <Users className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 bg-[#0E71EB] text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                {participantCount > 9 ? "9+" : participantCount}
              </span>
            </div>
          }
          label="Participants"
          active={showParticipants}
          activeColor="blue"
          onClick={onToggleParticipants}
        />

        {/* ── Chat ─────────────────────────────────────────── */}
        <ControlButton
          id="ctrl-chat"
          icon={<MessageSquare className="w-5 h-5" />}
          label="Chat"
          active={showChat}
          activeColor="blue"
          onClick={() => {
            if (onToggleChat) {
              onToggleChat();
            }
          }}
        />

        {/* ── React (Emoji) — with popover ─────────────────── */}
        <div className="relative">
          <button
            ref={reactBtnRef}
            id="ctrl-react"
            onClick={() => {
              setShowReactMenu((v) => !v);
              setShowMoreMenu(false);
              setShowHostMenu(false);
            }}
            className={`
              flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl
              transition-all duration-200 min-w-[50px]
              ${showReactMenu
                ? "bg-[#0E71EB]/20 text-[#0E71EB]"
                : "text-[#EBEBF5] hover:bg-[#2C2C2E]"
              }
            `}
          >
            <Smile className="w-5 h-5" />
            <span className="text-[10px] font-medium">React</span>
          </button>

          {showReactMenu && (
            <div
              ref={reactMenuRef}
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl shadow-2xl p-3 z-50"
            >
              <div className="flex gap-2">
                {["👍", "❤️", "😂", "😮", "👏", "🎉"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setShowReactMenu(false);
                      // Placeholder: emoji reaction broadcast
                    }}
                    className="text-xl hover:scale-125 transition-transform p-1 rounded-lg hover:bg-[#3A3A3C]"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Share Screen ──────────────────────────────────── */}
        <ControlButton
          id="ctrl-share-screen"
          icon={<Monitor className="w-5 h-5" />}
          label={isScreenSharing ? "Stop Share" : "Share"}
          active={isScreenSharing}
          activeColor="green"
          onClick={onShareScreen}
        />

        {/* ── Host Tools (host only) ────────────────────────── */}
        {isHost && (
          <div className="relative">
            <button
              ref={hostBtnRef}
              id="ctrl-host-tools"
              onClick={() => {
                setShowHostMenu((v) => !v);
                setShowMoreMenu(false);
                setShowReactMenu(false);
              }}
              className={`
                flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl
                transition-all duration-200 min-w-[50px]
                ${showHostMenu
                  ? "bg-[#0E71EB]/20 text-[#0E71EB]"
                  : "text-[#EBEBF5] hover:bg-[#2C2C2E]"
                }
              `}
            >
              <Wrench className="w-5 h-5" />
              <span className="text-[10px] font-medium">Host Tools</span>
            </button>

            {showHostMenu && (
              <div
                ref={hostMenuRef}
                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-52 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="px-4 py-2.5 border-b border-[#3A3A3C] flex items-center justify-between">
                  <span className="text-[#8E8E93] text-xs font-medium">Host Tools</span>
                  <button
                    onClick={() => setShowHostMenu(false)}
                    className="text-[#8E8E93] hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <MoreMenuItem
                  id="host-mute-all"
                  icon={<MicOff className="w-4 h-4" />}
                  label="Mute All"
                  description="Mute all participants"
                  onClick={() => {
                    setShowHostMenu(false);
                    alert("Mute All — coming soon!");
                  }}
                />
                <MoreMenuItem
                  id="host-lock-meeting"
                  icon={<Settings className="w-4 h-4" />}
                  label="Lock Meeting"
                  description="Prevent new participants"
                  onClick={() => {
                    setShowHostMenu(false);
                    alert("Lock Meeting — coming soon!");
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── More options ──────────────────────────────────── */}
        <div className="relative">
          <button
            ref={moreButtonRef}
            id="ctrl-more"
            onClick={() => {
              setShowMoreMenu((v) => !v);
              setShowReactMenu(false);
              setShowHostMenu(false);
            }}
            className={`
              flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl
              transition-all duration-200 min-w-[50px]
              ${showMoreMenu
                ? "bg-[#0E71EB]/20 text-[#0E71EB]"
                : "text-[#EBEBF5] hover:bg-[#2C2C2E]"
              }
            `}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>

          {/* More popover */}
          {showMoreMenu && (
            <div
              ref={moreMenuRef}
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-56 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#3A3A3C]">
                <span className="text-[#8E8E93] text-xs font-medium">More Options</span>
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="text-[#8E8E93] hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <MoreMenuItem
                id="more-breakout-rooms"
                icon={<Layout className="w-4 h-4" />}
                label="Breakout Rooms"
                description="Split into smaller groups"
                onClick={() => {
                  setShowMoreMenu(false);
                  alert("Breakout Rooms — coming soon!");
                }}
              />

              <MoreMenuItem
                id="more-whiteboards"
                icon={
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                    <path d="M7 10l3 3 4-4" />
                  </svg>
                }
                label="Whiteboards"
                description="Collaborate on a shared canvas"
                onClick={() => {
                  setShowMoreMenu(false);
                  alert("Whiteboards — coming soon!");
                }}
              />

              <MoreMenuItem
                id="more-settings"
                icon={<Settings className="w-4 h-4" />}
                label="Settings"
                description="Audio, video & notifications"
                onClick={() => {
                  setShowMoreMenu(false);
                  alert("Settings — coming soon!");
                }}
              />

              <div className="h-px bg-[#3A3A3C] mx-3" />

              <MoreMenuItem
                id="more-stop-incoming-video"
                icon={<EyeOff className="w-4 h-4" />}
                label="Stop Incoming Video"
                description={
                  stopIncomingVideo
                    ? "Remote feeds hidden"
                    : "Hide remote video feeds"
                }
                active={stopIncomingVideo}
                onClick={() => onToggleStopIncomingVideo()}
              />

              <MoreMenuItem
                id="more-reset-toolbar"
                icon={<RotateCcw className="w-4 h-4" />}
                label="Reset Toolbar Order"
                description="Restore default layout"
                onClick={() => setShowMoreMenu(false)}
              />
            </div>
          )}
        </div>

        {/* ── Copy invite link ──────────────────────────────── */}
        <ControlButton
          id="ctrl-copy-link"
          icon={
            linkCopied ? (
              <Check className="w-5 h-5 text-[#34C759]" />
            ) : (
              <Link className="w-5 h-5" />
            )
          }
          label={linkCopied ? "Copied!" : "Copy Link"}
          onClick={handleCopyLink}
        />

        <Divider />

        {/* ── Leave / End button (with options popover) ─────── */}
        <div className="relative">
          <button
            ref={leaveBtnRef}
            id="ctrl-leave"
            onClick={() => {
              setShowLeaveModal((v) => !v);
              setShowMoreMenu(false);
              setShowReactMenu(false);
              setShowHostMenu(false);
            }}
            className={`
              flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl
              transition-all duration-200 cursor-pointer
              ${isHost
                ? "bg-[#E02828] hover:bg-[#F03030] text-white font-medium"
                : "bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30]"
              }
            `}
          >
            <PhoneOff className="w-5 h-5" />
            <span className="text-[10px] font-medium">
              {isHost ? "End" : "Leave"}
            </span>
          </button>

          {/* Host / Participant Leave Options Popover (Matches Screenshot 2) */}
          {showLeaveModal && (
            <div
              ref={leaveModalRef}
              className="absolute bottom-full mb-3 right-0 w-64 bg-[#222225] border border-[#3A3A3C] rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              {isHost ? (
                <div className="flex flex-col gap-2">
                  <button
                    id="btn-end-meeting-for-all"
                    onClick={() => {
                      setShowLeaveModal(false);
                      if (onEndMeetingForAll) {
                        onEndMeetingForAll();
                      } else {
                        onLeave();
                      }
                    }}
                    className="w-full bg-[#E02828] hover:bg-[#C92222] text-white font-medium text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs cursor-pointer text-center"
                  >
                    End meeting for all
                  </button>

                  <button
                    id="btn-leave-meeting-host"
                    onClick={() => {
                      setShowLeaveModal(false);
                      onLeave();
                    }}
                    className="w-full bg-[#3A3A3C] hover:bg-[#48484A] text-white font-medium text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer text-center"
                  >
                    Leave meeting
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    id="btn-leave-meeting-participant"
                    onClick={() => {
                      setShowLeaveModal(false);
                      onLeave();
                    }}
                    className="w-full bg-[#E02828] hover:bg-[#C92222] text-white font-medium text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs cursor-pointer text-center"
                  >
                    Leave meeting
                  </button>
                </div>
              )}

              {/* Bottom footer options */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#3A3A3C]/60 px-1">
                <label className="flex items-center gap-1.5 text-[10px] text-[#8E8E93] cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-[#48484A] bg-[#1C1C1E] text-[#0E71EB] w-3 h-3 focus:ring-0"
                  />
                  <span>Give feedback</span>
                </label>
                <button
                  id="btn-cancel-leave"
                  onClick={() => setShowLeaveModal(false)}
                  className="text-[11px] text-[#8E8E93] hover:text-white font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper — Divider
// ---------------------------------------------------------------------------
function Divider() {
  return <div className="w-px h-8 bg-[#2C2C2E] mx-1 flex-shrink-0" />;
}

// ---------------------------------------------------------------------------
// Helper — Control button (no chevron)
// ---------------------------------------------------------------------------
interface ControlButtonProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  activeColor?: "red" | "blue" | "green";
  onClick: () => void;
}

function ControlButton({
  id,
  icon,
  label,
  active = false,
  activeColor = "blue",
  onClick,
}: ControlButtonProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`
        flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl
        transition-all duration-200 min-w-[50px]
        ${
          active && activeColor === "red"
            ? "bg-[#FF3B30]/20 text-[#FF3B30]"
            : active && activeColor === "blue"
            ? "bg-[#0E71EB]/20 text-[#0E71EB]"
            : active && activeColor === "green"
            ? "bg-[#34C759]/20 text-[#34C759]"
            : "text-[#EBEBF5] hover:bg-[#2C2C2E]"
        }
      `}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helper — Control button WITH chevron (Mic, Video)
// ---------------------------------------------------------------------------
interface ControlButtonWithChevronProps extends ControlButtonProps {
  onChevronClick: () => void;
}

function ControlButtonWithChevron({
  id,
  icon,
  label,
  active = false,
  activeColor = "blue",
  onClick,
  onChevronClick,
}: ControlButtonWithChevronProps) {
  const activeClass =
    active && activeColor === "red"
      ? "bg-[#FF3B30]/20 text-[#FF3B30]"
      : active && activeColor === "blue"
      ? "bg-[#0E71EB]/20 text-[#0E71EB]"
      : active && activeColor === "green"
      ? "bg-[#34C759]/20 text-[#34C759]"
      : "text-[#EBEBF5]";

  return (
    <div className={`flex items-stretch rounded-xl overflow-hidden ${active ? activeClass : "hover:bg-[#2C2C2E]"} transition-all duration-200`}>
      {/* Main button */}
      <button
        id={id}
        onClick={onClick}
        className={`flex flex-col items-center gap-0.5 pl-3 pr-2 py-2 min-w-[42px] ${activeClass}`}
      >
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </button>
      {/* Chevron button */}
      <button
        id={`${id}-chevron`}
        onClick={onChevronClick}
        className={`flex items-center justify-center pr-1.5 pl-0.5 ${activeClass} hover:bg-[#3A3A3C]/60 transition-colors`}
        aria-label={`${label} options`}
      >
        <ChevronUp className="w-3 h-3 opacity-60" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper — More popover menu item
// ---------------------------------------------------------------------------
interface MoreMenuItemProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  active?: boolean;
  onClick: () => void;
}

function MoreMenuItem({
  id,
  icon,
  label,
  description,
  active = false,
  onClick,
}: MoreMenuItemProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3
        hover:bg-[#3A3A3C] transition-colors text-left group
        ${active ? "text-[#34C759]" : "text-white"}
      `}
    >
      <span
        className={`flex-shrink-0 transition-colors ${
          active
            ? "text-[#34C759]"
            : "text-[#8E8E93] group-hover:text-white"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        <p className="text-[#8E8E93] text-xs mt-0.5 leading-tight truncate">
          {description}
        </p>
      </div>
      {active && (
        <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-[#34C759]" />
      )}
    </button>
  );
}
