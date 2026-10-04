import type { NextConfig } from "next";

const apiBackend = process.env.INTERNAL_API_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBackend}/api/:path*`,
      },
      {
        source: "/healthz",
        destination: `${apiBackend}/healthz`,
      },
    ];
  },
};

export default nextConfig;
