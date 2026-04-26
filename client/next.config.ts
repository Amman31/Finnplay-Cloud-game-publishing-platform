import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker / `next build` should not fail on existing ESLint debt; run `npm run lint` in CI or locally.
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
