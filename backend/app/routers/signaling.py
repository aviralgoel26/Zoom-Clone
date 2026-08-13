"""
signaling.py  (router)
----------------------
WebSocket endpoint acting as the signaling server for WebRTC.

The server is a pure relay — it NEVER inspects or modifies the SDP/ICE
payloads; it only routes messages between the correct browser peers.

Endpoint: ws://localhost:8000/ws/meeting/{meeting_id}

Message flow (simplified Mesh topology):
  1. Peer A connects → server calls manager.connect()
  2. Server broadcasts "participant-joined" to all existing peers in room
  3. Existing peers initiate createOffer() → send { type: "offer", sdp, target }
  4. Peer A receives offer → createAnswer() → sends { type: "answer", sdp, target }
  5. Both peers exchange ICE candidates via { type: "ice-candidate", candidate }
  6. WebRTC P2P connection established — media flows directly between browsers
  7. On disconnect → server broadcasts "participant-left" to remaining peers

HOST AUTHORIZATION MODEL:
  Role assignment is enforced at two layers:

  1. URL Layer (primary): The "New Meeting" dashboard action appends ?host=true
     to the meeting URL. The Next.js lobby page reads this param to set role.
     No UI control allows a participant to self-assign "host" — the role
     selector was removed from the lobby screen entirely.

  2. Database Layer: When a participant calls POST /api/meetings/{id}/join,
     the `role` field is taken directly from the URL-derived value in the
     frontend. The Participant row in SQLite stores the authoritative role.
     The WebSocket signaling layer does NOT validate roles — it is a
     transparent relay. For production, role should be validated on WS connect
     by querying the DB: check that the peerId matches a Participant row with
     role=host before relaying any host-action messages.

SUPPORTED WebSocket MESSAGE TYPES:
  ┌──────────────────────┬─────────────────────────────────────────────────┐
  │ type                 │ description                                     │
  ├──────────────────────┼─────────────────────────────────────────────────┤
  │ offer                │ SDP offer from caller → callee (relayed to all) │
  │ answer               │ SDP answer from callee → caller                 │
  │ ice-candidate        │ ICE candidate exchange (trickle ICE)            │
  │ participant-joined   │ New peer announces arrival → triggers offers    │
  │ participant-left     │ Peer leaving gracefully → clean up video tiles  │
  │ host-action          │ Host-initiated control broadcast (see below)    │
  └──────────────────────┴─────────────────────────────────────────────────┘

HOST-ACTION MESSAGE SCHEMA:
  { "type": "host-action", "action": <str>, "targetPeerId"?: <str> }

  Supported action values:
  ┌────────────────────┬─────────────────┬────────────────────────────────┐
  │ action             │ targetPeerId    │ effect on receiving peer       │
  ├────────────────────┼─────────────────┼────────────────────────────────┤
  │ "mute-all"         │ (none)          │ Mutes all participants' mics   │
  │ "stop-all-video"   │ (none)          │ Disables all participants' cams│
  │ "mute-peer"        │ required        │ Mutes one specific peer's mic  │
  │ "stop-video-peer"  │ required        │ Stops one specific peer's cam  │
  │ "kick"             │ required        │ Ejects peer → redirect to /    │
  │ "make-host"        │ required        │ Transfers host role to peer    │
  └────────────────────┴─────────────────┴────────────────────────────────┘

  All host-action messages are broadcast to ALL other peers in the room via
  manager.broadcast(). Each client inspects (action, targetPeerId) to decide
  whether to act. The sender (host) is excluded from their own broadcast.

  Relay Flow:
    Host browser          FastAPI signaling         Participant browser
         │                        │                          │
         │── {type:"host-action", │                          │
         │    action:"mute-all"}──►│                          │
         │                        │──── relay (broadcast) ──►│
         │                        │                          │ track.enabled=false
         │                        │                          │ setIsAudioMuted(true)
"""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["signaling"])


@router.websocket("/ws/meeting/{meeting_id}")
async def websocket_signaling(websocket: WebSocket, meeting_id: str):
    """
    Persistent WebSocket connection for one participant in a meeting room.

    Steps:
      1. Accept connection & register in room.
      2. Notify existing peers of the new arrival.
      3. Listen for signaling messages in a loop.
      4. Relay each message to the appropriate peer(s).
      5. On disconnect, notify remaining peers and clean up.
    """
    # Step 1 — Accept and register
    await manager.connect(websocket, meeting_id)
    peer_count = manager.get_peer_count(meeting_id)
    logger.info(f"[WS] New connection in room {meeting_id}. Peers now: {peer_count}")

    try:
        # Step 2 — Inform the new peer how many others are in the room
        # (Frontend uses this to know whether to initiate offers.)
        await websocket.send_text(
            json.dumps({"type": "room-info", "peerCount": peer_count - 1})
        )

        # Step 3 — Relay loop: receive → inspect type → broadcast
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning(f"[WS] Non-JSON message received, ignoring.")
                continue

            # Register peerId mapping if present in message
            peer_id_in_msg = message.get("peerId") or message.get("fromPeerId")
            if peer_id_in_msg:
                manager.register_peer_id(websocket, str(peer_id_in_msg))

            # Step 4 — Route message based on type
            if msg_type in ("offer", "answer", "ice-candidate"):
                target_peer = message.get("targetPeerId")
                if target_peer:
                    sent = await manager.send_to_peer(message, str(target_peer))
                    if not sent:
                        await manager.broadcast(message, meeting_id, sender=websocket)
                else:
                    await manager.broadcast(message, meeting_id, sender=websocket)

            elif msg_type in ("participant-joined", "name-update"):
                await manager.broadcast(message, meeting_id, sender=websocket)

            elif msg_type == "participant-left":
                await manager.broadcast(message, meeting_id, sender=websocket)

            elif msg_type == "host-action":
                action = message.get("action", "unknown")
                logger.info(
                    f"[WS] host-action '{action}' in room {meeting_id}"
                )
                if action == "end-meeting":
                    await manager.broadcast_to_all(message, meeting_id)
                else:
                    await manager.broadcast(message, meeting_id, sender=websocket)

            elif msg_type == "chat-message":
                await manager.broadcast(message, meeting_id, sender=websocket)

            elif msg_type == "reaction":
                logger.info(
                    f"[WS] reaction '{message.get('emoji')}' in room {meeting_id}"
                )
                await manager.broadcast_to_all(message, meeting_id)

            else:
                logger.warning(f"[WS] Unknown message type: {msg_type}")

    except WebSocketDisconnect:
        # Step 5 — Clean up on abrupt disconnect (tab close, refresh, network drop)
        left_peer_id = manager.disconnect(websocket, meeting_id)
        await manager.broadcast_to_all(
            {"type": "participant-left", "peerId": left_peer_id},
            meeting_id,
        )
        logger.info(f"[WS] Client {left_peer_id} disconnected from room {meeting_id}.")
