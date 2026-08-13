import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the app to be served from any origin during dev
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
