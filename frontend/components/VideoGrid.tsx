"use client";

/**
 * VideoGrid.tsx
 * -------------
 * Renders the video tile grid for all meeting participants.
 *
 * Supports two view modes:
 *   "grid"    — standard responsive grid (1/2/2x2/3-col based on participant count)
 *   "speaker" — one large primary tile (75% height) + horizontal thumbnail strip
 *
 * Each tile shows:
 *  - Live <video> element attached to the MediaStream
 *  - Avatar fallback (gradient + initials) when camera is off
 *  - Name label + HOST badge at the bottom overlay
 *  - Muted mic icon indicator
 *  - Animated emoji reaction badge
 *  - Green ring + audio bars when "speaking"
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
  compact?: boolean;
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
  compact = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream && !isVideoOff) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
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
        relative rounded-xl overflow-hidden bg-[#1C1C1E]
        flex items-center justify-center
        transition-all duration-300
        ${compact ? "aspect-video" : "aspect-video"}
        ${isSpeaking ? "ring-2 ring-[#34C759] ring-offset-2 ring-offset-[#131314]" : ""}
      `}
    >
      {/* Video */}
      {!isVideoOff && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className={`rounded-full bg-gradient-to-br from-[#0E72ED] to-[#00A3FF] flex items-center justify-center text-white font-bold
              ${compact ? "w-10 h-10 text-sm" : "w-16 h-16 text-xl"}`}
          >
            {initials}
          </div>
          {!compact && isVideoOff && (
            <div className="flex items-center gap-1 text-[#8E8E93] text-xs">
              <VideoOff className="w-3 h-3" />
              <span>Camera off</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom overlay: name + badges */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isHost && !compact && (
            <span className="bg-[#FF9500] text-black text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
              <Crown className="w-2.5 h-2.5" />
              HOST
            </span>
          )}
          {isHost && compact && (
            <Crown className="w-3 h-3 text-[#FF9500]" />
          )}
          <span className={`text-white font-medium truncate ${compact ? "text-[10px] max-w-[70px]" : "text-xs max-w-[120px]"}`}>
            {displayName}{isLocal ? " (You)" : ""}
          </span>
        </div>
        {isMuted && <MicOff className={`text-[#FF3B30] flex-shrink-0 ${compact ? "w-3 h-3" : "w-3.5 h-3.5"}`} />}
      </div>

      {/* Speaking indicator — audio bars top-right */}
      {isSpeaking && !compact && (
        <div className="absolute top-2 right-2">
          <div className="flex gap-0.5 items-end h-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-1 bg-[#34C759] rounded-full animate-pulse"
                style={{ height: `${(i % 3) * 30 + 30}%`, animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reaction emoji badge */}
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
export type ViewMode = "grid" | "speaker";

interface VideoGridProps {
  localStream: MediaStream | null;
  localDisplayName: string;
  localIsMuted: boolean;
  localIsVideoOff: boolean;
  isLocalHost: boolean;
  remotePeers: RemotePeer[];
  stopIncomingVideo?: boolean;
  reactions?: ReactionEvent[];
  localPeerId?: string;
  viewMode?: ViewMode;
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
  viewMode = "grid",
}: VideoGridProps) {
  const totalParticipants = 1 + remotePeers.length;

  const gridCols =
    totalParticipants === 1
      ? "grid-cols-1"
      : totalParticipants === 2
      ? "grid-cols-2"
      : totalParticipants <= 4
      ? "grid-cols-2"
      : "grid-cols-3";

  const localReaction = reactions.find(
    (r) => r.peerId === localPeerId || (!localPeerId && r.sender === localDisplayName)
  );

  // Build ordered participant list: local first, then remotes
  const allPeers = [
    {
      id: "local",
      stream: localStream,
      displayName: localDisplayName,
      isMuted: localIsMuted,
      isVideoOff: localIsVideoOff,
      isLocal: true,
      isHost: isLocalHost,
      reaction: localReaction?.emoji,
    },
    ...remotePeers.map((p) => ({
      id: p.peerId,
      stream: stopIncomingVideo ? null : p.stream,
      displayName: p.displayName,
      isMuted: p.isMuted,
      isVideoOff: p.isVideoOff || stopIncomingVideo,
      isLocal: false,
      isHost: p.role === "host",
      reaction: reactions.find((r) => r.peerId === p.peerId)?.emoji,
    })),
  ];

  const [primary, ...secondaries] = allPeers;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* ── SPEAKER VIEW ─────────────────────────────────────── */}
      {viewMode === "speaker" && (
        <div className="flex flex-col h-full">
          {/* Primary large tile */}
          <div className="flex-1 p-3 pb-1 min-h-0">
            <div className="h-full rounded-xl overflow-hidden">
              <VideoTile
                stream={primary.stream}
                displayName={primary.displayName}
                isMuted={primary.isMuted}
                isVideoOff={primary.isVideoOff}
                isLocal={primary.isLocal}
                isHost={primary.isHost}
                reactionEmoji={primary.reaction}
              />
            </div>
          </div>

          {/* Thumbnail strip */}
          {secondaries.length > 0 && (
            <div className="flex-shrink-0 px-3 pb-3 pt-1">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {secondaries.map((p) => (
                  <div key={p.id} className="flex-shrink-0 w-36 h-24 rounded-lg overflow-hidden">
                    <VideoTile
                      stream={p.stream}
                      displayName={p.displayName}
                      isMuted={p.isMuted}
                      isVideoOff={p.isVideoOff}
                      isLocal={p.isLocal}
                      isHost={p.isHost}
                      reactionEmoji={p.reaction}
                      compact
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GRID VIEW ────────────────────────────────────────── */}
      {viewMode === "grid" && (
        <div
          className={`grid ${gridCols} gap-3 p-4 h-full overflow-y-auto auto-rows-fr`}
        >
          {allPeers.map((p) => (
            <VideoTile
              key={p.id}
              stream={p.stream}
              displayName={p.displayName}
              isMuted={p.isMuted}
              isVideoOff={p.isVideoOff}
              isLocal={p.isLocal}
              isHost={p.isHost}
              reactionEmoji={p.reaction}
            />
          ))}
        </div>
      )}

      {/* Floating Reactions Overlay */}
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
