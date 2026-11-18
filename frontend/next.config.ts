import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const apiTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
};

export default nextConfig;
