import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-d34ae468-9de4-48db-8a64-df5d8638d923.space-z.ai",
  ],
};

export default nextConfig;
