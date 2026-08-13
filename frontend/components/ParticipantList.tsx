"use client";

/**
 * ParticipantList.tsx
 * -------------------
 * Sliding side panel showing all active participants.
 *
 * HOST CONTROLS (Point 5):
 *  Footer buttons (host-only):
 *   - "Mute All"       → broadcasts host-action: mute-all via WS
 *   - "Stop All Video" → broadcasts host-action: stop-all-video via WS
 *
 *  Per-row action menu (⋮) — visible on hover for non-local participants:
 *   - "Mute Mic"    → broadcasts host-action: mute-peer { targetPeerId }
 *   - "Stop Video"  → broadcasts host-action: stop-video-peer { targetPeerId }
 *   - "Remove"      → broadcasts host-action: kick { targetPeerId }
 *   - "Make Host"   → broadcasts host-action: make-host { targetPeerId }
 */

import { useState } from "react";
import {
  X,
  MicOff,
  Mic,
  Video,
  VideoOff,
  Shield,
  UserMinus,
  MoreVertical,
  Crown,
} from "lucide-react";
import { RemotePeer } from "@/hooks/useWebRTC";

interface LocalParticipantInfo {
  displayName: string;
  isMuted: boolean;
  isVideoOff: boolean;
  role: "host" | "participant";
}

interface ParticipantListProps {
  localParticipant: LocalParticipantInfo;
  remotePeers: RemotePeer[];
  isHost: boolean;
  onMuteAll: () => void;
  onStopAllVideo: () => void;
  onKick: (peerId: string) => void;
  onMutePeer: (peerId: string) => void;
  onStopVideoPeer: (peerId: string) => void;
  onMakeHost: (peerId: string) => void;
  onClose: () => void;
}

export default function ParticipantList({
  localParticipant,
  remotePeers,
  isHost,
  onMuteAll,
  onStopAllVideo,
  onKick,
  onMutePeer,
  onStopVideoPeer,
  onMakeHost,
  onClose,
}: ParticipantListProps) {
  const totalCount = 1 + remotePeers.length;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-72 bg-[#1C1C1E] border-l border-[#2C2C2E] flex flex-col z-30 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#2C2C2E]">
        <div>
          <h2 className="text-white font-semibold text-sm">Participants</h2>
          <p className="text-[#8E8E93] text-xs mt-0.5">{totalCount} in meeting</p>
        </div>
        <button
          id="participants-close"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[#2C2C2E] text-[#8E8E93] hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Local user entry — no action menu (can't control yourself) */}
        <ParticipantRow
          peerId="local"
          displayName={localParticipant.displayName}
          role={localParticipant.role}
          isMuted={localParticipant.isMuted}
          isVideoOff={localParticipant.isVideoOff}
          isLocal
          isHost={isHost}
        />

        {/* Remote peers */}
        {remotePeers.map((peer) => (
          <ParticipantRow
            key={peer.peerId}
            peerId={peer.peerId}
            displayName={peer.displayName}
            role="participant"
            isMuted={peer.isMuted}
            isVideoOff={peer.isVideoOff}
            isLocal={false}
            isHost={isHost}
            onMuteMic={() => onMutePeer(peer.peerId)}
            onStopVideo={() => onStopVideoPeer(peer.peerId)}
            onKick={() => onKick(peer.peerId)}
            onMakeHost={() => onMakeHost(peer.peerId)}
          />
        ))}

        {remotePeers.length === 0 && (
          <div className="text-center py-8 px-4">
            <p className="text-[#8E8E93] text-xs">
              Waiting for others to join...
            </p>
            <p className="text-[#636366] text-xs mt-1">
              Share the meeting link to invite participants.
            </p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Host controls footer — only visible to the host                     */}
      {/* ------------------------------------------------------------------ */}
      {isHost && (
        <div className="border-t border-[#2C2C2E] p-3 space-y-2">
          {/* Mute All */}
          <button
            id="host-mute-all"
            onClick={onMuteAll}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#EBEBF5] text-sm font-medium transition"
          >
            <MicOff className="w-4 h-4" />
            Mute All
          </button>

          {/* Stop All Video */}
          <button
            id="host-stop-all-video"
            onClick={onStopAllVideo}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#EBEBF5] text-sm font-medium transition"
          >
            <VideoOff className="w-4 h-4" />
            Stop All Video
          </button>

          <p className="text-[#636366] text-[10px] text-center">
            Host controls — visible only to you
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParticipantRow — single participant entry with optional ⋮ action menu
// ---------------------------------------------------------------------------
interface ParticipantRowProps {
  peerId: string;
  displayName: string;
  role: "host" | "participant";
  isMuted: boolean;
  isVideoOff: boolean;
  isLocal: boolean;
  isHost: boolean;
  // Action callbacks — only provided for non-local participants when isHost
  onMuteMic?: () => void;
  onStopVideo?: () => void;
  onKick?: () => void;
  onMakeHost?: () => void;
}

function ParticipantRow({
  peerId,
  displayName,
  role,
  isMuted,
  isVideoOff,
  isLocal,
  isHost,
  onMuteMic,
  onStopVideo,
  onKick,
  onMakeHost,
}: ParticipantRowProps) {
  const [showMenu, setShowMenu] = useState(false);

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const safeId = peerId.replace(/[^a-zA-Z0-9-]/g, "-");

  return (
    <div className="relative flex items-center gap-3 px-4 py-2.5 hover:bg-[#2C2C2E]/50 group transition">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0E72ED] to-[#00A3FF] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
        {initials}
      </div>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-sm font-medium truncate">
            {displayName}
          </span>
          {isLocal && (
            <span className="text-[#8E8E93] text-xs">(You)</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {role === "host" && (
            <div className="flex items-center gap-0.5 text-[#FF9500]">
              <Shield className="w-2.5 h-2.5" />
              <span className="text-[10px] font-medium">Host</span>
            </div>
          )}
        </div>
      </div>

      {/* Media state indicators */}
      <div className="flex items-center gap-1.5">
        {isMuted ? (
          <MicOff className="w-3.5 h-3.5 text-[#FF3B30]" />
        ) : (
          <Mic className="w-3.5 h-3.5 text-[#34C759]" />
        )}
        {isVideoOff ? (
          <VideoOff className="w-3.5 h-3.5 text-[#FF3B30]" />
        ) : (
          <Video className="w-3.5 h-3.5 text-[#34C759]" />
        )}

        {/* ⋮ Action menu button — host only, non-local participants */}
        {isHost && !isLocal && (
          <button
            id={`more-${safeId}`}
            onClick={() => setShowMenu((v) => !v)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[#3A3A3C] text-[#8E8E93] hover:text-white transition"
            title={`Actions for ${displayName}`}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Per-participant action dropdown menu                              */}
      {/* ---------------------------------------------------------------- */}
      {showMenu && isHost && !isLocal && (
        <>
          {/* Transparent overlay to capture outside clicks */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-2 top-full mt-1 w-44 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl shadow-2xl overflow-hidden z-50">

            {/* Mute Mic */}
            <ActionMenuItem
              id={`action-mute-${safeId}`}
              icon={<MicOff className="w-3.5 h-3.5" />}
              label="Mute Mic"
              onClick={() => {
                onMuteMic?.();
                setShowMenu(false);
              }}
            />

            {/* Stop Video */}
            <ActionMenuItem
              id={`action-stop-video-${safeId}`}
              icon={<VideoOff className="w-3.5 h-3.5" />}
              label="Stop Video"
              onClick={() => {
                onStopVideo?.();
                setShowMenu(false);
              }}
            />

            <div className="h-px bg-[#3A3A3C] mx-2" />

            {/* Make Host */}
            <ActionMenuItem
              id={`action-make-host-${safeId}`}
              icon={<Crown className="w-3.5 h-3.5 text-[#FF9500]" />}
              label="Make Host"
              labelClass="text-[#FF9500]"
              onClick={() => {
                onMakeHost?.();
                setShowMenu(false);
              }}
            />

            {/* Remove Participant */}
            <ActionMenuItem
              id={`action-kick-${safeId}`}
              icon={<UserMinus className="w-3.5 h-3.5 text-[#FF3B30]" />}
              label="Remove"
              labelClass="text-[#FF3B30]"
              onClick={() => {
                onKick?.();
                setShowMenu(false);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper — single item in the per-participant action dropdown
// ---------------------------------------------------------------------------
interface ActionMenuItemProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  labelClass?: string;
  onClick: () => void;
}

function ActionMenuItem({ id, icon, label, labelClass = "text-white", onClick }: ActionMenuItemProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#3A3A3C] transition text-left"
    >
      {icon}
      <span className={`text-xs font-medium ${labelClass}`}>{label}</span>
    </button>
  );
}
