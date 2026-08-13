"use client";

/**
 * VideoGrid.tsx
 * -------------
 * Renders the responsive video card grid for all meeting participants.
 *
 * Layout rules (mirrors Zoom's adaptive grid):
 *  1 participant   → single large tile
 *  2 participants  → side-by-side 50/50
 *  3-4 participants → 2×2 grid
 *  5-9 participants → 3-column grid
 *  9+              → scrollable 3-column grid
 *
 * Each card shows:
 *  - Live <video> element attached to the MediaStream
 *  - Avatar fallback if video is off
 *  - Name label at the bottom
 *  - Muted microphone icon overlay
 *  - "HOST" badge on the host's tile
 *
 * CAMERA TOGGLE BUG FIX (Point 3):
 *  The <video> element is conditionally rendered — it unmounts when
 *  isVideoOff=true and remounts when isVideoOff=false. Because the stream
 *  reference itself doesn't change during a toggle, the useEffect([stream])
 *  would NOT re-fire on remount, leaving srcObject unset and the feed black.
 *
 *  Fix: Add `isVideoOff` to the dependency array. When isVideoOff goes
 *  false→true→false, the useEffect runs, finds the newly-mounted <video>
 *  element via videoRef, and re-attaches srcObject. We also call .play()
 *  to ensure autoplay resumes after the DOM re-insertion.
 */

import { useEffect, useRef } from "react";
import { MicOff, VideoOff, Crown } from "lucide-react";
import { RemotePeer } from "@/hooks/useWebRTC";

// ---------------------------------------------------------------------------
// VideoTile — single participant card
// ---------------------------------------------------------------------------
interface VideoTileProps {
  stream: MediaStream | null;
  displayName: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isLocal?: boolean;
  isHost?: boolean;
  isSpeaking?: boolean;
}

function VideoTile({
  stream,
  displayName,
  isMuted,
  isVideoOff,
  isLocal = false,
  isHost = false,
  isSpeaking = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * CRITICAL FIX — srcObject re-attachment on camera toggle.
   *
   * When the user toggles camera OFF, the <video> element unmounts (replaced
   * by the avatar fallback). When toggled back ON, a fresh <video> element
   * mounts into the DOM — its srcObject is null by default.
   *
   * Adding `isVideoOff` to the dependency array ensures this effect re-runs
   * whenever the video element remounts, so srcObject is always attached.
   * Without this, the feed would show a black box after toggle-on.
   *
   * We call .play() because autoplay behaviour can be suppressed after a
   * DOM re-insertion in some browsers (especially Safari).
   */
  useEffect(() => {
    if (videoRef.current && stream && !isVideoOff) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked on first load (before user gesture).
        // The browser will still render the frame when autoplay is allowed.
      });
    }
  }, [stream, isVideoOff]);

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`
        relative rounded-xl overflow-hidden bg-[#1C1C1E] aspect-video
        flex items-center justify-center
        transition-all duration-300
        ${isSpeaking ? "ring-2 ring-[#34C759] ring-offset-2 ring-offset-[#131314]" : ""}
      `}
    >
      {/* Video element — only rendered when camera is ON */}
      {!isVideoOff && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Mute local to prevent audio echo
          className="w-full h-full object-cover"
        />
      ) : (
        /* Avatar fallback when video is off */
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0E72ED] to-[#00A3FF] flex items-center justify-center text-white text-xl font-bold">
            {initials}
          </div>
          {isVideoOff && (
            <div className="flex items-center gap-1 text-[#8E8E93] text-xs">
              <VideoOff className="w-3 h-3" />
              <span>Camera off</span>
            </div>
          )}
        </div>
      )}

      {/* Name label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isHost && (
            <span className="bg-[#FF9500] text-black text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
              <Crown className="w-2.5 h-2.5" />
              HOST
            </span>
          )}
          <span className="text-white text-xs font-medium truncate max-w-[120px]">
            {displayName} {isLocal ? "(You)" : ""}
          </span>
        </div>
        {isMuted && <MicOff className="w-3.5 h-3.5 text-[#FF3B30]" />}
      </div>

      {/* Active speaker indicator pulse */}
      {isSpeaking && (
        <div className="absolute top-2 right-2">
          <div className="flex gap-0.5 items-end h-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-1 bg-[#34C759] rounded-full animate-pulse"
                style={{
                  height: `${(i % 3) * 30 + 30}%`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VideoGrid — layout orchestrator
// ---------------------------------------------------------------------------
interface VideoGridProps {
  localStream: MediaStream | null;
  localDisplayName: string;
  localIsMuted: boolean;
  localIsVideoOff: boolean;
  isLocalHost: boolean;
  remotePeers: RemotePeer[];
  /** When true, remote video feeds are not rendered (low-bandwidth mode) */
  stopIncomingVideo?: boolean;
}

export default function VideoGrid({
  localStream,
  localDisplayName,
  localIsMuted,
  localIsVideoOff,
  isLocalHost,
  remotePeers,
  stopIncomingVideo = false,
}: VideoGridProps) {
  const totalParticipants = 1 + remotePeers.length;

  // Determine grid column count based on participant count
  const gridCols =
    totalParticipants === 1
      ? "grid-cols-1"
      : totalParticipants === 2
      ? "grid-cols-2"
      : totalParticipants <= 4
      ? "grid-cols-2"
      : "grid-cols-3";

  return (
    <div
      className={`
        grid ${gridCols} gap-3 p-4 h-full overflow-y-auto
        auto-rows-fr
      `}
    >
      {/* Local video tile — always first */}
      <VideoTile
        stream={localStream}
        displayName={localDisplayName}
        isMuted={localIsMuted}
        isVideoOff={localIsVideoOff}
        isLocal
        isHost={isLocalHost}
      />

      {/* Remote peer tiles */}
      {remotePeers.map((peer) => (
        <VideoTile
          key={peer.peerId}
          stream={peer.stream}
          displayName={peer.displayName}
          isMuted={peer.isMuted}
          // Respect both the peer's own video state and the host's
          // "Stop Incoming Video" low-bandwidth mode toggle
          isVideoOff={peer.isVideoOff || stopIncomingVideo}
          isHost={false}
        />
      ))}
    </div>
  );
}
