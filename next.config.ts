import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep the production build within the existing Netlify build container.
    webpackMemoryOptimizations: true,
  },
  async rewrites() {
    return [
      {
        source: "/contentpreview/api/:path*",
        destination: "https://ysabel-society-media-preview.arberhalili1.chatgpt.site/api/:path*",
      },
    ];
  },
};

export default nextConfig;
