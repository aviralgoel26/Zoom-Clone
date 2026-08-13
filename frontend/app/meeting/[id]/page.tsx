"use client";

/**
 * app/meeting/[id]/page.tsx
 * -------------------------
 * Two-phase page:
 *
 * Phase 1 — Pre-Join Lobby
 *   Shows camera/mic preview, display name input, and "Join Meeting" button.
 *   Validates meeting code against FastAPI before allowing entry.
 *
 *   HOST AUTHORIZATION (Point 4):
 *   The role selector ("host" / "participant" toggle buttons) has been
 *   COMPLETELY REMOVED. Role is derived solely from the URL query param:
 *     ?host=true  → role = "host"   (only the "New Meeting" dashboard button adds this)
 *     (absent)    → role = "participant" (everyone joining via a shared link)
 *   This eliminates all client-side role escalation vectors.
 *
 * Phase 2 — Live Meeting Room
 *   Renders VideoGrid, ControlsBar, ParticipantList, MeetingHealth.
 *   All WebRTC logic lives in the useWebRTC hook.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Copy,
  Check,
  ArrowRight,
  AlertCircle,
  Loader2,
  Shield,
  LayoutGrid,
  User,
  Users,
  Link2,
} from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import VideoGrid, { ViewMode } from "@/components/VideoGrid";
import ControlsBar from "@/components/ControlsBar";
import ParticipantList from "@/components/ParticipantList";
import ChatPanel from "@/components/ChatPanel";
import MeetingHealth from "@/components/MeetingHealth";
import {
  validateMeeting,
  joinMeeting,
  leaveMeeting,
  endMeeting,
  MeetingValidationResponse,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // The meeting code from the URL (e.g. "847-392-156")
  const meetingCode = (params.id as string) ?? "";

  /**
   * HOST AUTHORIZATION — URL-param-only role assignment.
   */
  const isHostFromQuery = searchParams.get("host") === "true";

  // ---------------------------------------------------------------------------
  // Phase management
  // ---------------------------------------------------------------------------
  const [phase, setPhase] = useState<"validating" | "lobby" | "meeting" | "error">(
    "validating"
  );
  const [meetingInfo, setMeetingInfo] = useState<MeetingValidationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // ---------------------------------------------------------------------------
  // Lobby state
  // ---------------------------------------------------------------------------
  const [displayName, setDisplayName] = useState(() => {
    return getStoredUser()?.display_name || "";
  });
  const role: "host" | "participant" = isHostFromQuery ? "host" : "participant";
  const [lobbyAudioOn, setLobbyAudioOn] = useState(true);
  const [lobbyVideoOn, setLobbyVideoOn] = useState(true);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);
  const lobbyStreamRef = useRef<MediaStream | null>(null);
  const [participantRecordId, setParticipantRecordId] = useState<number | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // ---------------------------------------------------------------------------
  // Meeting state
  // ---------------------------------------------------------------------------
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [stopIncomingVideo, setStopIncomingVideo] = useState(false);
  const [mutableRole, setMutableRole] = useState<"host" | "participant">(role);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [durationSecs, setDurationSecs] = useState(0);

  // Duration count-up timer
  useEffect(() => {
    if (phase !== "meeting") return;
    setDurationSecs(0);
    const id = setInterval(() => setDurationSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ---------------------------------------------------------------------------
  // Step 1: Validate meeting code on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (meetingCode) {
      document.title = `Conference ${meetingCode}`;
    }
    return () => {
      document.title = "Zoom Workplace — Web Conference App";
    };
  }, [meetingCode]);

  useEffect(() => {
    const validate = async () => {
      if (!meetingCode) {
        setErrorMessage("No meeting code provided.");
        setPhase("error");
        return;
      }
      try {
        const info = await validateMeeting(meetingCode);
        if (!info.valid) {
          setErrorMessage(`Meeting "${meetingCode}" not found. Check the code and try again.`);
          setPhase("error");
          return;
        }
        setMeetingInfo(info);
        setPhase("lobby");
      } catch {
        setErrorMessage("Could not reach the server. Is the backend running on port 8000?");
        setPhase("error");
      }
    };
    validate();
  }, [meetingCode]);

  // ---------------------------------------------------------------------------
  // Step 2: Lobby — start local camera preview
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "lobby") return;

    const startPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        lobbyStreamRef.current = stream;
        if (lobbyVideoRef.current) {
          lobbyVideoRef.current.srcObject = stream;
        }
      } catch {
        setLobbyVideoOn(false);
      }
    };
    startPreview();

    return () => {
      lobbyStreamRef.current?.getTracks().forEach((t) => t.stop());
      lobbyStreamRef.current = null;
    };
  }, [phase]);

  const toggleLobbyAudio = () => {
    lobbyStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setLobbyAudioOn((v) => !v);
  };

  const toggleLobbyVideo = () => {
    lobbyStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setLobbyVideoOn((v) => !v);
  };

  // ---------------------------------------------------------------------------
  // Step 3: Join
  // ---------------------------------------------------------------------------
  const handleJoin = async () => {
    if (!displayName.trim() || !meetingInfo?.meeting_id) return;
    setIsJoining(true);

    lobbyStreamRef.current?.getTracks().forEach((t) => t.stop());
    lobbyStreamRef.current = null;

    try {
      const p = await joinMeeting(
        meetingInfo.meeting_id,
        displayName.trim(),
        role
      );
      setParticipantRecordId(p.id);
    } catch {
      console.warn("Could not record participant in DB");
    }

    setPhase("meeting");
    setIsJoining(false);
  };

  // ---------------------------------------------------------------------------
  // Meeting Room — WebRTC hook
  // ---------------------------------------------------------------------------
  const {
    localStream,
    remotePeers,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    connectionState,
    toggleAudio,
    toggleVideo,
    leaveCall,
    muteAll,
    stopAllVideo,
    mutePeer,
    stopVideoPeer,
    makeHost,
    kickPeer,
    endMeetingForAll,
    shareScreen,
    stopShareScreen,
    messages,
    sendChatMessage,
    reactions,
    sendReaction,
    myPeerId,
  } = useWebRTC({
    meetingId: meetingCode,
    displayName: displayName || "Guest",
    role: mutableRole,
    onPeerCountChange: setPeerCount,
    onBecameHost: () => {
      setMutableRole("host");
    },
  });

  const isInMeeting = phase === "meeting";

  // ---------------------------------------------------------------------------
  // Leave / End handlers
  // ---------------------------------------------------------------------------
  const handleLeave = useCallback(async () => {
    leaveCall();

    if (participantRecordId && meetingInfo?.meeting_id) {
      try {
        await leaveMeeting(meetingInfo.meeting_id, participantRecordId);
      } catch {
        console.warn("Could not update leave record");
      }
    }

    router.push("/");
  }, [leaveCall, participantRecordId, meetingInfo, router]);

  const handleEndMeetingForAll = useCallback(async () => {
    endMeetingForAll();
    leaveCall();

    if (meetingInfo?.meeting_id) {
      try {
        if (participantRecordId) {
          await leaveMeeting(meetingInfo.meeting_id, participantRecordId);
        }
        await endMeeting(meetingInfo.meeting_id);
      } catch {
        console.warn("Could not update end meeting status in DB");
      }
    }

    router.push("/?meetingEnded=true");
  }, [endMeetingForAll, leaveCall, participantRecordId, meetingInfo, router]);

  const handleCopyLink = async () => {
    const cleanUrl = window.location.origin + window.location.pathname;
    await navigator.clipboard.writeText(cleanUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareScreen = async () => {
    if (isScreenSharing) {
      stopShareScreen();
    } else {
      await shareScreen();
    }
  };

  // ---------------------------------------------------------------------------
  // Render: Validating
  // ---------------------------------------------------------------------------
  if (phase === "validating") {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0E72ED] to-[#5B5FDE] flex items-center justify-center shadow-lg shadow-[#0E72ED]/30">
              <Video className="w-7 h-7 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#0A0A0F] rounded-full flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-[#0E72ED] animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-sm">Verifying meeting</p>
            <p className="text-[#6E6E7A] text-xs mt-0.5 font-mono">{meetingCode}</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error
  // ---------------------------------------------------------------------------
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <div
          className="max-w-md w-full text-center rounded-3xl p-8 border border-white/10"
          style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)" }}
        >
          <div className="w-16 h-16 rounded-full bg-[#FF3B30]/10 border border-[#FF3B30]/20 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-[#FF3B30]" />
          </div>
          <h2 className="text-white font-bold text-xl mb-2">Meeting Not Found</h2>
          <p className="text-[#8E8E93] text-sm mb-7 leading-relaxed">{errorMessage}</p>
          <button
            id="error-back-home"
            onClick={() => router.push("/")}
            className="bg-gradient-to-r from-[#0E72ED] to-[#5B5FDE] hover:opacity-90 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-all shadow-lg shadow-[#0E72ED]/30 cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Lobby (Pre-Join) — PREMIUM REDESIGN
  // ---------------------------------------------------------------------------
  if (phase === "lobby") {
    const initial = (displayName || "?").charAt(0).toUpperCase();

    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0A0A0F 0%, #0D1117 50%, #0A0F1E 100%)" }}
      >
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, #0E72ED 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-8 pointer-events-none"
          style={{ background: "radial-gradient(circle, #5B5FDE 0%, transparent 70%)", filter: "blur(80px)" }} />

        <div className="relative z-10 w-full max-w-4xl">
          {/* Top label */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
            <span className="text-[#8E8EA0] text-sm font-medium">Ready to join</span>
          </div>

          <div
            className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)" }}
          >
            <div className="grid md:grid-cols-[1.1fr_0.9fr]">

              {/* ── Left: Camera Preview ──────────────────────────── */}
              <div className="relative bg-[#080810] flex items-center justify-center overflow-hidden min-h-[300px] md:min-h-[420px]">
                {lobbyVideoOn ? (
                  <video
                    ref={lobbyVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-2xl"
                      style={{ background: "linear-gradient(135deg, #0E72ED, #5B5FDE)" }}>
                      {initial}
                    </div>
                    <p className="text-[#6E6E7A] text-sm">Camera is off</p>
                  </div>
                )}

                {/* Gradient vignette overlay */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(to top, rgba(8,8,16,0.8) 0%, transparent 50%)" }} />

                {/* Preview controls — bottom center */}
                <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-3 z-10">
                  <button
                    id="lobby-toggle-audio"
                    onClick={toggleLobbyAudio}
                    title={lobbyAudioOn ? "Mute" : "Unmute"}
                    className={`group relative flex flex-col items-center gap-1 cursor-pointer`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      lobbyAudioOn
                        ? "bg-white/15 hover:bg-white/25 border border-white/20 text-white backdrop-blur-md"
                        : "bg-[#FF3B30] hover:bg-[#E0321A] text-white"
                    }`}>
                      {lobbyAudioOn ? <Mic className="w-4.5 h-4.5" /> : <MicOff className="w-4.5 h-4.5" />}
                    </div>
                    <span className="text-[10px] text-white/60 font-medium">
                      {lobbyAudioOn ? "Mute" : "Unmuted"}
                    </span>
                  </button>

                  <button
                    id="lobby-toggle-video"
                    onClick={toggleLobbyVideo}
                    title={lobbyVideoOn ? "Stop video" : "Start video"}
                    className="group relative flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      lobbyVideoOn
                        ? "bg-white/15 hover:bg-white/25 border border-white/20 text-white backdrop-blur-md"
                        : "bg-[#FF3B30] hover:bg-[#E0321A] text-white"
                    }`}>
                      {lobbyVideoOn ? <Video className="w-4.5 h-4.5" /> : <VideoOff className="w-4.5 h-4.5" />}
                    </div>
                    <span className="text-[10px] text-white/60 font-medium">
                      {lobbyVideoOn ? "Stop" : "Start"}
                    </span>
                  </button>
                </div>
              </div>

              {/* ── Right: Join Form ──────────────────────────────── */}
              <div className="p-8 flex flex-col justify-center gap-6">

                {/* Meeting info */}
                <div>
                  <h1 className="text-white font-bold text-2xl leading-tight">
                    {meetingInfo?.title ?? "Join Meeting"}
                  </h1>

                  {/* Meeting code + copy */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[#6E6E7A] text-sm font-mono tracking-wider">
                      {meetingCode}
                    </span>
                    <button
                      id="lobby-copy-link"
                      onClick={handleCopyLink}
                      className="flex items-center gap-1 text-xs text-[#0E72ED] hover:text-[#4A9EF7] transition-colors cursor-pointer"
                      title="Copy invite link"
                    >
                      {linkCopied ? (
                        <><Check className="w-3.5 h-3.5 text-[#34C759]" /><span className="text-[#34C759]">Copied!</span></>
                      ) : (
                        <><Link2 className="w-3.5 h-3.5" /><span>Copy link</span></>
                      )}
                    </button>
                  </div>

                  {/* Role badge */}
                  {isHostFromQuery && (
                    <div className="inline-flex items-center gap-1.5 mt-3 bg-[#FF9500]/10 border border-[#FF9500]/20 text-[#FF9500] px-3 py-1 rounded-full">
                      <Shield className="w-3 h-3" />
                      <span className="text-xs font-semibold">You are the Host</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-white/8" />

                {/* Display name input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="lobby-display-name"
                    className="block text-[#A0A0B8] text-xs font-semibold uppercase tracking-wider"
                  >
                    Your display name
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8EA0] pointer-events-none z-10" />
                    <input
                      id="lobby-display-name"
                      type="text"
                      placeholder="Enter your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                      autoComplete="off"
                      spellCheck={false}
                      autoFocus
                      className="w-full pr-4 py-3 rounded-xl text-sm text-white placeholder-[#6E6E8A] outline-none transition-all border"
                      style={{
                        paddingLeft: "42px",
                        background: "rgba(255,255,255,0.06)",
                        borderColor: displayName ? "rgba(14,114,237,0.6)" : "rgba(255,255,255,0.12)",
                        boxShadow: displayName ? "0 0 0 3px rgba(14,114,237,0.12)" : "none",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "rgba(14,114,237,0.6)";
                        e.target.style.boxShadow = "0 0 0 3px rgba(14,114,237,0.12)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = displayName ? "rgba(14,114,237,0.6)" : "rgba(255,255,255,0.12)";
                        e.target.style.boxShadow = displayName ? "0 0 0 3px rgba(14,114,237,0.12)" : "none";
                      }}
                    />
                  </div>
                </div>

                {/* Audio/Video status pills */}
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                    lobbyAudioOn
                      ? "bg-[#34C759]/10 border-[#34C759]/20 text-[#34C759]"
                      : "bg-[#FF3B30]/10 border-[#FF3B30]/20 text-[#FF3B30]"
                  }`}>
                    {lobbyAudioOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                    {lobbyAudioOn ? "Audio on" : "Muted"}
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                    lobbyVideoOn
                      ? "bg-[#34C759]/10 border-[#34C759]/20 text-[#34C759]"
                      : "bg-[#FF3B30]/10 border-[#FF3B30]/20 text-[#FF3B30]"
                  }`}>
                    {lobbyVideoOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                    {lobbyVideoOn ? "Video on" : "Video off"}
                  </div>
                </div>

                {/* Join button */}
                <button
                  id="lobby-join-btn"
                  onClick={handleJoin}
                  disabled={!displayName.trim() || isJoining}
                  className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden group"
                  style={{
                    background: displayName.trim()
                      ? "linear-gradient(135deg, #0E72ED 0%, #1A7FF0 50%, #5B5FDE 100%)"
                      : "rgba(255,255,255,0.08)",
                    boxShadow: displayName.trim() ? "0 8px 32px rgba(14,114,237,0.4)" : "none",
                  }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "linear-gradient(135deg, #1A7FF0 0%, #0E72ED 50%, #5B5FDE 100%)" }} />
                  <span className="relative z-10 flex items-center gap-2">
                    {isJoining ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    {isJoining ? "Joining..." : "Join Meeting"}
                  </span>
                </button>

                <p className="text-[#4A4A5A] text-xs text-center leading-relaxed">
                  {isHostFromQuery
                    ? "You created this meeting and will join as Host"
                    : "You will join as a participant"}
                </p>
              </div>

            </div>
          </div>

          {/* Participant count hint */}
          <div className="flex items-center justify-center gap-2 mt-5 text-[#4A4A5A] text-xs">
            <Users className="w-3.5 h-3.5" />
            <span>Others can join using the meeting code above</span>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Live Meeting Room
  // ---------------------------------------------------------------------------
  return (
    <div className="h-screen bg-[#131314] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1C1C1E] border-b border-[#2C2C2E] z-20">
        {/* Left: meeting info */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
          <div>
            <p className="text-white text-sm font-medium">
              {meetingInfo?.title ?? "Meeting"}
            </p>
            <p className="text-[#8E8E93] text-xs font-mono">{meetingCode}</p>
          </div>
        </div>

        {/* Center: duration timer */}
        <div className="flex items-center gap-3">
          <MeetingHealth connectionState={connectionState} />
          <span className="text-[#8E8E93] text-sm font-mono tabular-nums">
            {formatDuration(durationSecs)}
          </span>
        </div>

        {/* Right: view mode toggle + clock */}
        <div className="flex items-center gap-2">
          <button
            id="view-mode-toggle"
            onClick={() => setViewMode((v) => v === "grid" ? "speaker" : "grid")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#EBEBF5] text-xs font-medium transition-colors cursor-pointer"
            title={viewMode === "grid" ? "Switch to Speaker View" : "Switch to Grid View"}
          >
            {viewMode === "grid" ? (
              <><User className="w-3.5 h-3.5" /> Speaker View</>
            ) : (
              <><LayoutGrid className="w-3.5 h-3.5" /> Grid View</>
            )}
          </button>
          <LiveClock />
        </div>
      </div>

      {/* Video area + optional side panel */}
      <div className="flex-1 flex overflow-hidden">
        <div
          className={`flex-1 overflow-hidden transition-all duration-300 ${
            showParticipants ? "mr-72" : ""
          }`}
        >
          {isInMeeting && (
            <VideoGrid
              localStream={localStream}
              localDisplayName={displayName}
              localIsMuted={isAudioMuted}
              localIsVideoOff={isVideoOff}
              isLocalHost={mutableRole === "host"}
              remotePeers={remotePeers}
              stopIncomingVideo={stopIncomingVideo}
              reactions={reactions}
              localPeerId={myPeerId}
              viewMode={viewMode}
            />
          )}
        </div>

        {/* Participant side panel */}
        {showParticipants && (
          <ParticipantList
            localParticipant={{
              displayName,
              isMuted: isAudioMuted,
              isVideoOff,
              role: mutableRole,
            }}
            remotePeers={remotePeers}
            isHost={mutableRole === "host"}
            onMuteAll={muteAll}
            onStopAllVideo={stopAllVideo}
            onKick={kickPeer}
            onMutePeer={mutePeer}
            onStopVideoPeer={stopVideoPeer}
            onMakeHost={makeHost}
            onClose={() => setShowParticipants(false)}
          />
        )}

        {/* Chat side panel */}
        {showChat && (
          <ChatPanel
            messages={messages}
            onSendMessage={sendChatMessage}
            onClose={() => setShowChat(false)}
            localDisplayName={displayName}
          />
        )}
      </div>

      {/* Bottom controls */}
      {isInMeeting && (
        <ControlsBar
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          isHost={mutableRole === "host"}
          participantCount={1 + remotePeers.length}
          isScreenSharing={isScreenSharing}
          stopIncomingVideo={stopIncomingVideo}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleParticipants={() => {
            setShowParticipants((v) => !v);
            setShowChat(false);
          }}
          onShareScreen={handleShareScreen}
          onToggleStopIncomingVideo={() => setStopIncomingVideo((v) => !v)}
          onLeave={handleLeave}
          onEndMeetingForAll={handleEndMeetingForAll}
          showParticipants={showParticipants}
          showChat={showChat}
          onToggleChat={() => {
            setShowChat((v) => !v);
            setShowParticipants(false);
          }}
          onSendReaction={sendReaction}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// formatDuration — converts total seconds → "HH:MM:SS" or "MM:SS"
// ---------------------------------------------------------------------------
function formatDuration(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// ---------------------------------------------------------------------------
// LiveClock — updates every second
// ---------------------------------------------------------------------------
function LiveClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className="text-[#8E8E93] text-sm font-mono">{time}</span>;
}
