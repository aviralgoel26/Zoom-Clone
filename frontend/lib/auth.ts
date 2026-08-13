/**
 * auth.ts
 * -------
 * Frontend authentication API client, session helpers, and custom useAuth hook.
 *
 * Session stored in localStorage:
 *   zoom_clone_token  — JWT string
 *   zoom_clone_user   — JSON-serialised { id, display_name, email }
 */

import { useState, useEffect, useCallback } from "react";

const RAW_API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const API = RAW_API_URL.endsWith("/api")
  ? RAW_API_URL.slice(0, -4)
  : RAW_API_URL;

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

const TOKEN_KEY = "zoom_clone_token";
const USER_KEY  = "zoom_clone_user";

// ---------------------------------------------------------------------------
// Event dispatcher for reactive auth state across components
// ---------------------------------------------------------------------------
function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("zoom_auth_change"));
  }
}

export function saveSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthChange();
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthChange();
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

// ---------------------------------------------------------------------------
// React Hook for Auth State Syncing
// ---------------------------------------------------------------------------
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUser = useCallback(async () => {
    const storedUser = getStoredUser();
    const token = getStoredToken();
    if (storedUser && token) {
      setUser(storedUser);
      try {
        const freshUser = await getMe(token);
        setUser(freshUser);
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      } catch {
        clearSession();
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    syncUser();
    const handleEvent = () => syncUser();
    window.addEventListener("zoom_auth_change", handleEvent);
    return () => window.removeEventListener("zoom_auth_change", handleEvent);
  }, [syncUser]);

  return { user, loading, syncUser };
}
