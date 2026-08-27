import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // src/pages contains React Router SPA components, not Next.js pages.
  pageExtensions: ["page.tsx", "page.ts", "page.jsx", "page.js"],
};

export default nextConfig;
