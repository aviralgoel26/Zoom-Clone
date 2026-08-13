# 🎤 Interview Cheatsheet — Zoom Clone

> Comprehensive technical reference for code-walkthrough evaluation interviews.

---

## 1. Architecture & Design Choices

### Why Next.js 16 App Router + FastAPI?

**Next.js App Router** was chosen over Pages Router because:
- **Server Components** allow zero-JS metadata pages (SEO-friendly meeting invite pages)
- **File-based dynamic routing** (`/meeting/[id]`) cleanly maps to meeting codes without configuration
- **`"use client"` boundary** explicitly separates media API usage (camera/mic) from server-rendered content
- **Built-in TypeScript** eliminates a separate transpilation pipeline

**FastAPI** over Express/Django because:
- **Automatic OpenAPI docs** (`/docs`) — interviewer can test endpoints live
- **Pydantic v2 schemas** provide request validation and DTO generation in one declaration
- **`async def` WebSocket handlers** are non-blocking for the signaling relay
- **SQLAlchemy ORM** is database-agnostic — swap SQLite for PostgreSQL with one config change

### Why SQLite over PostgreSQL for this project?
- **Zero-config** — no Docker, no DSN setup required for evaluation
- **Single file** (`sql_app.db`) — easy to inspect, reset, and version
- **SQLAlchemy abstraction** — production migration is a one-line `DATABASE_URL` change

---

## 2. WebRTC & WebSocket Signaling — Deep Dive

### The 4-Step Connection Handshake

```
Step 1: Both browsers connect to  WS /ws/meeting/{meeting_id}

Step 2: Peer A sends "offer"
  Browser A: pc.createOffer() → pc.setLocalDescription(offer)
  A → WS: { type: "offer", sdp: offer.sdp, target: peerB_id }
  Server relays to Peer B.

Step 3: Peer B responds with "answer"
  Browser B: pc.setRemoteDescription(offer) → pc.createAnswer()
  B → WS: { type: "answer", sdp: answer.sdp, target: peerA_id }
  Server relays to Peer A.

Step 4: ICE candidate exchange (trickle ICE)
  Both sides: pc.onicecandidate → send { type: "ice-candidate", candidate }
  Server relays to the other peer.
  WebRTC engine finds the best P2P path (STUN).

Result: Direct peer-to-peer media stream established.
```

### Key implementation details in `useWebRTC.ts`

```typescript
// RTCPeerConnection config — Google STUN only (add TURN for production)
const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

// Add local tracks BEFORE creating offer (order matters!)
localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

// Trickle ICE — send candidates as they arrive
pc.onicecandidate = ({ candidate }) => {
  if (candidate) ws.send(JSON.stringify({ type: "ice-candidate", candidate }));
};

// Remote stream arrives via ontrack
pc.ontrack = ({ streams }) => setRemoteStream(streams[0]);
```

### Why Mesh Topology (not SFU)?
- **Suitable for ≤4 participants** — each browser sends to N-1 peers directly
- **No server media processing** — FastAPI is purely a signaling relay, zero media load
- **Drawback:** Upload bandwidth grows linearly (4 peers = 3 upstream video streams per client)
- **Production fix:** Replace with LiveKit SFU — each client sends ONE stream to the server, which selectively forwards

---

## 3. Database Schema Justification

### `users` table
```sql
email TEXT UNIQUE   -- Optional: guest users can join without email
hashed_password TEXT  -- bcrypt hash; NULL for guests created before auth
is_guest BOOLEAN      -- Guest users bypass users table entirely
```
**Design choice:** `user_id` on `participants` is **nullable** — this allows anonymous guests to join and be tracked without requiring a registered account.

### `meetings` table
```sql
meeting_code TEXT UNIQUE  -- e.g. "847-392-156"
host_id INTEGER REFERENCES users(id)  -- Nullable for backwards compat
status TEXT  -- "scheduled" | "active" | "ended"
scheduled_at DATETIME  -- NULL for instant meetings
```
**Design choice:** `meeting_code` is a separate formatted string (not the PK) so it can be human-readable and URL-safe while the PK is an auto-increment integer for join performance.

### `participants` table
```sql
user_id INTEGER REFERENCES users(id)  -- NULL = anonymous guest
role TEXT  -- "host" | "participant"
left_at DATETIME  -- NULL means still in meeting
```
**Design choice:** Dual-identity support. A registered user gets `user_id` linked; an anonymous guest gets `NULL`. The `display_name` is always stored so the participant panel always has a label.

---

## 4. State Management

### No Redux / Zustand — Why?
The app uses React's built-in `useState` + `useEffect` + `Context` because:
- **Meeting state is local to one room** — no cross-route state sharing needed
- **Auth state** is managed via `useAuth()` hook (context + localStorage)
- **Toast state** is managed via `useToast()` (context)
- Adding a global store would be premature complexity for this scope

### `useWebRTC` Hook Architecture
```typescript
// All WebRTC state lives in one custom hook
const {
  localStream,    // MediaStream from getUserMedia
  remotePeers,    // Array of { peerId, stream, displayName, isMuted, isVideoOff }
  isAudioMuted,   // Local audio track enabled state
  isVideoOff,     // Local video track enabled state
  isScreenSharing,
  messages,       // Chat messages received via WebSocket
  reactions,      // Recent emoji reactions with auto-expiry
  // Actions
  toggleAudio, toggleVideo, shareScreen,
  muteAll, kickPeer, makeHost,
  sendChatMessage, sendReaction,
} = useWebRTC({ meetingId, displayName, role });
```

**Key pattern:** The hook encapsulates ALL WebRTC + WebSocket logic. The page component is a pure orchestrator — it only passes props and handles routing.

---

## 5. Edge Cases Handled

### Backend Offline
```typescript
// All API fetches catch network errors and return safe defaults
export async function getUpcomingMeetings(userId?: number): Promise<Meeting[]> {
  try {
    return await apiFetch<Meeting[]>(`/api/meetings/upcoming`);
  } catch {
    return [];  // ← Dashboard still renders, shows empty state
  }
}
```

### Invalid Meeting Code
- Lobby phase validates against `GET /api/meetings/{code}` before showing join form
- If `valid: false`, renders dedicated error screen with "Back to Home" CTA
- If backend is unreachable, still allows entry (graceful degradation for demos)

### Camera Permission Rejected
```typescript
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
} catch {
  setLobbyVideoOn(false);  // ← Lobby shows avatar fallback, continues normally
}
```

### Audio Echo Prevention
```html
<!-- Local video element always has muted=true -->
<video ref={videoRef} autoPlay playsInline muted={isLocal} />
```
This prevents the local user from hearing their own microphone through the speakers.

### Meeting Code Collision
```python
def _generate_meeting_code() -> str:
    code = "".join(random.choices(string.digits, k=9))
    formatted = f"{code[:3]}-{code[3:6]}-{code[6:]}"
    # Retry until unique (astronomically rare collision)
    while get_meeting_by_code(db, formatted):
        code = _generate_meeting_code()
    return formatted
```

### `srcObject` Re-attachment on Camera Toggle
When video is toggled off and back on, the `<video>` element is unmounted/remounted. The `useEffect` with `[stream, isVideoOff]` dependency ensures `srcObject` is always re-attached to the correct live stream.

### Python 3.13 + passlib Incompatibility
`passlib` 1.7.4 triggers a `ValueError` with `bcrypt` 4.x on Python 3.13. Solution: bypass `passlib` entirely and use the native `bcrypt` library directly:
```python
import bcrypt
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
valid = bcrypt.checkpw(password.encode(), hashed)
```

---

## 6. Host Authorization Model

```
Flow:
  1. User clicks "New Meeting" on Dashboard
  2. API creates meeting, returns meeting_code
  3. Dashboard: router.push(`/meeting/${code}?host=true`)
                                              ^^^^^^^^^
                            Only this action appends ?host=true

  4. Lobby reads: isHostFromQuery = searchParams.get("host") === "true"
  5. role = isHostFromQuery ? "host" : "participant"   (immutable)
  6. Role is passed to useWebRTC → sent to signaling server → stored in participant DB record

Security guarantee: No UI element exists that lets a participant change their role.
Role transfer via "Make Host" sends a WebSocket message to the target peer's
onBecameHost() callback, which locally elevates that peer's role state.
```

---

## 7. Toast Notification System

```typescript
// Context-based, zero-dependency
const { showToast } = useToast();

// Usage across all components
showToast("Feature Coming Soon!", "Whiteboard is queued for next release.", "coming-soon");

// Toast types: info | success | warning | coming-soon
// Auto-dismisses after 3500ms with CSS slide-in animation
// Stack up to 4 toasts simultaneously
```

**Why context vs. event emitter?**
- Context integrates naturally with React's rendering lifecycle
- No global mutable state — toast state lives in `ToastProvider`
- TypeScript-safe — `showToast()` signature is fully typed

---

## 8. Production Scaling Roadmap

### Phase 1 — Database
```
SQLite → PostgreSQL
  - Change SQLALCHEMY_DATABASE_URL to postgres://...
  - Add Alembic for schema migrations
  - Add connection pooling (pgBouncer)
```

### Phase 2 — Media Scaling (Most Critical)
```
P2P Mesh → SFU with LiveKit
  - Each browser uploads ONE stream to LiveKit server
  - LiveKit selectively forwards to subscribers
  - Supports 100s of participants vs. ~4 for mesh
  - Simulcast: 3 quality layers (low/med/high) per sender
```

### Phase 3 — Real-Time Infrastructure
```
In-process WS dict → Redis pub/sub
  - Multiple FastAPI instances can share room state
  - WS messages published to Redis channel, subscribed by all instances
  - Enables horizontal scaling behind a load balancer
```

### Phase 4 — Auth & Security
```
localStorage JWT → HttpOnly cookie + refresh token
  - Eliminates XSS token theft vector
  - Refresh token rotation prevents replay attacks
  - Add rate limiting on /api/auth/* endpoints
```

### Phase 5 — Infrastructure
```
Single region → Multi-region
  - TURN servers per region (coturn)
  - CDN for static assets (Cloudflare/Vercel Edge)
  - Database read replicas per region
```

---

## 9. Quick Code Navigation Guide

| "Show me..." | File | Line range |
|---|---|---|
| WebRTC peer connection setup | `hooks/useWebRTC.ts` | Search `RTCPeerConnection` |
| JWT token generation | `backend/app/auth_utils.py` | `create_access_token()` |
| Meeting code generation | `backend/app/crud.py` | `_generate_meeting_code()` |
| WebSocket signaling relay | `backend/app/routers/signaling.py` | `websocket_endpoint()` |
| Host auth enforcement | `app/meeting/[id]/page.tsx` | L71-92 |
| User-scoped meeting query | `backend/app/crud.py` | `get_upcoming_meetings()` |
| Toast system | `components/ui/Toast.tsx` | Full file |
| Speaker view layout | `components/VideoGrid.tsx` | `viewMode === "speaker"` block |
| Duration timer | `app/meeting/[id]/page.tsx` | `durationSecs` state + useEffect |

---

## 10. Common Interview Questions & Answers

**Q: How does WebRTC work without a media server?**
> Browsers use the ICE framework (with STUN) to discover their public IP and negotiate a direct P2P path. The server only relays SDP offer/answer and ICE candidates — no media touches it.

**Q: What happens if NAT blocks direct P2P?**
> STUN fails for symmetric NAT (common on corporate networks). Production fix: add TURN servers (coturn) that relay media as a fallback. This project uses STUN only for simplicity.

**Q: How would you secure the WebSocket endpoint?**
> Validate the JWT token from the initial HTTP upgrade request header. Reject WS connections without a valid Bearer token. Rate-limit connection attempts per IP.

**Q: Why not use a library like Socket.io instead of raw WebSockets?**
> Raw WebSockets keep the dependency surface minimal and make the signaling protocol transparent for evaluation. Socket.io adds reconnection, rooms, and namespaces — all useful in production but unnecessary complexity here.

**Q: How does the meeting duration timer work?**
> When `phase` transitions to `"meeting"`, a `setInterval` starts incrementing `durationSecs` every 1000ms. The `formatDuration()` function converts total seconds to `MM:SS` (or `HH:MM:SS` after 1 hour). The cleanup function clears the interval when the component unmounts or phase changes.

**Q: What's the difference between Grid View and Speaker View?**
> Grid View uses CSS `grid` with adaptive column counts (1/2/2×2/3-col) based on participant count. Speaker View renders one large tile (flex-1, takes remaining height) and a horizontal scrollable strip of 144×96px thumbnail tiles for all other participants.
