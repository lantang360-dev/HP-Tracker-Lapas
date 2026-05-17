import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Required for Prisma
  serverExternalPackages: ["@prisma/client"],
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {},
};

export default nextConfig;
