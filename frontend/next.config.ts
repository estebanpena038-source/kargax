import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getSecurityHeaderEntries } from "./src/lib/server/security-headers";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  experimental: {},
  turbopack: {
    root: appRoot,
  },

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
