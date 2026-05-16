import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "vintagebudthreads.com" },
      { protocol: "https", hostname: "via.placeholder.com" },
    ],
  },
};

export default nextConfig;
