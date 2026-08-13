"use client";

/**
 * DashboardHeader.tsx
 * --------------------
 * Authentic Zoom Workplace Top Navigation Bar and Authentication Suite.
 *
 * Features:
 * - Real-time JWT auth state sync via `useAuth` hook.
 * - Zoom Workplace desktop styled Sign In / Sign Up modal with tab switcher & SSO options.
 * - Rich profile dropdown with status selector (Available, Away, DND), account tier, and logout.
 */

import { useState } from "react";
import {
  Search,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Plus,
  LogOut,
  User,
  Settings,
  X,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import {
  login,
  register,
  saveSession,
  clearSession,
  useAuth,
} from "@/lib/auth";

export default function DashboardHeader() {
  const { user: currentUser, loading: isLoadingAuth } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // Presence status state
  const [userStatus, setUserStatus] = useState<"Available" | "Away" | "Do Not Disturb">("Available");
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Modal & dropdown state
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  // Form fields
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UX feedback
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const initials = currentUser
    ? currentUser.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const openModal = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthError("");
    setEmailInput("");
    setPasswordInput("");
    setDisplayNameInput("");
    setShowPassword(false);
    setShowAuthModal(true);
  };

  const closeModal = () => {
    setShowAuthModal(false);
    setAuthError("");
  };

  const handleSignOut = () => {
    clearSession();
    setShowProfileMenu(false);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      let response;
      if (authMode === "signin") {
        response = await login(emailInput.trim(), passwordInput);
      } else {
        if (!displayNameInput.trim()) {
          setAuthError("Display name is required");
          setAuthLoading(false);
          return;
        }
        response = await register(
          displayNameInput.trim(),
          emailInput.trim(),
          passwordInput
        );
      }
      saveSession(response.access_token, response.user);
      closeModal();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAuthLoading(false);
    }
  };

  const statusColors = {
    Available: "bg-[#34C759]",
    Away: "bg-[#FF9500]",
    "Do Not Disturb": "bg-[#FF3B30]",
  };

  return (
    <>
      <header
        id="dashboard-header"
        className="fixed top-0 right-0 z-40 flex items-center justify-between px-6 bg-white border-b border-[#E2E4E8] select-none"
        style={{ left: "64px", height: "56px" }}
      >
        {/* ── Left Corner: Logo ─────────────────────────────── */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-lg font-extrabold text-[#0E71EB] tracking-tight">zoom</span>
          <span className="text-sm font-semibold text-[#131619] tracking-tight">Workplace</span>
        </div>

        {/* ── Center Navigation & Search ────────────────────── */}
        <div className="flex items-center gap-3 flex-1 max-w-xl mx-8 justify-center">
          <div className="flex items-center gap-1 flex-shrink-0 text-[#6E7683]">
            <button
              id="header-nav-back"
              aria-label="Go back"
              onClick={() => window.history.back()}
              className="p-1.5 rounded-lg hover:bg-[#F4F5F7] hover:text-[#131619] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id="header-nav-forward"
              aria-label="Go forward"
              onClick={() => window.history.forward()}
              className="p-1.5 rounded-lg hover:bg-[#F4F5F7] hover:text-[#131619] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              id="header-nav-history"
              aria-label="Reload"
              onClick={() => window.location.reload()}
              className="p-1.5 rounded-lg hover:bg-[#F4F5F7] hover:text-[#131619] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center w-full max-w-md bg-[#EBECEF] rounded-full px-3.5 py-1.5 gap-2.5 border border-transparent focus-within:border-[#0E71EB] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0E71EB]/20 transition-all">
            <Search className="w-4 h-4 text-[#6E7683] flex-shrink-0" />
            <input
              id="dashboard-search"
              type="text"
              placeholder="Search (Ctrl+E)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-[#131619] placeholder-[#6E7683] focus:outline-none border-none p-0"
            />
          </div>

          <button
            id="header-add-btn"
            aria-label="Create new"
            className="p-1.5 rounded-lg hover:bg-[#F4F5F7] text-[#6E7683] hover:text-[#131619] transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* ── Right Corner: Actions & Profile/Auth ──────────── */}
        <div className="flex items-center gap-3.5 flex-shrink-0">
          <button
            id="header-upgrade-btn"
            className="bg-[#0E71EB] hover:bg-[#0B5EC4] text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs hover:shadow-sm"
          >
            Upgrade
          </button>
          <button
            id="header-notifications"
            aria-label="Notifications"
            className="relative p-2 rounded-full hover:bg-[#F4F5F7] text-[#6E7683] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF3B30] border-2 border-white" />
          </button>
          <button
            id="header-calendar"
            aria-label="Calendar"
            className="relative p-2 rounded-full hover:bg-[#F4F5F7] text-[#6E7683] transition-colors cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
          </button>

          {/* Profile or Sign In/Up */}
          {isLoadingAuth ? (
            <div className="w-8 h-8 rounded-full bg-[#EBECEF] animate-pulse" />
          ) : currentUser ? (
            <div className="relative ml-1">
              <button
                id="header-profile-btn"
                onClick={() => setShowProfileMenu((v) => !v)}
                className="relative flex items-center justify-center p-0.5 rounded-full hover:opacity-90 transition-opacity cursor-pointer"
                title={`${currentUser.display_name} (${currentUser.email})`}
                aria-label="User Profile"
              >
                <div className="w-8 h-8 rounded-full bg-[#0E71EB] flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  {initials}
                </div>
                <span className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full ${statusColors[userStatus]} border-2 border-white`} />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#E2E4E8] py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-[#E2E4E8]">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#131619] truncate">{currentUser.display_name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0E71EB]/10 text-[#0E71EB]">
                        BASIC (FREE)
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6E7683] truncate mt-0.5">{currentUser.email}</p>

                    {/* Status dropdown toggle */}
                    <div className="relative mt-2.5">
                      <button
                        onClick={() => setShowStatusMenu((v) => !v)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-[#E2E4E8] hover:bg-[#F4F5F7] text-xs transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${statusColors[userStatus]}`} />
                          <span className="font-semibold text-[#131619] text-xs">{userStatus}</span>
                        </div>
                        <span className="text-[10px] text-[#6E7683]">▼</span>
                      </button>

                      {showStatusMenu && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-[#E2E4E8] rounded-xl shadow-lg py-1 z-60">
                          {(["Available", "Away", "Do Not Disturb"] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                setUserStatus(s);
                                setShowStatusMenu(false);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-[#F4F5F7] flex items-center gap-2 cursor-pointer"
                            >
                              <span className={`w-2 h-2 rounded-full ${statusColors[s]}`} />
                              <span className="text-[#131619]">{s}</span>
                              {userStatus === s && <CheckCircle2 className="w-3.5 h-3.5 text-[#0E71EB] ml-auto" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => setShowProfileMenu(false)}
                      className="w-full px-4 py-2 text-left text-xs text-[#131619] hover:bg-[#F4F5F7] flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-[#6E7683]" /> My Profile
                    </button>
                    <button
                      onClick={() => setShowProfileMenu(false)}
                      className="w-full px-4 py-2 text-left text-xs text-[#131619] hover:bg-[#F4F5F7] flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#6E7683]" /> Settings & Preferences
                    </button>
                  </div>
                  <div className="border-t border-[#E2E4E8] pt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-xs text-[#FF3B30] hover:bg-[#FFF0F0] flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-1">
              <button
                id="header-signin-btn"
                onClick={() => openModal("signin")}
                className="px-3.5 py-1.5 border border-[#0E71EB] text-[#0E71EB] hover:bg-[#0E71EB]/8 text-xs font-semibold rounded-full transition-all cursor-pointer"
              >
                Sign In
              </button>
              <button
                id="header-signup-btn"
                onClick={() => openModal("signup")}
                className="px-4 py-1.5 bg-[#0E71EB] hover:bg-[#0B5EC4] text-white text-xs font-semibold rounded-full transition-all cursor-pointer shadow-xs hover:shadow-sm"
              >
                Sign Up Free
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Zoom Workplace Premium Auth Suite Modal ──────────────── */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E2E4E8] animate-in fade-in zoom-in-95 duration-200">
            {/* Top Brand Banner */}
            <div className="bg-[#0E71EB] px-7 pt-7 pb-6 text-white relative">
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold tracking-tight">zoom</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 uppercase tracking-wide">
                  Workplace
                </span>
              </div>
              <p className="text-xs text-white/80 mt-1 font-medium">
                One platform to connect, collaborate, and innovate.
              </p>

              {/* Segmented Auth Mode Switcher Tabs */}
              <div className="mt-5 bg-black/15 p-1 rounded-2xl flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError("");
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    authMode === "signin"
                      ? "bg-white text-[#0E71EB] shadow-sm"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError("");
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    authMode === "signup"
                      ? "bg-white text-[#0E71EB] shadow-sm"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  Sign Up Free
                </button>
              </div>
            </div>

            {/* Modal Form Container */}
            <form onSubmit={handleAuthSubmit} className="px-7 py-6 space-y-4">

              {authMode === "signup" && (
                <div>
                  <label className="block text-xs font-semibold text-[#131619] mb-1.5">
                    Display Name
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 w-4 h-4 text-[#8E95A2] pointer-events-none z-10" />
                    <input
                      id="auth-display-name"
                      type="text"
                      required={authMode === "signup"}
                      placeholder="e.g. Aviral Goel"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      autoComplete="name"
                      className="w-full pl-10 pr-3.5 py-3 text-sm rounded-2xl border border-[#D0D5DD] focus:border-[#0E71EB] focus:ring-4 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition placeholder-[#9EA6B3]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#131619] mb-1.5">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 w-4 h-4 text-[#8E95A2] pointer-events-none z-10" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    autoComplete="email"
                    className="w-full pl-10 pr-3.5 py-3 text-sm rounded-2xl border border-[#D0D5DD] focus:border-[#0E71EB] focus:ring-4 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition placeholder-[#9EA6B3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#131619] mb-1.5">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 w-4 h-4 text-[#8E95A2] pointer-events-none z-10" />
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder={authMode === "signup" ? "At least 6 characters" : "••••••••"}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                    className="w-full pl-10 pr-10 py-3 text-sm rounded-2xl border border-[#D0D5DD] focus:border-[#0E71EB] focus:ring-4 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition placeholder-[#9EA6B3]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 text-[#8E95A2] hover:text-[#555] transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="bg-[#FFF0F0] border border-[#FFD0D0] text-[#CC0000] text-xs rounded-2xl px-4 py-3 font-medium flex items-center gap-2.5 animate-in fade-in">
                  <span className="w-2 h-2 rounded-full bg-[#CC0000] flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                id="auth-submit-btn"
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-[#0E71EB] hover:bg-[#0B5EC4] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 mt-2"
              >
                {authLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : authMode === "signin" ? (
                  "Sign In to Zoom"
                ) : (
                  "Create Free Account"
                )}
              </button>

              {/* SSO Divider */}
              <div className="relative py-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E2E4E8]" />
                </div>
                <span className="relative px-3 bg-white text-[11px] font-semibold text-[#8E95A2] uppercase tracking-wider">
                  or continue with
                </span>
              </div>

              {/* Social / SSO Auth Buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => alert("SSO login requires enterprise identity provider configuration.")}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 border border-[#D0D5DD] rounded-xl hover:bg-[#F4F5F7] text-xs font-semibold text-[#131619] transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-[#0E71EB]" />
                  SSO
                </button>
                <button
                  type="button"
                  onClick={() => alert("Google OAuth integration requires client ID setup.")}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 border border-[#D0D5DD] rounded-xl hover:bg-[#F4F5F7] text-xs font-semibold text-[#131619] transition cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.28v3.15C3.25 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.28C.46 8.2.005 10.05.005 12s.455 3.8 1.275 5.42l4-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.58l4 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  Google
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
