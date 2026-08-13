/**
 * api.ts
 * ------
 * Centralised API helper — all REST calls to the FastAPI backend live here.
 *
 * Design:
 *  - BASE_URL is read from NEXT_PUBLIC_API_URL env var with a localhost:8000 fallback.
 *  - Automatically normalizes trailing slashes and /api suffix so endpoints work seamlessly.
 *  - apiFetch wraps fetch with structured error logging.
 */

const RAW_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const ensureProtocol = (url: string): string => {
  if (!url) return "http://localhost:8000";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
};

// If NEXT_PUBLIC_API_URL contains trailing /api, strip it so /api/meetings paths don't duplicate
const SANITIZED_URL = RAW_BASE_URL.endsWith("/api")
  ? RAW_BASE_URL.slice(0, -4)
  : RAW_BASE_URL;

const BASE_URL = ensureProtocol(SANITIZED_URL);

// ---------------------------------------------------------------------------
// Types (mirroring backend Pydantic schemas)
// ---------------------------------------------------------------------------
export interface Meeting {
  id: number;
  meeting_code: string;
  title: string;
  description: string | null;
  host_id: number | null;
  status: "scheduled" | "active" | "ended";
  scheduled_at: string | null;
  duration_minutes: number | null;
  created_at: string;
}

export interface Participant {
  id: number;
  meeting_id: number;
  user_id: number | null;
  display_name: string;
  role: "host" | "participant";
  joined_at: string;
  left_at: string | null;
}

export interface MeetingValidationResponse {
  valid: boolean;
  meeting_id?: number;
  title?: string;
  status?: string;
  meeting_code?: string;
}

// ---------------------------------------------------------------------------
// Helper — fail-safe fetch with graceful offline handling
// ---------------------------------------------------------------------------

/**
 * apiFetch
 * --------
 * Performs a typed REST call to the FastAPI backend.
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${BASE_URL}${cleanPath}`;
  let res: Response;

  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (networkErr) {
    console.warn(`[API] Failed to fetch from ${url}:`, networkErr);
    throw networkErr;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    const err = new Error(`API Error: ${res.status} ${res.statusText} — ${body}`);
    console.warn(`[API] ${err.message}`);
    throw err;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Meeting endpoints
// ---------------------------------------------------------------------------

/** Create an instant meeting and return its data (including meeting_code). */
export async function createInstantMeeting(
  title = "Instant Meeting",
  hostId?: number
): Promise<Meeting> {
  return apiFetch<Meeting>("/api/meetings/instant", {
    method: "POST",
    body: JSON.stringify({ title, host_id: hostId ?? null }),
  });
}

/** Schedule a future meeting. */
export async function scheduleMeeting(payload: {
  title: string;
  description?: string;
  scheduled_at: string; // ISO 8601
  duration_minutes?: number;
  host_id?: number;
}): Promise<Meeting> {
  return apiFetch<Meeting>("/api/meetings/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Check if a meeting code is valid before allowing entry. */
export async function validateMeeting(
  code: string
): Promise<MeetingValidationResponse> {
  return apiFetch<MeetingValidationResponse>(`/api/meetings/${code}`);
}

/**
 * Fetch upcoming scheduled meetings for the dashboard.
 * Pass userId to get only meetings hosted by or joined by that user.
 * Returns an empty array if the backend is offline so the UI degrades gracefully.
 */
export async function getUpcomingMeetings(userId?: number): Promise<Meeting[]> {
  try {
    const qs = userId != null ? `?user_id=${userId}` : "";
    return await apiFetch<Meeting[]>(`/api/meetings/upcoming${qs}`);
  } catch {
    console.warn("[API] getUpcomingMeetings: backend offline — returning []");
    return [];
  }
}

/**
 * Fetch recent (ended / active) meetings for the dashboard.
 * Pass userId to get only meetings hosted by or joined by that user.
 * Returns an empty array if the backend is offline.
 */
export async function getRecentMeetings(userId?: number): Promise<Meeting[]> {
  try {
    const qs = userId != null ? `?user_id=${userId}` : "";
    return await apiFetch<Meeting[]>(`/api/meetings/recent${qs}`);
  } catch {
    console.warn("[API] getRecentMeetings: backend offline — returning []");
    return [];
  }
}

export interface NotificationItem {
  id: string;
  meeting_id: number;
  meeting_code: string;
  title: string;
  scheduled_at: string | null;
  message: string;
  time_until: string;
  urgency: "imminent" | "soon" | "upcoming";
}

/**
 * Fetch meeting notifications & reminders for the user.
 */
export async function getMeetingNotifications(userId?: number): Promise<NotificationItem[]> {
  try {
    const qs = userId != null ? `?user_id=${userId}` : "";
    return await apiFetch<NotificationItem[]>(`/api/meetings/notifications${qs}`);
  } catch {
    console.warn("[API] getMeetingNotifications: backend offline — returning []");
    return [];
  }
}


/** Record a participant joining a meeting. Returns the Participant record. */
export async function joinMeeting(
  meetingId: number,
  displayName: string,
  role: "host" | "participant" = "participant",
  userId?: number
): Promise<Participant> {
  return apiFetch<Participant>(`/api/meetings/${meetingId}/join`, {
    method: "POST",
    body: JSON.stringify({
      display_name: displayName,
      role,
      user_id: userId ?? null,
    }),
  });
}

/** Record a participant leaving (sets left_at timestamp). */
export async function leaveMeeting(
  meetingId: number,
  participantId: number
): Promise<Participant> {
  return apiFetch<Participant>(
    `/api/meetings/${meetingId}/leave/${participantId}`,
    { method: "POST" }
  );
}

/** Host ends the entire meeting (status → ended). */
export async function endMeeting(meetingId: number): Promise<Meeting> {
  return apiFetch<Meeting>(`/api/meetings/${meetingId}/end`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// WebSocket URL builder
// ---------------------------------------------------------------------------

/**
 * buildWebSocketUrl
 * -----------------
 * Constructs the correct WebSocket URI for the signaling server.
 */
export function buildWebSocketUrl(meetingId: string): string {
  if (typeof window === "undefined") return "";

  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsHost =
    process.env.NEXT_PUBLIC_WS_URL ||
    BASE_URL.replace(/^https?:\/\//, "") ||
    "localhost:8000";

  // If host includes protocol (e.g. ws://localhost:8000), strip protocol
  const cleanHost = wsHost.replace(/^wss?:\/\//, "");

  return `${wsProtocol}://${cleanHost}/ws/meeting/${meetingId}`;
}
