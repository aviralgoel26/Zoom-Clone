"use client";

/**
 * DashboardHeader.tsx
 * --------------------
 * Authentic Zoom Workplace Top Navigation Bar and Authentication Suite.
 * Auth modal is pixel-matched to the official Zoom Workplace sign-in screen.
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
  Eye,
  EyeOff,
  ChevronDown,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import {
  login,
  register,
  saveSession,
  clearSession,
  useAuth,
} from "@/lib/auth";

// ---------------------------------------------------------------------------
// SSO Provider Icon components
// ---------------------------------------------------------------------------
function SSOIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.28v3.15C3.25 21.3 7.31 24 12 24z"/>
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.28C.46 8.2.005 10.05.005 12s.455 3.8 1.275 5.42l4-3.15z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.58l4 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path fill="#F25022" d="M1 1h10v10H1z"/>
      <path fill="#00A4EF" d="M13 1h10v10H13z"/>
      <path fill="#7FBA00" d="M1 13h10v10H1z"/>
      <path fill="#FFB900" d="M13 13h10v10H13z"/>
    </svg>
  );
}

export default function DashboardHeader() {
  const { user: currentUser, loading: isLoadingAuth } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // Presence status
  const [userStatus, setUserStatus] = useState<"Available" | "Away" | "Do Not Disturb">("Available");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  // signin is 2-step: email → password
  const [signinStep, setSigninStep] = useState<"email" | "password">("email");

  // Form fields
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const initials = currentUser
    ? currentUser.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const statusColors: Record<string, string> = {
    Available: "bg-[#34C759]",
    Away: "bg-[#FF9500]",
    "Do Not Disturb": "bg-[#FF3B30]",
  };

  const openModal = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setSigninStep("email");
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
    setSigninStep("email");
  };

  const handleSignOut = () => {
    clearSession();
    setShowProfileMenu(false);
  };

  // Sign-in: Step 1 = email Next, Step 2 = password Sign In
  const handleSigninNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) { setAuthError("Please enter your email"); return; }
    setAuthError("");
    setSigninStep("password");
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
        response = await register(displayNameInput.trim(), emailInput.trim(), passwordInput);
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
      {/* ── Top Header Bar ────────────────────────────────────── */}
      <header
        id="dashboard-header"
        className="fixed top-0 right-0 z-40 flex items-center justify-between px-6 bg-white border-b border-[#E2E4E8] select-none"
        style={{ left: "64px", height: "56px" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-lg font-extrabold text-[#0E71EB] tracking-tight">zoom</span>
          <span className="text-sm font-semibold text-[#131619] tracking-tight">Workplace</span>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 flex-1 max-w-xl mx-8 justify-center">
          <div className="flex items-center gap-1 flex-shrink-0 text-[#6E7683]">
            <button onClick={() => window.history.back()} className="p-1.5 rounded-lg hover:bg-[#F4F5F7] hover:text-[#131619] transition-colors" aria-label="Back">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => window.history.forward()} className="p-1.5 rounded-lg hover:bg-[#F4F5F7] hover:text-[#131619] transition-colors" aria-label="Forward">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => window.location.reload()} className="p-1.5 rounded-lg hover:bg-[#F4F5F7] hover:text-[#131619] transition-colors" aria-label="Reload">
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
          <button className="p-1.5 rounded-lg hover:bg-[#F4F5F7] text-[#6E7683] hover:text-[#131619] transition-colors flex-shrink-0" aria-label="New">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3.5 flex-shrink-0">
          <button className="bg-[#0E71EB] hover:bg-[#0B5EC4] text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs">
            Upgrade
          </button>
          <button className="relative p-2 rounded-full hover:bg-[#F4F5F7] text-[#6E7683] transition-colors" aria-label="Notifications">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF3B30] border-2 border-white" />
          </button>
          <button className="p-2 rounded-full hover:bg-[#F4F5F7] text-[#6E7683] transition-colors" aria-label="Calendar">
            <Calendar className="w-4 h-4" />
          </button>

          {/* Profile or Auth Buttons */}
          {isLoadingAuth ? (
            <div className="w-8 h-8 rounded-full bg-[#EBECEF] animate-pulse" />
          ) : currentUser ? (
            <div className="relative ml-1">
              <button
                id="header-profile-btn"
                onClick={() => setShowProfileMenu((v) => !v)}
                className="relative flex items-center justify-center cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#0E71EB] flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${statusColors[userStatus]} border-2 border-white`} />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-[#E2E4E8] py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-[#E2E4E8]">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-bold text-[#131619] truncate">{currentUser.display_name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0E71EB]/10 text-[#0E71EB] flex-shrink-0 ml-2">BASIC</span>
                    </div>
                    <p className="text-xs text-[#6E7683] truncate">{currentUser.email}</p>

                    {/* Status selector */}
                    <div className="relative mt-2.5">
                      <button
                        onClick={() => setShowStatusMenu((v) => !v)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-[#E2E4E8] hover:bg-[#F4F5F7] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${statusColors[userStatus]}`} />
                          <span className="text-xs font-semibold text-[#131619]">{userStatus}</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-[#6E7683]" />
                      </button>
                      {showStatusMenu && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-[#E2E4E8] rounded-xl shadow-lg py-1 z-50">
                          {(["Available", "Away", "Do Not Disturb"] as const).map((s) => (
                            <button key={s} onClick={() => { setUserStatus(s); setShowStatusMenu(false); }}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-[#F4F5F7] flex items-center gap-2 cursor-pointer"
                            >
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[s]}`} />
                              <span className="text-[#131619] flex-1">{s}</span>
                              {userStatus === s && <CheckCircle2 className="w-3.5 h-3.5 text-[#0E71EB]" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="py-1">
                    <button onClick={() => setShowProfileMenu(false)} className="w-full px-4 py-2.5 text-left text-xs text-[#131619] hover:bg-[#F4F5F7] flex items-center gap-3 cursor-pointer">
                      <User className="w-3.5 h-3.5 text-[#6E7683]" /> My Profile
                    </button>
                    <button onClick={() => setShowProfileMenu(false)} className="w-full px-4 py-2.5 text-left text-xs text-[#131619] hover:bg-[#F4F5F7] flex items-center gap-3 cursor-pointer">
                      <Settings className="w-3.5 h-3.5 text-[#6E7683]" /> Settings
                    </button>
                  </div>
                  <div className="border-t border-[#E2E4E8] pt-1">
                    <button onClick={handleSignOut} className="w-full px-4 py-2.5 text-left text-xs text-[#FF3B30] hover:bg-[#FFF5F5] flex items-center gap-3 font-medium cursor-pointer">
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-1">
              <button id="header-signin-btn" onClick={() => openModal("signin")}
                className="px-4 py-1.5 border border-[#0E71EB] text-[#0E71EB] hover:bg-[#EEF5FE] text-xs font-semibold rounded-full transition-all cursor-pointer"
              >Sign In</button>
              <button id="header-signup-btn" onClick={() => openModal("signup")}
                className="px-4 py-1.5 bg-[#0E71EB] hover:bg-[#0B5EC4] text-white text-xs font-semibold rounded-full transition-all cursor-pointer shadow-sm"
              >Sign Up Free</button>
            </div>
          )}
        </div>
      </header>

      {/* ── Auth Modal — pixel-matched to Zoom Workplace ──────── */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* ── Modal Top: Zoom Branding ── */}
            <div className="pt-9 pb-5 px-8 text-center relative border-b border-[#F0F0F0]">
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#F4F5F7] text-[#8E95A2] hover:text-[#131619] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Zoom logo exactly matching the desktop app */}
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-3xl font-extrabold text-[#0E71EB] tracking-tight">zoom</span>
                <ChevronDown className="w-4 h-4 text-[#6E7683] mt-1" />
              </div>
              <h1 className="text-2xl font-bold text-[#131619] tracking-tight">
                {authMode === "signin" ? "Workplace" : "Sign up free"}
              </h1>
              {authMode === "signin" && (
                <p className="text-xs text-[#8E95A2] mt-0.5">us05web.zoom.us</p>
              )}
            </div>

            {/* ── Form Body ── */}
            <div className="px-8 py-6">

              {/* SIGN IN FLOW */}
              {authMode === "signin" && (
                <>
                  {signinStep === "email" ? (
                    <form onSubmit={handleSigninNext} className="space-y-3">
                      <button
                        type="button"
                        onClick={() => { setSigninStep("email"); }}
                        className="flex items-center gap-1.5 text-[#0E71EB] text-sm font-medium mb-4 hover:underline cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>

                      <input
                        id="auth-email"
                        type="email"
                        required
                        placeholder="Email or phone number"
                        value={emailInput}
                        onChange={(e) => { setEmailInput(e.target.value); setAuthError(""); }}
                        autoComplete="email"
                        autoFocus
                        className="w-full px-4 py-3 text-sm rounded-xl border border-[#D0D5DD] hover:border-[#0E71EB] focus:border-[#0E71EB] focus:ring-3 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition placeholder-[#9EA6B3]"
                      />

                      {authError && (
                        <p className="text-xs text-[#CC0000] font-medium px-1">{authError}</p>
                      )}

                      <button
                        type="submit"
                        className="w-full py-3 bg-[#D0D5DD] hover:bg-[#0E71EB] text-[#6E7683] hover:text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
                      >
                        Next
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleAuthSubmit} className="space-y-3">
                      <button
                        type="button"
                        onClick={() => { setSigninStep("email"); setAuthError(""); }}
                        className="flex items-center gap-1.5 text-[#0E71EB] text-sm font-medium mb-1 hover:underline cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                      <p className="text-xs text-[#6E7683] mb-3 truncate">Signing in as <span className="font-semibold text-[#131619]">{emailInput}</span></p>

                      <div className="relative flex items-center">
                        <input
                          id="auth-password"
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="Password"
                          value={passwordInput}
                          onChange={(e) => { setPasswordInput(e.target.value); setAuthError(""); }}
                          autoComplete="current-password"
                          autoFocus
                          className="w-full pl-4 pr-11 py-3 text-sm rounded-xl border border-[#D0D5DD] hover:border-[#0E71EB] focus:border-[#0E71EB] focus:ring-3 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition placeholder-[#9EA6B3]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3.5 text-[#8E95A2] hover:text-[#555] transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {authError && (
                        <p className="text-xs text-[#CC0000] font-medium px-1">{authError}</p>
                      )}

                      <button
                        id="auth-submit-btn"
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-3 bg-[#0E71EB] hover:bg-[#0B5EC4] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {authLoading ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : "Sign In"}
                      </button>
                    </form>
                  )}
                </>
              )}

              {/* SIGN UP FLOW */}
              {authMode === "signup" && (
                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  <input
                    id="auth-display-name"
                    type="text"
                    required
                    placeholder="Full name"
                    value={displayNameInput}
                    onChange={(e) => { setDisplayNameInput(e.target.value); setAuthError(""); }}
                    autoComplete="name"
                    className="w-full px-4 py-3 text-sm rounded-xl border border-[#D0D5DD] hover:border-[#0E71EB] focus:border-[#0E71EB] focus:ring-3 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition placeholder-[#9EA6B3]"
                  />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    placeholder="Email address"
                    value={emailInput}
                    onChange={(e) => { setEmailInput(e.target.value); setAuthError(""); }}
                    autoComplete="email"
                    className="w-full px-4 py-3 text-sm rounded-xl border border-[#D0D5DD] hover:border-[#0E71EB] focus:border-[#0E71EB] focus:ring-3 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition placeholder-[#9EA6B3]"
                  />
                  <div className="relative flex items-center">
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Password (min. 6 characters)"
                      value={passwordInput}
                      onChange={(e) => { setPasswordInput(e.target.value); setAuthError(""); }}
                      autoComplete="new-password"
                      className="w-full pl-4 pr-11 py-3 text-sm rounded-xl border border-[#D0D5DD] hover:border-[#0E71EB] focus:border-[#0E71EB] focus:ring-3 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619] transition placeholder-[#9EA6B3]"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3.5 text-[#8E95A2] hover:text-[#555] transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {authError && (
                    <p className="text-xs text-[#CC0000] font-medium px-1">{authError}</p>
                  )}

                  <button
                    id="auth-submit-btn"
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 bg-[#0E71EB] hover:bg-[#0B5EC4] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {authLoading ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : "Sign Up Free"}
                  </button>
                </form>
              )}

              {/* ── SSO Row & Social Providers ── */}
              <div className="relative my-5 flex items-center">
                <div className="flex-1 border-t border-[#E2E4E8]" />
                <span className="mx-3 text-[11px] font-semibold text-[#9EA6B3] uppercase tracking-wide">or sign in with</span>
                <div className="flex-1 border-t border-[#E2E4E8]" />
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "SSO", icon: <SSOIcon />, onClick: () => alert("SSO requires enterprise configuration") },
                  { label: "Google", icon: <GoogleIcon />, onClick: () => alert("Google OAuth requires client ID setup") },
                  { label: "Apple", icon: <AppleIcon />, onClick: () => alert("Apple Sign-In requires Apple Developer setup") },
                  { label: "Facebook", icon: <FacebookIcon />, onClick: () => alert("Facebook Login requires App ID setup") },
                  { label: "Microsoft", icon: <MicrosoftIcon />, onClick: () => alert("Microsoft OAuth requires Azure App setup") },
                ].map(({ label, icon, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-2xl border border-[#E2E4E8] flex items-center justify-center group-hover:border-[#0E71EB]/40 group-hover:bg-[#EEF5FE] transition-all shadow-xs">
                      {icon}
                    </div>
                    <span className="text-[10px] text-[#6E7683] font-medium group-hover:text-[#0E71EB] transition-colors">{label}</span>
                  </button>
                ))}
              </div>

              {/* ── Footer Links ── */}
              <div className="mt-6 space-y-2 text-center">
                {authMode === "signin" ? (
                  <p className="text-xs text-[#6E7683]">
                    Don&apos;t have an account?{" "}
                    <button onClick={() => { setAuthMode("signup"); setAuthError(""); setSigninStep("email"); }}
                      className="text-[#0E71EB] font-semibold hover:underline cursor-pointer"
                    >Sign up</button>
                  </p>
                ) : (
                  <p className="text-xs text-[#6E7683]">
                    Already have an account?{" "}
                    <button onClick={() => { setAuthMode("signin"); setAuthError(""); }}
                      className="text-[#0E71EB] font-semibold hover:underline cursor-pointer"
                    >Sign in</button>
                  </p>
                )}
                <p className="text-xs text-[#6E7683] flex items-center justify-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" />
                  Need help?{" "}
                  <button className="text-[#0E71EB] font-semibold hover:underline cursor-pointer">Chat with us</button>
                </p>
              </div>
            </div>

            {/* ── Modal Footer — Terms ── */}
            <div className="border-t border-[#F0F0F0] py-3 px-8 flex items-center justify-center gap-4">
              <button className="text-[11px] text-[#8E95A2] hover:text-[#0E71EB] transition-colors cursor-pointer">Terms</button>
              <button className="text-[11px] text-[#8E95A2] hover:text-[#0E71EB] transition-colors cursor-pointer">Privacy</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
