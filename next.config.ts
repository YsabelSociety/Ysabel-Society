import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep the production build within the existing Netlify build container.
    webpackMemoryOptimizations: true,
  },
  async headers() {
    return [
      {
        source: "/contentpreview-app/index.html",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
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
