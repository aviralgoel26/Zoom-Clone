"""
websocket_manager.py
--------------------
Manages WebSocket connections grouped by meeting room.

Architecture:
  active_rooms: dict[str, list[WebSocket]]
    key   = meeting_id (string)
    value = list of currently connected WebSocket clients in that room
  ws_to_peer_id: dict[WebSocket, str]
    maps each WebSocket instance to its client string peerId (e.g. "peer-x72q9a1")

The server acts ONLY as a signaling broker — it relays JSON payloads
between peers. Raw audio/video data is never handled here; it flows
directly between browsers via WebRTC P2P.
"""

import json
import logging
from typing import Dict, List, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # Maps meeting_id → list of active WebSocket connections in that room.
        self.active_rooms: Dict[str, List[WebSocket]] = {}
        # Maps websocket instance → client peerId string (e.g. "peer-abc1234")
        self.ws_to_peer_id: Dict[WebSocket, str] = {}

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

    def register_peer_id(self, websocket: WebSocket, peer_id: str) -> None:
        """Associate a WebSocket connection with its client-side string peerId."""
        if peer_id and isinstance(peer_id, str):
            self.ws_to_peer_id[websocket] = peer_id

    def get_peer_id(self, websocket: WebSocket) -> str:
        """Get string peerId for a websocket instance."""
        return self.ws_to_peer_id.get(websocket, str(id(websocket)))

    def disconnect(self, websocket: WebSocket, meeting_id: str) -> str:
        """
        Remove the connection from the room.
        Returns the registered peer_id string so it can be broadcast to remaining peers.
        """
        peer_id = self.ws_to_peer_id.pop(websocket, str(id(websocket)))
        if meeting_id in self.active_rooms:
            self.active_rooms[meeting_id] = [
                ws for ws in self.active_rooms[meeting_id] if ws != websocket
            ]
            if not self.active_rooms[meeting_id]:
                del self.active_rooms[meeting_id]
                logger.info(f"[WS] Room {meeting_id} is now empty, removed.")
        return peer_id

    async def broadcast(
        self,
        message: dict,
        meeting_id: str,
        sender: WebSocket,
    ) -> None:
        """
        Send a JSON message to all peers in the room EXCEPT the sender.
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
        """Send to ALL connections including the original sender."""
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
