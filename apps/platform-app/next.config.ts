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

const nextConfig: NextConfig = {
  transpilePackages: ["@anang/brand", "@anang/config", "@anang/types", "@anang/ui"],
};

export default nextConfig;
