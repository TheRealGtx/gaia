import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A second build (the public, simulation-only one) can go elsewhere while
  // `npm run dev` keeps using .next: NEXT_DIST_DIR=.next-public npm run build
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
