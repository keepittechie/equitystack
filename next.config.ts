import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.10.0.13"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
