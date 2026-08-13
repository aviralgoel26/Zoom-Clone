/**
 * auth.ts
 * -------
 * Frontend authentication API client and session helpers.
 *
 * Session stored in localStorage:
 *   zoom_clone_token  — JWT string
 *   zoom_clone_user   — JSON-serialised { id, display_name, email }
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface AuthUser {
  id: number;
  display_name: string;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------
const TOKEN_KEY = "zoom_clone_token";
const USER_KEY  = "zoom_clone_user";

export function saveSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------
export async function register(
  displayName: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName, email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail ?? "Registration failed");
  }
  return data as AuthResponse;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail ?? "Login failed");
  }
  return data as AuthResponse;
}

export async function getMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Token invalid or expired");
  return (await res.json()) as AuthUser;
}
