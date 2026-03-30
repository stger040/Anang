import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@anang/brand", "@anang/config", "@anang/types", "@anang/ui"],
};

export default nextConfig;
