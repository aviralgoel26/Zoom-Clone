/**
 * useWebRTC.ts
 * ------------
 * Custom React hook encapsulating ALL WebRTC and WebSocket signaling logic.
 *
 * Responsibilities:
 *  1. Acquire local camera/microphone via getUserMedia().
 *  2. Open a WebSocket connection to the FastAPI signaling server.
 *  3. When a new peer joins, create an RTCPeerConnection, generate an SDP
 *     offer, and relay it through the WebSocket.
 *  4. Handle incoming offers → generate answers.
 *  5. Exchange ICE candidates (trickle ICE).
 *  6. Expose remote streams so VideoGrid can render them.
 *  7. CRITICAL: Stop all MediaStreamTracks on cleanup to release camera/mic
 *     hardware — prevents NotReadableError on rejoin.
 *
 * WebRTC Topology: P2P Mesh
 *   Every browser connects directly to every other browser.
 *   The server (FastAPI) only relays signaling messages — no media touches it.
 *
 * STUN Server: stun:stun.l.google.com:19302
 *   Used for NAT traversal during ICE negotiation.
 *
 * HOST CONTROLS (Point 5):
 *   muteAll        — broadcast host-action: mute-all to silence all mics
 *   stopAllVideo   — broadcast host-action: stop-all-video to kill all cameras
 *   mutePeer       — broadcast host-action: mute-peer targeting one peerId
 *   stopVideoPeer  — broadcast host-action: stop-video-peer targeting one peerId
 *   makeHost       — broadcast host-action: make-host to transfer host role
 *   kickPeer       — broadcast host-action: kick to remove a peer
 *
 * SCREEN SHARING (Point 6):
 *   shareScreen    — calls getDisplayMedia(), replaces video sender track
 *   stopShareScreen— restores camera track via replaceTrack
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildWebSocketUrl } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RemotePeer {
  peerId: string;
  stream: MediaStream;
  displayName: string;
  isMuted: boolean;
  isVideoOff: boolean;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isSelf: boolean;
}

export interface ReactionEvent {
  id: string;
  emoji: string;
  sender: string;
  peerId: string;
  timestamp: number;
}

interface UseWebRTCOptions {
  meetingId: string;
  displayName: string;
  role: "host" | "participant";
  onPeerCountChange?: (count: number) => void;
  /** Fired when this client receives a "make-host" action targeting them */
  onBecameHost?: () => void;
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remotePeers: RemotePeer[];
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  connectionState: RTCPeerConnectionState | "connecting" | "disconnected";
  toggleAudio: () => void;
  toggleVideo: () => void;
  leaveCall: () => void;
  // Host-only broadcast commands
  muteAll: () => void;
  stopAllVideo: () => void;
  mutePeer: (peerId: string) => void;
  stopVideoPeer: (peerId: string) => void;
  makeHost: (peerId: string) => void;
  kickPeer: (peerId: string) => void;
  endMeetingForAll: () => void;
  // Screen sharing
  shareScreen: () => Promise<void>;
  stopShareScreen: () => void;
  // In-meeting chat
  messages: ChatMessage[];
  sendChatMessage: (text: string) => void;
  // Emoji reactions
  reactions: ReactionEvent[];
  sendReaction: (emoji: string) => void;
}

// ICE configuration — Google's public STUN server for NAT traversal.
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useWebRTC({
  meetingId,
  displayName,
  role,
  onPeerCountChange,
  onBecameHost,
}: UseWebRTCOptions): UseWebRTCReturn {
  // Local media stream from getUserMedia()
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // Map of peerId → RemotePeer (for rendering in VideoGrid)
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState<
    RTCPeerConnectionState | "connecting" | "disconnected"
  >("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);

  // Refs — survive re-renders without triggering them
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const myPeerIdRef = useRef<string>(
    `peer-${Math.random().toString(36).substring(2, 9)}`
  );
  // Guard: prevents opening a second WebSocket while one is already CONNECTING or OPEN
  const isConnectingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // 1. Acquire local media (getUserMedia)
  // ---------------------------------------------------------------------------
  const initLocalStream = useCallback(async () => {
    try {
      // Request both video and audio.
      // The browser will show a permission prompt if not already granted.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("[WebRTC] getUserMedia failed:", err);
      // Return null — video tile will show avatar instead
      return null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Create RTCPeerConnection for a specific remote peer
  // ---------------------------------------------------------------------------
  const createPeerConnection = useCallback(
    (peerId: string, peerDisplayName: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add all local tracks to this peer connection so the remote peer
      // receives our audio/video stream.
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // ICE candidate generated locally → relay to remote peer via signaling WS.
      pc.onicecandidate = ({ candidate }) => {
        if (candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: candidate.toJSON(),
              targetPeerId: peerId,
              fromPeerId: myPeerIdRef.current,
            })
          );
        }
      };

      // Remote track received → attach to RemotePeer entry.
      // ontrack fires once per track (audio and video arrive separately).
      pc.ontrack = ({ streams }) => {
        const [remoteStream] = streams;
        setRemotePeers((prev) => {
          const exists = prev.find((p) => p.peerId === peerId);
          if (exists) {
            // Update stream reference on existing entry
            return prev.map((p) =>
              p.peerId === peerId ? { ...p, stream: remoteStream } : p
            );
          }
          return [
            ...prev,
            {
              peerId,
              stream: remoteStream,
              displayName: peerDisplayName,
              isMuted: false,
              isVideoOff: false,
            },
          ];
        });
      };

      // Track overall connection health for the MeetingHealth badge.
      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
      };

      peerConnectionsRef.current.set(peerId, pc);
      return pc;
    },
    []
  );

  // ---------------------------------------------------------------------------
  // 3. WebSocket setup and signaling message loop
  // ---------------------------------------------------------------------------
  const initWebSocket = useCallback(
    (stream: MediaStream | null) => {
      // Prevent duplicate socket creation if called more than once
      if (isConnectingRef.current) return;
      const wsUrl = buildWebSocketUrl(meetingId);
      if (!wsUrl) {
        console.warn("[WS] Cannot build WebSocket URL — skipping connection.");
        return;
      }
      console.log("[WS] Connecting to:", wsUrl);
      isConnectingRef.current = true;

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        console.warn("[WS] Failed to create WebSocket (invalid URL?):", err);
        isConnectingRef.current = false;
        setConnectionState("disconnected");
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connection established.");
        // Announce ourselves to existing room members
        ws.send(
          JSON.stringify({
            type: "participant-joined",
            peerId: myPeerIdRef.current,
            displayName,
            role,
          })
        );
      };

      ws.onmessage = async ({ data }) => {
        let message: Record<string, unknown>;
        try {
          message = JSON.parse(data as string);
        } catch {
          return;
        }

        const { type } = message;

        if (type === "room-info") {
          // Server sends current peer count on connect.
          const count = (message.peerCount as number) ?? 0;
          onPeerCountChange?.(count);

        } else if (type === "participant-joined") {
          // A new peer arrived → WE create an offer and send it.
          const remotePeerId = message.peerId as string;
          const remoteDisplayName = (message.displayName as string) ?? "Guest";
          console.log(`[WS] Peer joined: ${remotePeerId}`);

          const pc = createPeerConnection(remotePeerId, remoteDisplayName);

          // createOffer generates the SDP that describes our local media capabilities.
          const offer = await pc.createOffer();
          // setLocalDescription stores the SDP and triggers ICE candidate gathering.
          await pc.setLocalDescription(offer);

          ws.send(
            JSON.stringify({
              type: "offer",
              sdp: pc.localDescription,
              targetPeerId: remotePeerId,
              fromPeerId: myPeerIdRef.current,
              displayName,
            })
          );

        } else if (type === "offer") {
          // We received an offer from a peer that joined before us.
          const remotePeerId = message.fromPeerId as string;
          const remoteDisplayName = (message.displayName as string) ?? "Guest";
          console.log(`[WS] Received offer from: ${remotePeerId}`);

          const pc = createPeerConnection(remotePeerId, remoteDisplayName);
          // setRemoteDescription stores the offer's SDP.
          await pc.setRemoteDescription(
            new RTCSessionDescription(
              message.sdp as RTCSessionDescriptionInit
            )
          );

          // createAnswer generates our SDP response.
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          ws.send(
            JSON.stringify({
              type: "answer",
              sdp: pc.localDescription,
              targetPeerId: remotePeerId,
              fromPeerId: myPeerIdRef.current,
            })
          );

        } else if (type === "answer") {
          // The peer accepted our offer.
          const remotePeerId = message.fromPeerId as string;
          const pc = peerConnectionsRef.current.get(remotePeerId);
          if (pc) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(
                message.sdp as RTCSessionDescriptionInit
              )
            );
          }

        } else if (type === "ice-candidate") {
          // Trickle ICE: add remote candidate to the correct peer connection.
          const remotePeerId = message.fromPeerId as string;
          const pc = peerConnectionsRef.current.get(remotePeerId);
          if (pc && message.candidate) {
            try {
              await pc.addIceCandidate(
                new RTCIceCandidate(
                  message.candidate as RTCIceCandidateInit
                )
              );
            } catch (e) {
              console.warn("[WebRTC] addIceCandidate error:", e);
            }
          }

        } else if (type === "participant-left") {
          const remotePeerId = message.peerId as string;
          console.log(`[WS] Peer left: ${remotePeerId}`);
          // Close and remove the peer connection
          const pc = peerConnectionsRef.current.get(remotePeerId);
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(remotePeerId);
          }
          setRemotePeers((prev) =>
            prev.filter((p) => p.peerId !== remotePeerId)
          );

        } else if (type === "host-action") {
          /**
           * HOST CONTROL HANDLER
           * --------------------
           * The FastAPI signaling server relays host-action messages to ALL
           * peers in the room (excluding the sender). Each client inspects
           * the `action` field and `targetPeerId` to decide whether to act.
           *
           * Supported actions:
           *  - mute-all        : Mute all non-host microphones
           *  - stop-all-video  : Disable all non-host cameras
           *  - mute-peer       : Mute a specific participant's mic
           *  - stop-video-peer : Stop a specific participant's camera
           *  - kick            : Eject a specific participant from the room
           *  - make-host       : Transfer host role to a specific participant
           */
          const action = message.action as string;
          const targetPeerId = message.targetPeerId as string | undefined;

          if (action === "mute-all") {
            // Self-mute in response to a host broadcast
            localStreamRef.current?.getAudioTracks().forEach((track) => {
              track.enabled = false;
            });
            setIsAudioMuted(true);

          } else if (action === "stop-all-video") {
            // Disable local camera in response to host broadcast
            localStreamRef.current?.getVideoTracks().forEach((track) => {
              track.enabled = false;
            });
            setIsVideoOff(true);

          } else if (action === "mute-peer" && targetPeerId === myPeerIdRef.current) {
            // Only act if WE are the target
            localStreamRef.current?.getAudioTracks().forEach((track) => {
              track.enabled = false;
            });
            setIsAudioMuted(true);

          } else if (action === "stop-video-peer" && targetPeerId === myPeerIdRef.current) {
            // Only act if WE are the target
            localStreamRef.current?.getVideoTracks().forEach((track) => {
              track.enabled = false;
            });
            setIsVideoOff(true);

          } else if (action === "kick" && targetPeerId === myPeerIdRef.current) {
            // We were kicked — leave the meeting
            cleanup();
            window.location.href = "/";

          } else if (action === "end-meeting") {
            // Host ended meeting for ALL connected participants in room
            console.log("[WebRTC] Meeting ended for all by host.");
            cleanup();
            window.location.href = "/?meetingEnded=true";

          } else if (action === "make-host" && targetPeerId === myPeerIdRef.current) {
            // We've been promoted to host
            console.log("[WebRTC] We have been made host.");
            onBecameHost?.();
          }
        } else if (type === "chat-message") {
          const chatMsg: ChatMessage = {
            id: (message.id as string) || Math.random().toString(36).substring(2, 9),
            sender: (message.sender as string) ?? "Guest",
            text: (message.text as string) ?? "",
            timestamp:
              (message.timestamp as string) ??
              new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            isSelf: false,
          };
          setMessages((prev) => [...prev, chatMsg]);

        } else if (type === "reaction") {
          const reactionEvt: ReactionEvent = {
            id: (message.id as string) || Math.random().toString(36).substring(2, 9),
            emoji: (message.emoji as string) ?? "👍",
            sender: (message.sender as string) ?? "Guest",
            peerId: (message.peerId as string) ?? "",
            timestamp: Date.now(),
          };
          setReactions((prev) => [...prev, reactionEvt]);

          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== reactionEvt.id));
          }, 3500);
        }
      };

      ws.onerror = (err) => {
        // Log gracefully — do NOT re-throw, as that would cause an uncaught
        // React exception overlay. WS errors are non-fatal on the dashboard.
        console.warn(
          "[WS] Connection error — is the FastAPI backend running on port 8000?",
          err
        );
        setConnectionState("disconnected");
      };

      ws.onclose = () => {
        console.log("[WS] Connection closed.");
        isConnectingRef.current = false;
        setConnectionState("disconnected");
      };
    },
    [meetingId, displayName, role, createPeerConnection, onPeerCountChange, onBecameHost]
  );

  // ---------------------------------------------------------------------------
  // 4. Cleanup — CRITICAL: stop all tracks to release camera/mic hardware
  // ---------------------------------------------------------------------------
  const cleanup = useCallback(() => {
    // Stop all local MediaStreamTracks.
    // Without this, the camera LED stays on and the next getUserMedia() call
    // throws NotReadableError: Device already in use.
    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
      console.log(`[Cleanup] Stopped track: ${track.kind}`);
    });
    localStreamRef.current = null;

    // Stop screen share track if active
    screenStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    screenStreamRef.current = null;

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, id) => {
      pc.close();
      console.log(`[Cleanup] Closed peer connection: ${id}`);
    });
    peerConnectionsRef.current.clear();

    // Close WebSocket gracefully
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "participant-left",
          peerId: myPeerIdRef.current,
          displayName,
        })
      );
      wsRef.current.close();
    }

    setLocalStream(null);
    setRemotePeers([]);
    setIsScreenSharing(false);
  }, [displayName]);

  // ---------------------------------------------------------------------------
  // 5. Initialise on mount — acquire media then open WebSocket
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const stream = await initLocalStream();
      if (!mounted) {
        // Component unmounted while awaiting getUserMedia — clean up immediately
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      initWebSocket(stream);
    };

    init();

    // CLEANUP on unmount — runs when user navigates away or component unmounts
    return () => {
      mounted = false;
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Empty dep array: we only initialise once per mount. cleanup ref is stable.

  // ---------------------------------------------------------------------------
  // 6. Controls
  // ---------------------------------------------------------------------------

  /** Toggle local microphone on/off */
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsAudioMuted((prev) => !prev);
  }, []);

  /**
   * Toggle local camera on/off.
   *
   * We use `track.enabled` (not `track.stop()`) so the track stays alive
   * in the MediaStream and can be re-enabled without acquiring a new stream.
   * Remote peers receive black frames when enabled=false; real video resumes
   * when enabled=true.
   *
   * The VideoGrid.tsx fix (adding isVideoOff to useEffect deps) ensures the
   * local <video> element re-attaches srcObject when toggling back on.
   */
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();
    if (!tracks.length) return;

    const nextEnabled = !tracks[0].enabled;
    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsVideoOff(!nextEnabled);
  }, []);

  const leaveCall = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // ---------------------------------------------------------------------------
  // 7. Screen Sharing
  // ---------------------------------------------------------------------------

  /**
   * shareScreen
   * -----------
   * Requests display media (screen/window/tab capture) via getDisplayMedia().
   * Replaces the video sender track in all active peer connections so remote
   * peers see the screen share instead of the camera.
   *
   * Design: We store the original camera stream so we can swap back when
   * screen sharing ends. We also attach the screen track's `onended` handler
   * (fired when the user clicks "Stop sharing" in the browser's native UI).
   */
  const shareScreen = useCallback(async () => {
    try {
      const screenStream = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia: (c?: DisplayMediaStreamOptions) => Promise<MediaStream>;
      }).getDisplayMedia({ video: true, audio: false });

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video sender on all active peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender && screenTrack) {
          sender.replaceTrack(screenTrack).catch((e) =>
            console.warn("[ScreenShare] replaceTrack failed:", e)
          );
        }
      });

      // Also update localStream state so VideoGrid shows the screen
      setLocalStream(screenStream);

      setIsScreenSharing(true);

      // Auto-stop when user clicks "Stop sharing" in the browser's native bar
      screenTrack.onended = () => {
        stopShareScreen();
      };
    } catch (err) {
      console.warn("[ScreenShare] getDisplayMedia cancelled or denied:", err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * stopShareScreen
   * ---------------
   * Stops the screen capture track and restores the camera track to all
   * peer connection senders via replaceTrack().
   */
  const stopShareScreen = useCallback(() => {
    // Stop the screen track
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    // Restore camera track to all peer connections
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack) {
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(cameraTrack).catch((e) =>
            console.warn("[ScreenShare] restoreTrack failed:", e)
          );
        }
      });
    }

    // Restore localStream to camera stream in state
    setLocalStream(localStreamRef.current);
    setIsScreenSharing(false);
  }, []);

  // ---------------------------------------------------------------------------
  // 8. Host-only broadcast commands
  // ---------------------------------------------------------------------------

  /**
   * Helper to send a host-action WS message.
   * The FastAPI signaling.py relays it to all other peers in the room.
   */
  const sendHostAction = useCallback(
    (payload: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "host-action", ...payload }));
      }
    },
    []
  );

  /** Mute all non-host participants' microphones */
  const muteAll = useCallback(() => {
    sendHostAction({ action: "mute-all" });
  }, [sendHostAction]);

  /** Stop all non-host participants' cameras */
  const stopAllVideo = useCallback(() => {
    sendHostAction({ action: "stop-all-video" });
  }, [sendHostAction]);

  /** Mute a specific participant's microphone */
  const mutePeer = useCallback(
    (peerId: string) => {
      sendHostAction({ action: "mute-peer", targetPeerId: peerId });
    },
    [sendHostAction]
  );

  /** Stop a specific participant's camera */
  const stopVideoPeer = useCallback(
    (peerId: string) => {
      sendHostAction({ action: "stop-video-peer", targetPeerId: peerId });
    },
    [sendHostAction]
  );

  /**
   * Transfer host role to another participant.
   * The receiving peer's onBecameHost() callback fires so the page can
   * update the role state. This is UI-only; the DB is not updated in this scope.
   */
  const makeHost = useCallback(
    (peerId: string) => {
      sendHostAction({ action: "make-host", targetPeerId: peerId });
      // Remove from local peers list (they are now host, not a controllable participant)
      // Optionally update RemotePeer state here if we track host status per peer
    },
    [sendHostAction]
  );

  /** Remove (kick) a specific participant from the room */
  const kickPeer = useCallback(
    (peerId: string) => {
      sendHostAction({ action: "kick", targetPeerId: peerId });
      // Also remove from local UI immediately
      const pc = peerConnectionsRef.current.get(peerId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(peerId);
      }
      setRemotePeers((prev) => prev.filter((p) => p.peerId !== peerId));
    },
    [sendHostAction]
  );

  /** Broadcast end-meeting signal to all participants in the room */
  const endMeetingForAll = useCallback(() => {
    sendHostAction({ action: "end-meeting" });
  }, [sendHostAction]);

  /** Send a chat message to all room participants */
  const sendChatMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const msgId = Math.random().toString(36).substring(2, 9);
      const payload = {
        type: "chat-message",
        id: msgId,
        sender: displayName,
        text: trimmed,
        timestamp,
        peerId: myPeerIdRef.current,
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }

      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          sender: displayName,
          text: trimmed,
          timestamp,
          isSelf: true,
        },
      ]);
    },
    [displayName]
  );

  /** Send an emoji reaction to all room participants */
  const sendReaction = useCallback(
    (emoji: string) => {
      const reactionId = Math.random().toString(36).substring(2, 9);
      const payload = {
        type: "reaction",
        id: reactionId,
        emoji,
        sender: displayName,
        peerId: myPeerIdRef.current,
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      } else {
        const reactionEvt: ReactionEvent = {
          id: reactionId,
          emoji,
          sender: displayName,
          peerId: myPeerIdRef.current,
          timestamp: Date.now(),
        };
        setReactions((prev) => [...prev, reactionEvt]);
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== reactionId));
        }, 3500);
      }
    },
    [displayName]
  );

  return {
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
  };
}
