"""
websocket_manager.py
--------------------
Manages WebSocket connections grouped by meeting room.

Architecture:
  active_rooms: dict[str, list[WebSocket]]
    key   = meeting_id (string)
    value = list of currently connected WebSocket clients in that room

The server acts ONLY as a signaling broker — it relays JSON payloads
between peers. Raw audio/video data is never handled here; it flows
directly between browsers via WebRTC P2P.

Supported message types (relayed transparently):
  - "offer"           : SDP offer from caller → callee
  - "answer"          : SDP answer from callee → caller
  - "ice-candidate"   : ICE candidate exchange (trickle ICE)
  - "participant-joined" : Notify room of new arrival
  - "participant-left"   : Notify room of departure
  - "host-action"     : Host-initiated controls (mute-all, kick)
"""

import json
import logging
from typing import Dict, List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # Maps meeting_id → list of active WebSocket connections in that room.
        self.active_rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, meeting_id: str) -> None:
        """Accept the connection and add it to the correct room."""
        await websocket.accept()
        if meeting_id not in self.active_rooms:
            self.active_rooms[meeting_id] = []
        self.active_rooms[meeting_id].append(websocket)
        logger.info(
            f"[WS] Client joined room {meeting_id}. "
            f"Total peers: {len(self.active_rooms[meeting_id])}"
        )

    def disconnect(self, websocket: WebSocket, meeting_id: str) -> None:
        """Remove the connection from the room. Clean up empty rooms."""
        if meeting_id in self.active_rooms:
            self.active_rooms[meeting_id] = [
                ws for ws in self.active_rooms[meeting_id] if ws != websocket
            ]
            if not self.active_rooms[meeting_id]:
                del self.active_rooms[meeting_id]
                logger.info(f"[WS] Room {meeting_id} is now empty, removed.")

    async def broadcast(
        self,
        message: dict,
        meeting_id: str,
        sender: WebSocket,
    ) -> None:
        """
        Send a JSON message to all peers in the room EXCEPT the sender.
        This is the core signaling relay — one peer's offer becomes
        another peer's offer notification.
        """
        if meeting_id not in self.active_rooms:
            return
        payload = json.dumps(message)
        for connection in self.active_rooms[meeting_id]:
            if connection != sender:
                try:
                    await connection.send_text(payload)
                except Exception as e:
                    logger.warning(f"[WS] Failed to send to peer: {e}")

    async def broadcast_to_all(self, message: dict, meeting_id: str) -> None:
        """Send to ALL connections including the original sender (e.g., room state sync)."""
        if meeting_id not in self.active_rooms:
            return
        payload = json.dumps(message)
        for connection in self.active_rooms[meeting_id]:
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"[WS] Failed to broadcast: {e}")

    def get_peer_count(self, meeting_id: str) -> int:
        """How many WebSocket clients are currently in the room."""
        return len(self.active_rooms.get(meeting_id, []))


# Singleton instance shared across all router modules.
manager = ConnectionManager()
