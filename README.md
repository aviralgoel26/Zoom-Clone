# Zoom Web App Clone

A full-stack video conferencing application mimicking Zoom Workplace, built for a 1-day SDE Hiring Assessment.

---

## System Architecture

### REST Flow
```
Browser (Next.js :3000)
        │
        │  HTTP REST (fetch / axios)
        ▼
FastAPI Server (:8000)
        │
        │  SQLAlchemy ORM
        ▼
  SQLite (sql_app.db)
```

### Real-Time Media Flow
```
Browser A                    FastAPI (Signaling Only)              Browser B
   │                                   │                               │
   │──── WS connect (/ws/meeting/id) ──►│                               │
   │                                   │◄── WS connect ────────────────│
   │                                   │                               │
   │──── { type: "offer", sdp } ──────►│──── relay to B ──────────────►│
   │                                   │                               │
   │◄─── { type: "answer", sdp } ──────│◄─── from B ───────────────────│
   │                                   │                               │
   │◄─── ICE candidates ───────────────│◄─── ICE candidates ────────── │
   │                                   │                               │
   │◄════════════ WebRTC P2P Media (Audio/Video) ═══════════════════► │
                  (Direct browser-to-browser, server not involved)
```

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Next.js 16, TypeScript, Tailwind CSS, Lucide React |
| Backend    | Python 3.11+, FastAPI, Uvicorn      |
| Database   | SQLite via SQLAlchemy ORM           |
| Real-Time  | WebRTC (P2P Mesh) + WebSocket (Signaling) |
| STUN       | stun:stun.l.google.com:19302        |

---

## Local Setup Instructions

### Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.10+ and **pip**

---

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python seed.py          # Seed demo data (optional)
uvicorn app.main:app --reload --port 8000
```

API: http://localhost:8000 | Swagger: http://localhost:8000/docs

---

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:3000

---

### 3. Dual-Browser Verification

1. **Browser A (Host)**: Open `http://localhost:3000` → Click **"New Meeting"** → Enter name → **Join Meeting**
   - You are automatically the host (the `?host=true` URL param is appended by the New Meeting button)
2. **Browser B (Guest)**: Open a new incognito window → Paste the meeting URL → Enter `Guest User` → **Join Meeting**
   - You join as a participant (no `?host=true` in the URL)
3. **Verify**:
   - Both video tiles appear in the grid
   - Audio/video toggles work — camera turns off/on without freezing
   - Participant list shows both users with green/red mic+video indicators
   - Host sees **"Mute All"** and **"Stop All Video"** buttons in the participant panel
   - Host sees a **⋮ action menu** (Mute Mic, Stop Video, Remove, Make Host) per participant
   - **Share Screen** (green button) in the toolbar opens screen picker
   - **More (...)** menu opens popover with Breakout Rooms, Whiteboards, Settings, Stop Incoming Video

---

## Host Authorization Model

Host assignment is a two-layer security model:

### Layer 1 — URL Parameter
The `?host=true` query param is the **only** mechanism that grants host role. It is appended exclusively by the "New Meeting" dashboard action:

```typescript
// dashboard page.tsx — handleNewMeeting()
router.push(`/meeting/${meeting.meeting_code}?host=true`);
```

Anyone joining via a shared link, Meeting ID input, or the meetings list never gets `?host=true` and joins as `participant`.

### Layer 2 — No UI Escalation
The lobby **role selector** (the host/participant toggle buttons) has been **completely removed**. There is no client-side control that lets a participant self-assign host.

### Role Transfer
The host can transfer their role to any participant via the Participant List `⋮` → "Make Host". This sends a WebSocket `host-action: make-host` message. The receiving peer's `onBecameHost()` callback fires and updates the role state, making host controls visible. (DB update is deferred for production.)

---

## Database Schema

```
users
  id (PK), display_name, email (nullable), is_guest, created_at

meetings
  id (PK), meeting_code (UNIQUE), title, description
  host_id (FK → users.id, nullable)
  status (scheduled|active|ended)
  scheduled_at (nullable), duration_minutes, created_at

participants
  id (PK), meeting_id (FK → meetings.id)
  user_id (FK → users.id, NULLABLE — guest support)
  display_name, role (host|participant)
  joined_at, left_at (nullable)
```

---

## Key Design Assumptions

1. **Mesh Topology** — Every peer connects directly to every other peer. Suitable for ≤4 participants. For larger meetings, an SFU (Selective Forwarding Unit) like mediasoup would be used.

2. **Guest Users** — `Participant.user_id` is nullable. Guests bypass the `users` table entirely; only their `display_name` is stored on the participant record.

3. **Single Region** — No geographic load balancing. All users connect to one FastAPI server.

4. **SQLite** — Chosen for zero-config local development. For production, swap `SQLALCHEMY_DATABASE_URL` to a PostgreSQL connection string; no other code changes needed (SQLAlchemy abstracts the dialect).

5. **No Authentication** — The app uses a "trust-on-entry" model. A real app would add JWT auth via FastAPI's OAuth2PasswordBearer.

6. **STUN Only** — For production, add TURN servers to handle symmetric NAT cases where direct P2P is blocked.

---

## Project Structure

```
zoom-clone/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry + CORS + startup
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models.py            # ORM models (User, Meeting, Participant)
│   │   ├── schemas.py           # Pydantic v2 DTOs
│   │   ├── crud.py              # DB access layer
│   │   ├── websocket_manager.py # Room-based WS connection manager
│   │   └── routers/
│   │       ├── meetings.py      # REST /api/meetings/*
│   │       └── signaling.py     # WS /ws/meeting/{id} + host-action relay
│   ├── seed.py                  # Demo data seeder
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── layout.tsx           # Root layout + metadata
│   │   ├── globals.css          # Design tokens + global styles
│   │   ├── page.tsx             # Dashboard (3 cards, Join modal)
│   │   ├── meeting/[id]/page.tsx # Lobby (no role selector) + Meeting room
│   │   └── schedule/page.tsx    # Schedule form
│   ├── components/
│   │   ├── DashboardHeader.tsx
│   │   ├── VideoGrid.tsx        # Fixed srcObject re-attach on camera toggle
│   │   ├── ControlsBar.tsx      # Share Screen + More popover
│   │   ├── ParticipantList.tsx  # Stop All Video + per-row ⋮ menus
│   │   └── MeetingHealth.tsx
│   ├── hooks/
│   │   └── useWebRTC.ts         # Full host controls + screen sharing
│   ├── lib/
│   │   └── api.ts
│   └── .env.local
├── README.md
└── INTERVIEW_CHEATSHEET.md
```
