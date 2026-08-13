# Interview Cheatsheet — Zoom Clone

This document provides line-by-line explanations of the most complex files
and answers to the questions an evaluator is most likely to ask.

---

## 1. `useWebRTC.ts` — Line-by-Line

### `getUserMedia`
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: { echoCancellation: true, noiseSuppression: true },
});
```
- **What**: Requests the browser to open the camera and microphone.
- **Why constraints**: `ideal` means "use 720p if the hardware supports it, otherwise fall back". `echoCancellation` uses the browser's built-in DSP to prevent feedback loops.
- **Returns**: A `MediaStream` object containing one video `MediaStreamTrack` and one audio `MediaStreamTrack`.

### `createOffer`
```typescript
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
```
- **What**: Generates an SDP (Session Description Protocol) document that describes our local media capabilities (codecs, resolutions, audio channels).
- **Why `setLocalDescription` immediately**: This triggers ICE candidate gathering. The browser starts probing local and STUN-derived network addresses so they can be relayed to the remote peer.
- **Flow**: We then send this SDP over the WebSocket so the remote peer knows what we can support.

### `setRemoteDescription` + `createAnswer`
```typescript
await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
```
- **What**: The callee receives the offer, stores it as the "remote" description, then generates an answer (its own SDP) and sends it back.
- **Why both sides set descriptions**: RTCPeerConnection needs both sides' SDP to negotiate a common codec and format. The "offer/answer" handshake is defined in RFC 3264.

### `addIceCandidate`
```typescript
await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
```
- **What**: Adds a network address + port discovered via ICE to the peer connection.
- **Trickle ICE**: Instead of waiting for all candidates before sending the offer, we send candidates as they're discovered (trickle). This makes connection setup 2–3× faster.
- **Error handling**: We wrap in try/catch because candidates can arrive before `setRemoteDescription` completes, causing benign "InvalidStateError" that must not crash the app.

### `ontrack`
```typescript
pc.ontrack = ({ streams }) => {
  const [remoteStream] = streams;
  setRemotePeers((prev) => [...prev, { peerId, stream: remoteStream, ... }]);
};
```
- **What**: Fires when the remote peer's tracks arrive. `streams[0]` is the `MediaStream` that contains the peer's audio and video tracks.
- **Why destructure streams**: Each track can belong to multiple streams. We always use `streams[0]` — the first/only stream associated with this track.
- **Effect**: We store the `MediaStream` in React state → `VideoGrid` attaches it to a `<video srcObject={stream} />` element.

### Track Cleanup (CRITICAL)
```typescript
localStreamRef.current?.getTracks().forEach((track) => {
  track.stop();
});
```
- **What**: `track.stop()` signals the browser that we're done using the hardware. The OS then releases the camera and mic.
- **Why mandatory**: Without this, the camera LED stays on (hardware still "in use"), and the next call to `getUserMedia` throws `NotReadableError: Device already in use`.
- **When called**: In the `useEffect` cleanup return function (component unmount) AND in `handleLeave` (explicit leave action).

---

## 2. Camera Toggle — `MediaStreamTrack.enabled` vs `replaceTrack` (NEW)

### The Black Box Bug and Fix

**Root cause**: The `<video>` element in `VideoTile` is conditionally rendered:
```tsx
{!isVideoOff && stream ? <video ref={videoRef} ... /> : <AvatarFallback />}
```
When `isVideoOff` goes `false → true → false`, the `<video>` element **unmounts** and then **remounts** as a brand-new DOM node. Its `srcObject` is `null` on remount.

The original `useEffect([stream])` would not re-fire because the stream reference never changed — only `isVideoOff` did. Result: **black box**.

**Fix** (`VideoGrid.tsx`):
```typescript
useEffect(() => {
  if (videoRef.current && stream && !isVideoOff) {
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
  }
}, [stream, isVideoOff]);  // <-- isVideoOff added to deps
```
Adding `isVideoOff` to the dependency array ensures the effect runs when camera toggles back ON, re-attaching `srcObject` to the newly mounted `<video>` element.

### `track.enabled` vs `replaceTrack` — When to Use Which

| Method | Use Case | Behaviour |
|--------|----------|-----------|
| `track.enabled = false` | Toggle camera/mic on/off | Track stays in stream; sends black/silent frames. Cheap — no renegotiation. |
| `track.enabled = true` | Re-enable camera/mic | Track resumes sending real frames. Remote peers automatically see it resume. |
| `replaceTrack(newTrack)` | Screen share / camera swap | Swaps the track in all RTCRtpSenders. Triggers ICE renegotiation. Required when the track object changes. |

**Camera toggle**: We use `track.enabled` because the track object stays the same.
**Screen sharing**: We use `replaceTrack()` because `getDisplayMedia()` returns a brand-new track object.

```typescript
// Screen share — replace video track on all peer connections
peerConnectionsRef.current.forEach((pc) => {
  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  sender?.replaceTrack(screenTrack);
});

// Stop screen share — restore camera track
peerConnectionsRef.current.forEach((pc) => {
  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  sender?.replaceTrack(cameraTrack);
});
```

---

## 3. Host Authorization — URL-Param Lock (NEW)

### The Problem: Client-Side Role Escalation
Before the fix, the lobby showed explicit `[Host] [Participant]` toggle buttons. Any user could self-assign "host" before joining, gaining full host controls (Mute All, kick, etc.) over other participants.

### The Fix: Two-Layer Authorization

**Layer 1 — URL Parameter (Frontend)**
```typescript
// dashboard/page.tsx — handleNewMeeting() — THE ONLY place ?host=true is added
router.push(`/meeting/${meeting.meeting_code}?host=true`);

// meeting/[id]/page.tsx — role is read-only from URL
const isHostFromQuery = searchParams.get("host") === "true";
const role: "host" | "participant" = isHostFromQuery ? "host" : "participant";
// ↑ const — no setState, no UI control can change this
```

**Layer 2 — UI Removal**
```tsx
{/* REMOVED — the role selector no longer exists in the lobby */}
{/* {([\"host\", \"participant\"] as const).map(...)} */}
```

The role selector buttons are gone. The lobby now shows an informational badge only:
```tsx
{isHostFromQuery && (
  <div className="text-[#FF9500]">
    <Shield /> You are the Host
  </div>
)}
```

**Why this works**: `?host=true` is only ever appended by the "New Meeting" button. Shared meeting links never contain it. Participants joining via ID or link get `role = "participant"` unconditionally.

**Production hardening** (beyond this scope): Validate role on WebSocket connect by querying the DB — check that the joining display name matches a Participant row with `role=host` before relaying any host-action messages from that connection.

---

## 4. WebSocket Broadcast Host Commands (NEW)

### Message Schema
```typescript
// Sent by host browser → FastAPI → all other peers
{
  type: "host-action",
  action: "mute-all" | "stop-all-video" | "mute-peer" | "stop-video-peer" | "kick" | "make-host",
  targetPeerId?: string  // required for peer-specific actions
}
```

### Relay Flow
```
Host Browser           FastAPI signaling.py              Participant Browser
     │                          │                                │
     │── {type:"host-action", ──►│                                │
     │    action:"mute-all"}     │── manager.broadcast() ────────►│
     │                          │   (excludes sender)            │ ws.onmessage fires
     │                          │                                │
     │                          │                                │ if action === "mute-all":
     │                          │                                │   track.enabled = false
     │                          │                                │   setIsAudioMuted(true)
```

### Handler Table
```typescript
// useWebRTC.ts — ws.onmessage handler
if (type === "host-action") {
  const action = message.action;
  const targetPeerId = message.targetPeerId;

  if (action === "mute-all") {
    // Apply to self — no targetPeerId check (affects all non-hosts)
    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
    setIsAudioMuted(true);

  } else if (action === "stop-all-video") {
    localStream.getVideoTracks().forEach(t => { t.enabled = false; });
    setIsVideoOff(true);

  } else if (action === "mute-peer" && targetPeerId === myPeerIdRef.current) {
    // Only act if WE are the specific target
    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
    setIsAudioMuted(true);

  } else if (action === "stop-video-peer" && targetPeerId === myPeerIdRef.current) {
    localStream.getVideoTracks().forEach(t => { t.enabled = false; });
    setIsVideoOff(true);

  } else if (action === "kick" && targetPeerId === myPeerIdRef.current) {
    cleanup();  // Stop all tracks, close WS
    window.location.href = "/";  // Redirect to dashboard

  } else if (action === "make-host" && targetPeerId === myPeerIdRef.current) {
    onBecameHost?.();  // Callback → setMutableRole("host") in page
  }
}
```

### FastAPI Relay (`signaling.py`)
```python
elif msg_type == "host-action":
    # Pure relay — no validation at this layer.
    # All peers in the room receive this; each client self-filters by targetPeerId.
    await manager.broadcast(message, meeting_id, sender=websocket)
```
The server is intentionally stateless for signaling — it doesn't need to know who the host is because the frontend enforces role via the URL param and the DB stores the authoritative role.

---

## 5. FastAPI WebSocket Connection Management — Line-by-Line

### `manager.connect`
```python
await websocket.accept()
self.active_rooms[meeting_id].append(websocket)
```
- **`accept()`**: Completes the HTTP → WebSocket upgrade handshake. Without this, the browser gets a 403.
- **`active_rooms`**: A plain Python `dict[str, list[WebSocket]]`. We chose a dict (not a DB table) because WebSocket objects are in-process memory constructs — they can't be serialised to a DB.

### `manager.broadcast`
```python
for connection in self.active_rooms[meeting_id]:
    if connection != sender:
        await connection.send_text(payload)
```
- **Why exclude sender**: Signaling messages (offer, ICE) are addressed TO the other peers. Sending them back to the sender would create an echo/loop.
- **Why async**: `send_text` is an async operation over a TCP socket. Using `await` yields control back to the event loop while the OS flushes the buffer.

### `WebSocketDisconnect` exception handler
```python
except WebSocketDisconnect:
    manager.disconnect(websocket, meeting_id)
    await manager.broadcast_to_all({"type": "participant-left", ...}, meeting_id)
```
- **What**: `WebSocketDisconnect` is raised by Starlette when the client closes the connection (tab close, network drop, or graceful `ws.close()`).
- **Why broadcast**: Remaining peers need to remove the disconnected peer's video tile and close their RTCPeerConnection to that peer, freeing resources.

---

## 6. SQLAlchemy ORM Relations — `models.py`

### `relationship` declarations
```python
# On User model:
hosted_meetings = relationship("Meeting", back_populates="host")
participations = relationship("Participant", back_populates="user")

# On Meeting model:
host = relationship("User", back_populates="hosted_meetings")
participants = relationship("Participant", back_populates="meeting")
```
- **`back_populates`**: Bidirectional sync. Setting `meeting.host = alice` automatically sets `alice.hosted_meetings` to include that meeting.
- **Lazy loading**: By default SQLAlchemy uses lazy loading — related objects are fetched only when accessed. For API responses, we use Pydantic serialisation which triggers the load.

### `nullable=True` on `Participant.user_id`
```python
user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
```
- **Why**: Guest users have no row in the `users` table. If `nullable=False`, inserting a guest participant would raise `IntegrityError: NOT NULL constraint failed`.
- **Trade-off**: We lose referential integrity for guest rows, but gain zero-friction guest onboarding — matching Zoom's real behaviour.

---

## 7. FAQ — Evaluator Questions

### "Why did you separate signaling from video transport?"

**Answer**: WebRTC mandates this separation by design. Signaling (offer/answer/ICE) is a one-time, low-bandwidth JSON handshake that requires a reliable, ordered channel — WebSocket is perfect. Video/audio are high-bandwidth, latency-sensitive continuous streams — they use UDP-based SRTP directly between browsers. Mixing them would mean routing GB/s of media through our server, making it unscalable. Keeping signaling separate means our FastAPI server handles only a few KB of JSON per meeting, regardless of video quality.

### "Why choose SQLite over PostgreSQL for this scope?"

**Answer**: Three reasons: (1) **Zero infrastructure** — no separate DB server process to manage during a 1-day assessment; (2) **SQLAlchemy abstracts the dialect** — switching to PostgreSQL requires only changing `SQLALCHEMY_DATABASE_URL` from `sqlite:///./sql_app.db` to `postgresql://user:pass@host/db`; no SQL or model changes needed; (3) **SQLite is production-grade** for read-heavy, low-concurrency workloads (up to ~1000 concurrent readers). For write-heavy production, PostgreSQL's WAL and MVCC would be necessary.

### "How does your system handle guest users vs host users?"

**Answer**: The system uses a hybrid model. Registered users have a row in the `users` table with a persistent `id`. When they join a meeting, `Participant.user_id` is set to their id. Guest users skip account creation entirely — they provide only a `display_name` in the lobby. The `Participant` row is created with `user_id=NULL` (enforced by `nullable=True` on the FK column). In the WebSocket signaling layer, every participant — registered or guest — is identified by an ephemeral `peerId` (a random string like `peer-a3f9b2`) that exists only for the duration of the WebSocket connection. This means guests get a full real-time meeting experience with zero sign-up friction, mirroring Zoom's actual "Join without account" feature.

### "How do you prevent a participant from self-assigning host privileges?"

**Answer**: Two layers. First, the lobby UI role selector has been completely removed — there are no controls for a user to choose their role. Second, the host role is derived solely from `?host=true` in the URL, which is only ever appended by the "New Meeting" dashboard action. Joining via a shared link, a Meeting ID, or the meetings list never adds this param. The flow: `Dashboard "New Meeting" click → createInstantMeeting() → router.push('/meeting/${code}?host=true')`. This is the only code path that results in host=true. For production hardening, the WebSocket connect handler would cross-check the connecting peer against the `participants` DB table to validate their claimed role before relaying any `host-action` messages from them.

### "What are the limitations of WebRTC Mesh topology?"

**Answer**: In a mesh, every peer establishes a direct connection to every other peer. With N participants: each peer uploads N-1 streams and downloads N-1 streams. **Bandwidth complexity is O(N²)**. In practice:
- 2 peers: 2 connections, manageable on any connection
- 4 peers: 6 connections, ~6× the bandwidth of a 1:1 call
- 8 peers: 28 connections — typically hits bandwidth limits on consumer connections (~50 Mbps upload)

**Real Zoom's solution**: Uses an SFU (Selective Forwarding Unit — e.g., mediasoup, Janus). The SFU receives one upload per participant and selectively forwards streams to viewers, reducing client upload to 1× regardless of N. It also enables simulcast (sending multiple quality layers) and spotlight features. Our mesh is appropriate for the 2–4 participant assessment scenario.

### "How would you add authentication?"

**Answer**: Use FastAPI's built-in OAuth2 support. Add a `POST /auth/login` endpoint that validates credentials and returns a JWT signed with a secret key (using `python-jose`). All protected routes add `current_user: User = Depends(get_current_user)` where `get_current_user` decodes the JWT from the `Authorization: Bearer <token>` header. On the frontend, store the token in `httpOnly` cookies (not `localStorage` — XSS-safe) and include it in all API requests.

### "Walk me through what happens when a second browser joins."

**Answer**:
1. Browser B navigates to `/meeting/847-392-156`, passes lobby, enters meeting phase.
2. `useWebRTC` opens a WebSocket to `/ws/meeting/847-392-156` and sends `{ type: "participant-joined", peerId: "peer-xyz", displayName: "Bob" }`.
3. The FastAPI `broadcast()` relays this to Browser A's WebSocket.
4. Browser A's `onmessage` handler receives `participant-joined`, calls `createPeerConnection("peer-xyz", "Bob")`, then calls `createOffer()` and `setLocalDescription()`.
5. ICE gathering starts on Browser A. The offer SDP is sent to the WS server: `{ type: "offer", sdp: {...}, fromPeerId: "peer-abc" }`.
6. FastAPI relays to Browser B. Browser B calls `setRemoteDescription(offer)`, then `createAnswer()`, `setLocalDescription(answer)`.
7. The answer is relayed back to Browser A via FastAPI. Browser A calls `setRemoteDescription(answer)`.
8. Both browsers exchange ICE candidates via WS (trickle ICE).
9. ICE negotiation succeeds. DTLS/SRTP secure channel is established directly between the two browsers.
10. Browser A's `ontrack` fires with Browser B's MediaStream → state update → `VideoGrid` renders a new `<video>` tile for Bob.

### "How does screen sharing work technically?"

**Answer**: Screen sharing uses `getDisplayMedia()` (a separate browser API from `getUserMedia`) to capture the screen/window/tab. The resulting `MediaStreamTrack` replaces the camera track in all active `RTCRtpSender` objects via `replaceTrack()`. This forces renegotiation on the P2P connection so the remote peer starts receiving screen content instead of camera video. When screen sharing stops, we call `replaceTrack()` again with the original camera track. We also handle the browser's native "Stop sharing" button via `screenTrack.onended`, which fires when the user clicks Stop in the browser UI bar.
