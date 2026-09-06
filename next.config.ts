import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
