import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/**': ['./data/defaults/**'],
  },
};

export default nextConfig;
