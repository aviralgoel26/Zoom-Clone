# 🎥 Zoom Workplace Clone

> A full-stack, pixel-perfect video conferencing web application built to demonstrate production-grade engineering skills — WebRTC, FastAPI, SQLite, Next.js App Router, and real-time WebSocket signaling.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://python.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)](https://sqlite.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P_Mesh-FF6B35)](https://webrtc.org/)

---

## 🔗 Links

| | URL |
|---|---|
| **Live Demo** | _Deploy to Vercel (frontend) + Render (backend)_ |
| **GitHub** | https://github.com/aviralgoel26/Zoom-Clone |
| **Swagger UI** | http://localhost:8000/docs (when running locally) |

---

## ✨ Features

| Feature | Status | Details |
|---|---|---|
| **Instant Meeting** | ✅ | Generates unique `XXX-XXX-XXX` meeting code, routes host directly into room |
| **Join Meeting** | ✅ | Modal with meeting ID validation against backend before allowing entry |
| **Schedule Meeting** | ✅ | Full form with title, date/time, duration — persisted to SQLite |
| **User Authentication** | ✅ | JWT-based sign up / sign in with bcrypt password hashing |
| **Video Grid** | ✅ | Responsive: 1→2→2×2→3-col adaptive grid based on participant count |
| **Speaker View** | ✅ | Large primary tile (75%) + horizontal thumbnail strip |
| **Audio / Video Toggle** | ✅ | Mic and camera on/off with live stream track enabling/disabling |
| **Screen Sharing** | ✅ | `getDisplayMedia()` — share entire screen or app window |
| **Emoji Reactions** | ✅ | 7 emoji reactions broadcast via WebSocket, floating overlay + tile badge |
| **Chat** | ✅ | In-meeting chat drawer with real-time WebSocket messaging |
| **Participant List** | ✅ | Host controls: Mute All, Remove, Make Host, per-participant ⋮ menus |
| **Host Authorization** | ✅ | URL-param only (`?host=true`) — no client-side role escalation |
| **Meeting Duration Timer** | ✅ | Count-up `MM:SS` / `HH:MM:SS` displayed in meeting top bar |
| **Coming-Soon Toast** | ✅ | Zoom-styled animated notifications for unbuilt modules |
| **User-scoped Meetings** | ✅ | Dashboard shows only the logged-in user's meetings from DB |
| **Connection Health** | ✅ | Live ICE connection state badge |
| **Low-bandwidth Mode** | ✅ | Stop Incoming Video toggle hides all remote feeds |

---

## 🏗️ Architecture

### System Topology
```
Browser A (Next.js :3000)
    │
    │  HTTP REST (fetch)           WebSocket (signaling only)
    ▼                                         ▼
FastAPI Server (:8000) ◄─────────────────────────────────────
    │                                         │
    │  SQLAlchemy ORM                         │  Room-scoped WS manager
    ▼                                         ▼
SQLite (sql_app.db)                 Browser B (Next.js :3000)

         ┌────────────────────────────────────────┐
         │       WebRTC P2P Media (after signal)   │
         │     Audio + Video flows peer-to-peer    │
         │   (FastAPI server NOT in media path)    │
         └────────────────────────────────────────┘
```

### WebRTC Signaling Flow
```
Browser A                    FastAPI (WS relay)              Browser B
   │                               │                               │
   │── WS connect (/ws/meeting/id)►│                               │
   │                               │◄── WS connect ───────────────│
   │                               │                               │
   │── { type: "offer", sdp } ────►│──── relay to B ─────────────►│
   │                               │                               │
   │◄── { type: "answer", sdp } ───│◄─── from B ──────────────────│
   │                               │                               │
   │◄── ICE candidates ────────────│◄─── ICE candidates ──────────│
   │                               │                               │
   │◄═══════════ WebRTC P2P Media (Direct P2P) ════════════════════│
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | Next.js 16 (App Router) | SSR/CSR hybrid, file-based routing |
| **Language** | TypeScript 5 | Type safety across all components |
| **Styling** | Tailwind CSS v4 | Utility-first, Zoom design tokens |
| **Icons** | Lucide React | Consistent SVG icon system |
| **Backend** | Python FastAPI | REST API + WebSocket signaling |
| **ORM** | SQLAlchemy 2.0 | Database abstraction layer |
| **Database** | SQLite | Zero-config local persistence |
| **Auth** | JWT (PyJWT) + bcrypt | Stateless authentication |
| **Real-Time** | WebRTC (P2P Mesh) | Audio/video media transport |
| **Signaling** | WebSocket (FastAPI) | SDP offer/answer + ICE relay |
| **STUN** | stun.l.google.com:19302 | NAT traversal for P2P connections |

---

## 🗄️ Database Schema

```sql
-- Registered & guest user profiles
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name  TEXT    NOT NULL,
  email         TEXT    UNIQUE,
  hashed_password TEXT,
  is_guest      BOOLEAN DEFAULT FALSE,
  created_at    DATETIME DEFAULT (datetime('now'))
);

-- Meeting records (instant + scheduled)
CREATE TABLE meetings (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_code     TEXT    UNIQUE NOT NULL,    -- e.g. "847-392-156"
  title            TEXT    NOT NULL,
  description      TEXT,
  host_id          INTEGER REFERENCES users(id),
  status           TEXT    DEFAULT 'scheduled', -- scheduled|active|ended
  scheduled_at     DATETIME,                   -- NULL for instant meetings
  duration_minutes INTEGER DEFAULT 60,
  created_at       DATETIME DEFAULT (datetime('now'))
);

-- Participant join/leave records
CREATE TABLE participants (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id   INTEGER NOT NULL REFERENCES meetings(id),
  user_id      INTEGER REFERENCES users(id),   -- NULL = anonymous guest
  display_name TEXT    NOT NULL,
  role         TEXT    DEFAULT 'participant',  -- host|participant
  joined_at    DATETIME DEFAULT (datetime('now')),
  left_at      DATETIME                        -- NULL = still in meeting
);
```

### Entity Relationships
```
users ──┬── hosts ──► meetings ──── participants ◄── users (optional)
        │                                │
        └── joins ──────────────────────┘
                (user_id nullable for guests)
```

---

## 🚀 Local Setup

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.10+ and pip

---

### 1. Clone the Repository
```bash
git clone https://github.com/aviralgoel26/Zoom-Clone.git
cd Zoom-Clone
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start the API server (auto-reloads on file changes)
python -m uvicorn app.main:app --reload --port 8000 --host 127.0.0.1
```

- REST API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- SQLite DB file auto-created at `backend/sql_app.db`

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

- App: http://localhost:3000

### 4. Environment (already configured)
```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### 5. Multi-Browser Verification

1. **Browser A (Host)** → `http://localhost:3000` → **New Meeting** → Enter name → **Join Meeting**
   - Host badge appears; host controls (End Meeting, Mute All) are visible
2. **Browser B (Participant)** → Open incognito → Paste the meeting URL → Enter `Guest User` → **Join Meeting**
   - Both video tiles appear in the grid
3. **Verify features**:
   - Audio/video toggles — camera turns off/on without freezing
   - **Share Screen** — green button opens system screen picker
   - **Reactions** — emoji appears in floating overlay for both users
   - **Chat** — messages sync in real time via WebSocket
   - **Speaker View** toggle — switches between grid and large+thumbnails layout
   - **Duration timer** — counts up from `00:00` in the top bar
   - **Sidebar icons** (ZoomMate, Chat, Hub) → Zoom-styled "Coming Soon" toast appears

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user → returns JWT + user |
| `POST` | `/api/auth/login` | Sign in → returns JWT + user |
| `GET` | `/api/auth/me` | Get current user from Bearer token |

### Meetings
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/meetings/instant` | Create instant meeting (status=active) |
| `POST` | `/api/meetings/schedule` | Create scheduled meeting (status=scheduled) |
| `GET` | `/api/meetings/upcoming?user_id=N` | Upcoming meetings for user |
| `GET` | `/api/meetings/recent?user_id=N` | Recent/ended meetings for user |
| `GET` | `/api/meetings/{code}` | Validate meeting code before joining |
| `POST` | `/api/meetings/{id}/join` | Record participant entry |
| `POST` | `/api/meetings/{id}/leave/{pid}` | Record participant exit |
| `POST` | `/api/meetings/{id}/end` | Mark meeting as ended (host) |

### WebSocket
| Endpoint | Description |
|---|---|
| `WS /ws/meeting/{meeting_id}` | Signaling: offer/answer/ICE relay + host-actions |

---

## 📁 Project Structure

```
zoom-clone/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry, CORS, startup
│   │   ├── database.py          # SQLAlchemy engine + session factory
│   │   ├── models.py            # ORM models: User, Meeting, Participant
│   │   ├── schemas.py           # Pydantic v2 request/response DTOs
│   │   ├── crud.py              # DB access layer (all queries here)
│   │   ├── auth_utils.py        # bcrypt hashing + JWT encode/decode
│   │   ├── websocket_manager.py # Room-scoped WS connection manager
│   │   └── routers/
│   │       ├── auth.py          # POST /api/auth/*
│   │       ├── meetings.py      # REST /api/meetings/*
│   │       └── signaling.py     # WS /ws/meeting/{id}
│   ├── view_db.py               # SQLite inspection helper
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── layout.tsx           # Root layout + ToastProvider
│   │   ├── globals.css          # Design tokens + global animations
│   │   ├── page.tsx             # Dashboard: clock, actions, meetings
│   │   ├── meeting/[id]/page.tsx # Lobby + Live meeting room
│   │   └── schedule/page.tsx    # Schedule meeting form
│   ├── components/
│   │   ├── ui/Toast.tsx         # Toast context + useToast() hook
│   │   ├── AppShell.tsx         # Sidebar + Header layout wrapper
│   │   ├── DashboardHeader.tsx  # Top bar + Auth modal (Zoom-styled)
│   │   ├── Sidebar.tsx          # Left nav (Coming-Soon toasts)
│   │   ├── VideoGrid.tsx        # Grid + Speaker view layouts
│   │   ├── ControlsBar.tsx      # Meeting bottom toolbar
│   │   ├── ParticipantList.tsx  # Host controls side panel
│   │   ├── ChatPanel.tsx        # In-meeting chat drawer
│   │   └── MeetingHealth.tsx    # ICE connection state badge
│   ├── hooks/
│   │   └── useWebRTC.ts         # WebRTC peer management + signaling
│   ├── lib/
│   │   ├── api.ts               # REST API helpers
│   │   └── auth.ts              # JWT storage + useAuth() hook
│   └── .env.local               # NEXT_PUBLIC_API_URL
├── README.md
└── INTERVIEW_CHEATSHEET.md
```

---

## 🔐 Security Model

### Host Authorization
Host role is assigned **exclusively** via the `?host=true` URL query parameter, which is only appended by the `handleNewMeeting()` dashboard action. No UI control allows a participant to self-elevate.

```typescript
// Only this code appends ?host=true
router.push(`/meeting/${meeting.meeting_code}?host=true`);

// Lobby derives role from URL — immutable
const role: "host" | "participant" = isHostFromQuery ? "host" : "participant";
```

### Password Security
- Passwords hashed with `bcrypt` (cost factor 12) via Python's native `bcrypt` library
- JWT tokens expire after 7 days; stored in `localStorage`
- `passlib` intentionally avoided due to Python 3.13 incompatibility with bcrypt 4.x

---

## ⚡ Performance Notes

| Scenario | Behavior |
|---|---|
| Backend offline | All API calls return `[]` gracefully; meeting room falls back to local code generation |
| Invalid meeting code | Lobby shows error screen with "Back to Home" — never enters room |
| Camera permission denied | Camera off state shown with avatar fallback — meeting continues |
| WebRTC ICE failure | Connection health badge shows degraded state; audio still attempts via STUN |
| >4 participants | Grid switches to 3-column layout; for >9 consider SFU (see Scaling below) |

---

## 🚀 Scaling to Production

| Current (Dev) | Production Recommendation |
|---|---|
| SQLite | PostgreSQL (swap `SQLALCHEMY_DATABASE_URL`) |
| P2P Mesh WebRTC | SFU: [LiveKit](https://livekit.io/) or [mediasoup](https://mediasoup.org/) |
| STUN only | Add TURN servers (coturn) for symmetric NAT |
| In-process WS manager | Redis pub/sub for multi-instance signaling |
| `localStorage` JWT | HttpOnly cookie + refresh token rotation |
| Single region | CDN + edge compute (Cloudflare Workers) |
