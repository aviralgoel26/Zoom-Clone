"use client";

/**
 * DashboardHeader.tsx
 * --------------------
 * Top navigation bar — Zoom Workplace style.
 * Auth is fully integrated via `useAuth` hook for real-time state synchronization.
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
                <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#34C759] border-2 border-white" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-[#E2E4E8] py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2.5 border-b border-[#E2E4E8]">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#34C759]" />
                      <span className="text-xs font-semibold text-[#131619]">Available</span>
                    </div>
                    <p className="text-xs font-bold text-[#131619] truncate">{currentUser.display_name}</p>
                    <p className="text-[11px] text-[#6E7683] truncate">{currentUser.email}</p>
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
                      <Settings className="w-3.5 h-3.5 text-[#6E7683]" /> Settings
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

      {/* ── Auth Modal (Sign In / Sign Up) ───────────────────── */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E2E4E8]">
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-[#0E71EB]">zoom</span>
                <span className="text-sm font-semibold text-[#131619]">
                  {authMode === "signin" ? "Sign In" : "Sign Up Free"}
                </span>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-[#F4F5F7] text-[#6E7683] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAuthSubmit} className="px-6 py-5 space-y-4">
              {authMode === "signup" && (
                <div>
                  <label className="block text-xs font-medium text-[#6E7683] mb-1.5">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9EA6B3]" />
                    <input
                      id="auth-display-name"
                      type="text"
                      required={authMode === "signup"}
                      placeholder="Your full name"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      autoComplete="name"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#C8CBD0] focus:border-[#0E71EB] focus:ring-2 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#6E7683] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9EA6B3]" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    autoComplete="email"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#C8CBD0] focus:border-[#0E71EB] focus:ring-2 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6E7683] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9EA6B3]" />
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder={authMode === "signup" ? "Min. 6 characters" : "••••••••"}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                    className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-[#C8CBD0] focus:border-[#0E71EB] focus:ring-2 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9EA6B3] hover:text-[#6E7683] transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="bg-[#FFF0F0] border border-[#FFD0D0] text-[#CC0000] text-xs rounded-xl px-3 py-2.5 font-medium">
                  {authError}
                </div>
              )}

              <button
                id="auth-submit-btn"
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 bg-[#0E71EB] hover:bg-[#0B5EC4] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all cursor-pointer mt-1 flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : authMode === "signin" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <div className="text-center pb-5 px-6">
              {authMode === "signin" ? (
                <p className="text-xs text-[#6E7683]">
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError("");
                    }}
                    className="text-[#0E71EB] font-semibold hover:underline cursor-pointer"
                  >
                    Sign Up Free
                  </button>
                </p>
              ) : (
                <p className="text-xs text-[#6E7683]">
                  Already have an account?{" "}
                  <button
                    onClick={() => {
                      setAuthMode("signin");
                      setAuthError("");
                    }}
                    className="text-[#0E71EB] font-semibold hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
