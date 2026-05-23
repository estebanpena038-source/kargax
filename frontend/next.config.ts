import type { NextConfig } from "next";
import { getSecurityHeaderEntries } from "./src/lib/server/security-headers";

const nextConfig: NextConfig = {
  experimental: {},

  // Image security config
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },

  // Hide X-Powered-By header
  poweredByHeader: false,

  // TypeScript strict build
  typescript: {
    ignoreBuildErrors: false,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: getSecurityHeaderEntries(),
      },
    ];
  },
};

export default nextConfig;
