import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Presider schedule PDFs are uploaded through a server action; the default cap is 1 MB.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
