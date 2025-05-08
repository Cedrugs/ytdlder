import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**"
      }
    ]
  },
  env: {
    SITE_URL: process.env.SITE_URL,
    ENVIRONMENT: process.env.ENVIRONMENT,
  }
};

export default nextConfig;
