"use client";

/**
 * AppShell.tsx
 * ------------
 * Route-aware layout wrapper. Renders the light-theme Sidebar +
 * DashboardHeader only on non-meeting routes.
 */

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // Meeting pages opt-out of the shared shell entirely
  const isMeetingPage = pathname.startsWith("/meeting");

  if (isMeetingPage) {
    return <div className="meeting-page-root">{children}</div>;
  }

  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: "#F4F5F7" }}
    >
      {/* ── Left Sidebar (fixed 64px) ──────────────────────── */}
      <Sidebar />

      {/* ── Main Area (offset by sidebar width) ────────────── */}
      <div className="flex flex-col flex-1 min-w-0" style={{ marginLeft: "64px" }}>
        {/* Sticky top header */}
        <DashboardHeader />

        {/* Page content — offset by header height (56px) */}
        <main
          className="flex-1 flex flex-col min-h-[calc(100vh-56px)]"
          style={{ paddingTop: "56px" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

