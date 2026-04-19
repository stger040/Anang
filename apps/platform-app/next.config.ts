import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load `.env.neon` next to this config file into `process.env` (overrides the same keys from `.env`).
 * avoids relying on `process.cwd()` (monorepos / CI).
 * Vercel/production: prefer the project Environment Variables UI — `.env.neon` is often gitignored and not uploaded.
 */
function loadEnvNeon() {
  const filePath = path.join(configDir, ".env.neon");
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || key.startsWith("#")) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvNeon();

/** Repo root (…/apps/platform-app → …/monorepo). Hoisted workspace deps live in root `node_modules`. */
const monorepoRoot = path.join(configDir, "..", "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@anang/brand", "@anang/config", "@anang/types", "@anang/ui"],
  /**
   * Workspace packages: point webpack at `packages/*` sources so `next build` succeeds
   * when `@anang/*` is hoisted only at the monorepo root (common npm layout on Windows).
   */
  webpack: (config) => {
    const base =
      typeof config.resolve.alias === "object" &&
      config.resolve.alias !== null &&
      !Array.isArray(config.resolve.alias)
        ? (config.resolve.alias as Record<string, string | false | string[]>)
        : {};
    config.resolve.alias = {
      ...base,
      "@anang/ui": path.join(monorepoRoot, "packages", "ui", "src", "index.ts"),
      "@anang/brand": path.join(monorepoRoot, "packages", "brand", "src", "index.ts"),
      "@anang/config": path.join(monorepoRoot, "packages", "config", "src", "index.ts"),
      "@anang/types": path.join(monorepoRoot, "packages", "types", "src", "index.ts"),
    };
    return config;
  },
};

export default nextConfig;
