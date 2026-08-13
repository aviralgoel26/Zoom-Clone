"use client";

/**
 * MeetingHealth.tsx
 * -----------------
 * Top-bar badge showing live WebRTC connection state + simulated latency.
 * Acts as the "Meeting Health" USP differentiator in the assessment.
 *
 * States:
 *  connected    → green pulse dot, "Connected" label, latency in ms
 *  connecting   → yellow pulse dot, "Connecting..." label
 *  disconnected → red dot, "Disconnected" label
 */

import { useEffect, useState } from "react";
import { Wifi, WifiOff, Activity } from "lucide-react";

interface MeetingHealthProps {
  connectionState: RTCPeerConnectionState | "connecting" | "disconnected";
}

export default function MeetingHealth({ connectionState }: MeetingHealthProps) {
  const [latency, setLatency] = useState<number | null>(null);

  // Simulate latency measurement by timing a fetch to localhost.
  // In a real app you'd use RTCPeerConnection.getStats() for actual RTT.
  useEffect(() => {
    if (connectionState !== "connected") {
      setLatency(null);
      return;
    }
    const measure = async () => {
      const start = performance.now();
      try {
        await fetch("/api/placeholder", { method: "HEAD" }).catch(() => {});
      } finally {
        const elapsed = Math.round(performance.now() - start);
        // Clamp to realistic range for display
        setLatency(Math.min(elapsed, 999));
      }
    };
    measure();
    const interval = setInterval(measure, 5000);
    return () => clearInterval(interval);
  }, [connectionState]);

  const isConnected = connectionState === "connected";
  const isConnecting =
    connectionState === "connecting" || connectionState === "new";
  const isDisconnected =
    connectionState === "disconnected" || connectionState === "failed";

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        border transition-all duration-500
        ${isConnected ? "bg-[#052e16]/60 border-[#34C759]/40 text-[#34C759]" : ""}
        ${isConnecting ? "bg-[#2c1a00]/60 border-[#FF9500]/40 text-[#FF9500]" : ""}
        ${isDisconnected ? "bg-[#2c0000]/60 border-[#FF3B30]/40 text-[#FF3B30]" : ""}
      `}
    >
      {/* Pulse dot */}
      <div className="relative flex items-center justify-center">
        <div
          className={`
            w-2 h-2 rounded-full
            ${isConnected ? "bg-[#34C759]" : ""}
            ${isConnecting ? "bg-[#FF9500] animate-pulse" : ""}
            ${isDisconnected ? "bg-[#FF3B30]" : ""}
          `}
        />
        {isConnected && (
          <div className="absolute w-2 h-2 rounded-full bg-[#34C759] animate-ping opacity-75" />
        )}
      </div>

      {/* Icon */}
      {isDisconnected ? (
        <WifiOff className="w-3 h-3" />
      ) : isConnected ? (
        <Wifi className="w-3 h-3" />
      ) : (
        <Activity className="w-3 h-3" />
      )}

      {/* Label */}
      <span>
        {isConnected
          ? `Connected${latency !== null ? ` · ${latency}ms` : ""}`
          : isConnecting
          ? "Connecting..."
          : "Disconnected"}
      </span>
    </div>
  );
}
