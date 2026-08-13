"use client";

/**
 * DashboardHeader.tsx
 * --------------------
 * Clean Top Navigation Bar matching Zoom Workplace Desktop.
 *
 * Left: "zoom Workplace" logo
 * Center: Clean navigation controls (< > ↺), Search pill, and + button
 * Right: Upgrade pill button, Notification Bell, Calendar icon, and
 *        Profile Avatar (when signed in) OR Sign In / Sign Up options (when signed out)
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
} from "lucide-react";

interface DashboardHeaderProps {
  userName?: string;
  userEmail?: string;
  userPhoto?: string;
}

export default function DashboardHeader({
  userName = "Aviral Goel",
  userEmail = "aviral@zoom.us",
  userPhoto,
}: DashboardHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = () => {
    setIsSignedIn(false);
    setShowProfileMenu(false);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSignedIn(true);
    setShowAuthModal(false);
    setEmailInput("");
    setPasswordInput("");
  };

  return (
    <>
      <header
        id="dashboard-header"
        className="fixed top-0 right-0 z-40 flex items-center justify-between px-6 bg-white border-b border-[#E2E4E8] select-none"
        style={{ left: "64px", height: "56px" }}
      >
        {/* ── Left Corner: Logo ────────────────────────────── */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-lg font-extrabold text-[#0E71EB] tracking-tight">
            zoom
          </span>
          <span className="text-sm font-semibold text-[#131619] tracking-tight">
            Workplace
          </span>
        </div>

        {/* ── Center Navigation & Search ───────────────────────── */}
        <div className="flex items-center gap-3 flex-1 max-w-xl mx-8 justify-center">
          {/* Nav arrows < > ↺ */}
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
              aria-label="History"
              onClick={() => window.location.reload()}
              className="p-1.5 rounded-lg hover:bg-[#F4F5F7] hover:text-[#131619] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Clean, robust Search input pill with zero collision risk */}
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

          {/* Small + button */}
          <button
            id="header-add-btn"
            aria-label="Create new"
            className="p-1.5 rounded-lg hover:bg-[#F4F5F7] text-[#6E7683] hover:text-[#131619] transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* ── Right Corner: Actions, Notifications & Profile/Auth ──────────────────── */}
        <div className="flex items-center gap-3.5 flex-shrink-0">
          {/* Solid Blue Upgrade Pill */}
          <button
            id="header-upgrade-btn"
            className="bg-[#0E71EB] hover:bg-[#0B5EC4] text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          >
            Upgrade
          </button>

          {/* Notification Bell */}
          <button
            id="header-notifications"
            aria-label="Notifications"
            className="relative p-2 rounded-full hover:bg-[#F4F5F7] text-[#6E7683] hover:text-[#131619] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF3B30] border-2 border-white" />
          </button>

          {/* Calendar */}
          <button
            id="header-calendar"
            aria-label="Calendar"
            className="relative p-2 rounded-full hover:bg-[#F4F5F7] text-[#6E7683] hover:text-[#131619] transition-colors cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF3B30] border-2 border-white" />
          </button>

          {/* Signed In User Profile Avatar OR Sign In/Up options */}
          {isSignedIn ? (
            <div className="relative ml-1">
              <button
                id="header-profile-btn"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="relative flex items-center justify-center p-0.5 rounded-full hover:opacity-90 transition-opacity cursor-pointer"
                title={`${userName} (${userEmail})`}
                aria-label="User Profile"
              >
                {userPhoto ? (
                  <img
                    src={userPhoto}
                    alt={userName}
                    className="w-8 h-8 rounded-full object-cover shadow-2xs"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#0E71EB] flex items-center justify-center text-white text-xs font-bold shadow-2xs">
                    {initials}
                  </div>
                )}
                <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#34C759] border-2 border-white" />
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#E2E4E8] py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-[#E2E4E8]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#34C759]" />
                      <span className="text-xs font-semibold text-[#131619]">
                        Available
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#131619] mt-1 truncate">
                      {userName}
                    </p>
                    <p className="text-[11px] text-[#6E7683] truncate">
                      {userEmail}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        alert("Opening My Profile settings...");
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-[#131619] hover:bg-[#F4F5F7] flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-[#6E7683]" />
                      My Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        alert("Opening Preferences & Settings...");
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-[#131619] hover:bg-[#F4F5F7] flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#6E7683]" />
                      Settings
                    </button>
                  </div>

                  <div className="border-t border-[#E2E4E8] pt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-xs text-[#FF3B30] hover:bg-[#FFF0F0] flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-[#FF3B30]" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-1">
              <button
                id="header-signin-btn"
                onClick={() => {
                  setAuthMode("signin");
                  setShowAuthModal(true);
                }}
                className="px-3.5 py-1.5 border border-[#0E71EB] text-[#0E71EB] hover:bg-[#0E71EB]/8 text-xs font-semibold rounded-full transition-all cursor-pointer"
              >
                Sign In
              </button>
              <button
                id="header-signup-btn"
                onClick={() => {
                  setAuthMode("signup");
                  setShowAuthModal(true);
                }}
                className="px-4 py-1.5 bg-[#0E71EB] hover:bg-[#0B5EC4] text-white text-xs font-semibold rounded-full transition-all shadow-2xs hover:shadow-xs cursor-pointer"
              >
                Sign Up Free
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Auth Modal (Sign In / Sign Up) */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
          <div className="w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl p-6 space-y-4 select-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold text-[#0E71EB]">
                  zoom
                </span>
                <span className="text-sm font-semibold text-[#131619]">
                  {authMode === "signin" ? "Sign In" : "Sign Up Free"}
                </span>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#F4F5F7] text-[#6E7683]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#6E7683] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9EA6B3]" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[#C8CBD0] focus:border-[#0E71EB] focus:ring-2 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6E7683] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9EA6B3]" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[#C8CBD0] focus:border-[#0E71EB] focus:ring-2 focus:ring-[#0E71EB]/15 outline-none bg-white text-[#131619]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#0E71EB] hover:bg-[#0B5EC4] text-white text-sm font-semibold rounded-xl transition-all shadow-xs cursor-pointer mt-2"
              >
                {authMode === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-[#E2E4E8]">
              {authMode === "signin" ? (
                <p className="text-xs text-[#6E7683]">
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={() => setAuthMode("signup")}
                    className="text-[#0E71EB] font-semibold hover:underline cursor-pointer ml-1"
                  >
                    Sign Up Free
                  </button>
                </p>
              ) : (
                <p className="text-xs text-[#6E7683]">
                  Already have an account?{" "}
                  <button
                    onClick={() => setAuthMode("signin")}
                    className="text-[#0E71EB] font-semibold hover:underline cursor-pointer ml-1"
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



