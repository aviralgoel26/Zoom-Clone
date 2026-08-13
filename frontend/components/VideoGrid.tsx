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
 *  - Animated emoji reaction badges and floating reaction overlay
 */

import { useEffect, useRef } from "react";
import { MicOff, VideoOff, Crown } from "lucide-react";
import { RemotePeer, ReactionEvent } from "@/hooks/useWebRTC";

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
  reactionEmoji?: string;
}

function VideoTile({
  stream,
  displayName,
  isMuted,
  isVideoOff,
  isLocal = false,
  isHost = false,
  isSpeaking = false,
  reactionEmoji,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream && !isVideoOff) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {
        // Autoplay play handling
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

      {/* Bottom overlay: Name badge & audio status */}
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

      {/* Reaction Badge on Tile */}
      {reactionEmoji && (
        <div className="absolute top-2 left-2 bg-[#1C1C1E]/90 border border-[#3A3A3C] rounded-full px-2.5 py-1 text-lg shadow-lg animate-bounce z-10">
          {reactionEmoji}
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
  reactions?: ReactionEvent[];
  /** This client's own peerId for precise reaction badge matching */
  localPeerId?: string;
}

export default function VideoGrid({
  localStream,
  localDisplayName,
  localIsMuted,
  localIsVideoOff,
  isLocalHost,
  remotePeers,
  stopIncomingVideo = false,
  reactions = [],
  localPeerId = "",
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

  // Match reaction to local tile by peerId (most accurate) then fall back to sender name
  const localReaction = reactions.find(
    (r) => r.peerId === localPeerId || (!localPeerId && r.sender === localDisplayName)
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
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
          reactionEmoji={localReaction?.emoji}
        />

        {/* Remote peer cards */}
        {remotePeers.map((peer) => {
          const peerReaction = reactions.find((r) => r.peerId === peer.peerId);
          return (
            <VideoTile
              key={peer.peerId}
              stream={stopIncomingVideo ? null : peer.stream}
              displayName={peer.displayName}
              isMuted={peer.isMuted}
              isVideoOff={peer.isVideoOff || stopIncomingVideo}
              reactionEmoji={peerReaction?.emoji}
            />
          );
        })}
      </div>

      {/* Floating Screen Reactions Overlay (Zoom Workplace Desktop Style) */}
      <div className="fixed bottom-24 left-6 z-40 pointer-events-none flex flex-col-reverse gap-2 max-h-60 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 bg-[#1C1C1E]/95 border border-[#3A3A3C] rounded-full px-3.5 py-1.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto"
          >
            <span className="text-xl animate-bounce">{r.emoji}</span>
            <span className="text-white text-xs font-medium">{r.sender}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
