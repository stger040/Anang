import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(configDir, "..", "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@anang/brand", "@anang/config"],
  webpack: (config) => {
    const base =
      typeof config.resolve.alias === "object" &&
      config.resolve.alias !== null &&
      !Array.isArray(config.resolve.alias)
        ? (config.resolve.alias as Record<string, string | false | string[]>)
        : {};
    config.resolve.alias = {
      ...base,
      "@anang/brand": path.join(monorepoRoot, "packages", "brand", "src", "index.ts"),
      "@anang/config": path.join(monorepoRoot, "packages", "config", "src", "index.ts"),
    };
    return config;
  },
};

export default nextConfig;
