import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zoom Workplace — Web Conference App",
  description:
    "A full-featured video conferencing application built with Next.js and WebRTC, mirroring the Zoom Workplace desktop experience.",
  keywords: ["video conferencing", "zoom clone", "webrtc", "meetings", "zoom workplace"],
  other: {
    google: "notranslate",
    "chrome-note-taking": "none",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Light theme — no dark class */}
      <body
        className={`${inter.variable} font-sans antialiased`}
        style={{ backgroundColor: "#F4F5F7", color: "#131619" }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
