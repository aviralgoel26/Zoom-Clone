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
} from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import VideoGrid from "@/components/VideoGrid";
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

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // The meeting code from the URL (e.g. "847-392-156")
  const meetingCode = (params.id as string) ?? "";

  /**
   * HOST AUTHORIZATION — URL-param-only role assignment.
   *
   * ?host=true is appended ONLY by handleNewMeeting() on the dashboard.
   * Anyone joining via a shared link, Meeting ID input, or the meetings list
   * "Start" button does NOT get this param and enters as participant.
   *
   * The UI role selector has been removed — there is no way for a participant
   * to self-elevate to host through the client.
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
  const [displayName, setDisplayName] = useState("");
  /**
   * Role is read-only after derivation — no setter exposed.
   * isHostFromQuery is true only when ?host=true is in the URL.
   */
  const role: "host" | "participant" = isHostFromQuery ? "host" : "participant";
  const [lobbyAudioOn, setLobbyAudioOn] = useState(true);
  const [lobbyVideoOn, setLobbyVideoOn] = useState(true);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);
  const lobbyStreamRef = useRef<MediaStream | null>(null);
  const [participantRecordId, setParticipantRecordId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Meeting state
  // ---------------------------------------------------------------------------
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  /** Low-bandwidth mode — hide all remote video feeds locally */
  const [stopIncomingVideo, setStopIncomingVideo] = useState(false);
  /**
   * mutableRole tracks host status in case "Make Host" is received mid-meeting.
   * Starts as the URL-derived role; can be elevated by a host-action: make-host WS event.
   */
  const [mutableRole, setMutableRole] = useState<"host" | "participant">(role);

  // ---------------------------------------------------------------------------
  // Step 1: Validate meeting code on mount
  // ---------------------------------------------------------------------------
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

    // Cleanup lobby stream when leaving lobby phase
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
  // Step 3: Join — stop lobby stream, record participant, enter meeting phase
  // ---------------------------------------------------------------------------
  const handleJoin = async () => {
    if (!displayName.trim() || !meetingInfo?.meeting_id) return;

    // Stop lobby preview stream — useWebRTC will acquire fresh streams
    lobbyStreamRef.current?.getTracks().forEach((t) => t.stop());
    lobbyStreamRef.current = null;

    try {
      // Record participant entry in DB with URL-derived role (never user-selected)
      const p = await joinMeeting(
        meetingInfo.meeting_id,
        displayName.trim(),
        role   // <-- always from URL param, never from a UI dropdown
      );
      setParticipantRecordId(p.id);
    } catch {
      // Non-blocking: even if DB write fails, let user into the room
      console.warn("Could not record participant in DB");
    }

    setPhase("meeting");
  };

  // ---------------------------------------------------------------------------
  // Meeting Room — WebRTC hook (only active in meeting phase)
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
    shareScreen,
    stopShareScreen,
    messages,
    sendChatMessage,
  } = useWebRTC({
    meetingId: meetingCode,
    displayName: displayName || "Guest",
    role: mutableRole,
    onPeerCountChange: setPeerCount,
    /**
     * Fired when this client receives a "make-host" WS message targeting us.
     * Elevates our local role so host controls become visible.
     */
    onBecameHost: () => {
      setMutableRole("host");
    },
  });

  const isInMeeting = phase === "meeting";

  // ---------------------------------------------------------------------------
  // Leave / End handlers
  // ---------------------------------------------------------------------------
  const handleLeave = useCallback(async () => {
    leaveCall(); // Stops local tracks + closes WS

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
    leaveCall(); // Stops all local tracks + WS

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

    router.push("/");
  }, [leaveCall, participantRecordId, meetingInfo, router]);

  const handleCopyLink = async () => {
    // Copy clean participant join link without ?host=true
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
      <div className="min-h-screen bg-[#131314] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#0E72ED] animate-spin mx-auto mb-3" />
          <p className="text-[#8E8E93] text-sm">Verifying meeting...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error
  // ---------------------------------------------------------------------------
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-[#131314] flex items-center justify-center p-4">
        <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-[#FF3B30]" />
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">
            Meeting Not Found
          </h2>
          <p className="text-[#8E8E93] text-sm mb-6">{errorMessage}</p>
          <button
            id="error-back-home"
            onClick={() => router.push("/")}
            className="bg-[#0E72ED] hover:bg-[#1A7FF0] text-white font-medium px-6 py-2.5 rounded-xl text-sm transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Lobby (Pre-Join)
  // ---------------------------------------------------------------------------
  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-[#131314] flex items-center justify-center p-4">
        <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl">
          <div className="grid md:grid-cols-2">
            {/* Left — Camera preview */}
            <div className="bg-[#0D0D0E] relative aspect-video md:aspect-auto min-h-[240px] flex items-center justify-center">
              {lobbyVideoOn ? (
                <video
                  ref={lobbyVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0E72ED] to-[#00A3FF] flex items-center justify-center text-white text-2xl font-bold">
                    {(displayName || "?").charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[#8E8E93] text-sm">Camera is off</p>
                </div>
              )}

              {/* Preview controls */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                <button
                  id="lobby-toggle-audio"
                  onClick={toggleLobbyAudio}
                  className={`p-3 rounded-full transition ${
                    lobbyAudioOn
                      ? "bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]"
                      : "bg-[#FF3B30] text-white"
                  }`}
                >
                  {lobbyAudioOn ? (
                    <Mic className="w-5 h-5" />
                  ) : (
                    <MicOff className="w-5 h-5" />
                  )}
                </button>
                <button
                  id="lobby-toggle-video"
                  onClick={toggleLobbyVideo}
                  className={`p-3 rounded-full transition ${
                    lobbyVideoOn
                      ? "bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]"
                      : "bg-[#FF3B30] text-white"
                  }`}
                >
                  {lobbyVideoOn ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <VideoOff className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Right — Join form */}
            <div className="p-6 flex flex-col justify-center gap-5">
              <div>
                <h1 className="text-white font-bold text-xl">
                  {meetingInfo?.title ?? "Join Meeting"}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[#8E8E93] text-sm font-mono">
                    {meetingCode}
                  </span>
                  <button
                    id="lobby-copy-link"
                    onClick={handleCopyLink}
                    className="text-[#0E72ED] hover:text-[#1A7FF0] transition"
                    title="Copy invite link"
                  >
                    {linkCopied ? (
                      <Check className="w-3.5 h-3.5 text-[#34C759]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Role badge — read-only, derived from URL param */}
                {isHostFromQuery && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex items-center gap-1 bg-[#FF9500]/10 text-[#FF9500] px-2 py-0.5 rounded-full">
                      <Shield className="w-3 h-3" />
                      <span className="text-xs font-medium">You are the Host</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Display name input */}
              <div>
                <label
                  htmlFor="lobby-display-name"
                  className="block text-[#8E8E93] text-xs font-medium mb-1.5"
                >
                  Your display name
                </label>
                <input
                  id="lobby-display-name"
                  type="text"
                  placeholder="Enter your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-[#2C2C2E] text-white placeholder-[#8E8E93] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0E72ED] transition"
                  autoFocus
                />
              </div>

              {/*
               * HOST AUTHORIZATION: Role selector has been REMOVED.
               * The "host" / "participant" toggle buttons that previously
               * allowed any user to self-assign the host role are gone.
               * Role is determined solely by the ?host=true URL param,
               * which is only appended by the "New Meeting" dashboard action.
               */}

              {/* Join button */}
              <button
                id="lobby-join-btn"
                onClick={handleJoin}
                disabled={!displayName.trim()}
                className="w-full bg-[#0E72ED] hover:bg-[#1A7FF0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                Join Meeting
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[#636366] text-xs text-center">
                {isHostFromQuery
                  ? "You created this meeting and will join as Host"
                  : "You will join as a participant"}
              </p>
            </div>
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
        {/* Meeting info */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
          <div>
            <p className="text-white text-sm font-medium">
              {meetingInfo?.title ?? "Meeting"}
            </p>
            <p className="text-[#8E8E93] text-xs font-mono">{meetingCode}</p>
          </div>
        </div>

        {/* Connection health badge */}
        <MeetingHealth connectionState={connectionState} />

        {/* Time */}
        <LiveClock />
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
        />
      )}
    </div>
  );
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
