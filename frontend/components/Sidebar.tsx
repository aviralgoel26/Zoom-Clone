"use client";

/**
 * Sidebar.tsx — Zoom Workplace Left Navigation
 * -----------------------------------------------------------
 * Vertical left sidebar matching official Zoom Workplace desktop look.
 * Non-core nav items trigger a "Feature Coming Soon!" toast instead of navigating.
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
  Phone,
  FileText,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Nav item definitions
// ---------------------------------------------------------------------------
interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  href: string;
  /** If true, clicking navigates. If false, shows "Coming Soon" toast. */
  implemented: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "nav-home",     icon: <Home className="w-4 h-4" />,          label: "Home",     href: "/",        implemented: true },
  { id: "nav-zoommate", icon: <Sparkles className="w-4 h-4" />,      label: "AI Mate",  href: "/zoommate", implemented: false },
  { id: "nav-meetings", icon: <Video className="w-4 h-4" />,         label: "Meetings", href: "/meetings", implemented: false },
  { id: "nav-chat",     icon: <MessageSquare className="w-4 h-4" />, label: "Chat",     href: "/chat",     implemented: false },
  { id: "nav-phone",    icon: <Phone className="w-4 h-4" />,         label: "Phone",    href: "/phone",    implemented: false },
  { id: "nav-docs",     icon: <FileText className="w-4 h-4" />,      label: "Docs",     href: "/docs",     implemented: false },
  { id: "nav-hub",      icon: <LayoutGrid className="w-4 h-4" />,    label: "Hub",      href: "/hub",      implemented: false, badge: "New" },
  { id: "nav-more",     icon: <MoreHorizontal className="w-4 h-4" />,label: "More",     href: "/more",     implemented: false },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleNav = (item: NavItem) => {
    if (item.implemented) {
      router.push(item.href);
    } else {
      showToast(
        "Feature Coming Soon!",
        `${item.label} module is queued for the next release.`,
        "coming-soon"
      );
    }
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
      {/* ── Top Spacer (aligns with 56px header) ─────────────────────── */}
      <div className="h-[56px] flex-shrink-0" />

      {/* ── Nav Items ──────────────────────────────────────────────────── */}
      <nav className="flex flex-col flex-1 items-center gap-1.5 py-2 px-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = item.implemented && isActive(item.href);
          return (
            <button
              key={item.id}
              id={item.id}
              onClick={() => handleNav(item)}
              title={item.label}
              className={`relative flex flex-col items-center justify-center w-12 py-2 rounded-xl text-center transition-all cursor-pointer ${
                active
                  ? "bg-white text-[#0E71EB] shadow-xs border border-[#E2E4E8]"
                  : "text-[#6E7683] hover:text-[#131619] hover:bg-[#EBECEF]/60"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <div className="relative flex items-center justify-center mb-0.5">
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1.5 -right-3 text-[8px] font-bold leading-tight text-[#0E71EB] bg-[#EAF2FF] border border-[#0E71EB]/30 rounded-md px-1">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight font-normal">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Bottom: Settings ───────────────────────────────────────────── */}
      <div className="p-1 pb-3 flex justify-center border-t border-[#E2E4E8]">
        <button
          id="nav-settings"
          title="Settings"
          onClick={() =>
            showToast(
              "Feature Coming Soon!",
              "Settings panel is queued for the next release.",
              "coming-soon"
            )
          }
          className="flex flex-col items-center justify-center w-12 py-2 rounded-xl text-[#6E7683] hover:text-[#131619] hover:bg-[#EBECEF]/60 transition-all cursor-pointer"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight font-normal">Settings</span>
        </button>
      </div>
    </aside>
  );
}
