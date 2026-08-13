"use client";

/**
 * Sidebar.tsx — Zoom Workplace Left Navigation
 * -----------------------------------------------------------
 * Vertical left sidebar matching official Zoom Workplace desktop look.
 */

import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Sparkles,
  Video,
  MessageSquare,
  LayoutGrid,
  MoreHorizontal,
  Settings,
} from "lucide-react";

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  href: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "nav-home",      icon: <Home className="w-4 h-4" />,          label: "Home",     href: "/" },
  { id: "nav-zoommate",  icon: <Sparkles className="w-4 h-4" />,      label: "ZoomMate", href: "/zoommate" },
  { id: "nav-meetings",  icon: <Video className="w-4 h-4" />,         label: "Meetings", href: "/meetings" },
  { id: "nav-chat",      icon: <MessageSquare className="w-4 h-4" />, label: "Chat",     href: "/chat" },
  { id: "nav-hub",       icon: <LayoutGrid className="w-4 h-4" />,     label: "Hub",      href: "/hub", badge: "New" },
  { id: "nav-more",      icon: <MoreHorizontal className="w-4 h-4" />, label: "More",    href: "/more" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleNav = (href: string) => {
    if (href === "/" || href === "/schedule") router.push(href);
  };

  return (
    <aside
      id="main-sidebar"
      aria-label="Main navigation"
      className="fixed top-0 left-0 z-50 flex flex-col h-screen select-none"
      style={{
        width: "64px",
        backgroundColor: "#F4F5F7",
        borderRight: "1px solid #E2E4E8",
      }}
    >
      {/* ── Top Spacer (aligns with 56px header) ──────────────────────────── */}
      <div className="h-[56px] flex-shrink-0" />

      {/* ── Nav Items ─────────────────────────────────────── */}
      <nav className="flex flex-col flex-1 items-center gap-1.5 py-2 px-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, icon, label, href, badge }) => {
          const active = isActive(href);
          return (
            <button
              key={id}
              id={id}
              onClick={() => handleNav(href)}
              title={label}
              className={`relative flex flex-col items-center justify-center w-12 py-2 rounded-xl text-center transition-all ${
                active
                  ? "bg-white text-[#0E71EB] shadow-xs border border-[#E2E4E8]"
                  : "text-[#6E7683] hover:text-[#131619] hover:bg-[#EBECEF]/60"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <div className="relative flex items-center justify-center mb-0.5">
                {icon}
                {badge && (
                  <span className="absolute -top-1.5 -right-3 text-[8px] font-bold leading-tight text-[#0E71EB] bg-[#EAF2FF] border border-[#0E71EB]/30 rounded-md px-1 py-0.2">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight font-normal">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Bottom: Settings ──────────────────────────────── */}
      <div className="p-1 pb-3 flex justify-center border-t border-[#E2E4E8]">
        <button
          id="nav-settings"
          title="Settings"
          className="flex flex-col items-center justify-center w-12 py-2 rounded-xl text-[#6E7683] hover:text-[#131619] hover:bg-[#EBECEF]/60 transition-all"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight font-normal">Settings</span>
        </button>
      </div>
    </aside>
  );
}

