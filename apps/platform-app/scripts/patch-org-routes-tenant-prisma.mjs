/**
 * One-off style patch: replace `prisma` with `tenantPrisma(orgSlug)` in org + patient routes
 * where `orgSlug` is already in scope. Run from apps/platform-app:
 *   node scripts/patch-org-routes-tenant-prisma.mjs
 */
import fs from "node:fs";
import path from "node:path";

const roots = [
  path.join("src", "app", "(tenant)", "o", "[orgSlug]"),
  path.join("src", "app", "p", "[orgSlug]"),
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(name)) acc.push(p);
  }
  return acc;
}

for (const root of roots) {
  for (const file of walk(root)) {
    let s = fs.readFileSync(file, "utf8");
    if (!s.includes('@/lib/prisma"') && !s.includes("@/lib/prisma'")) continue;
    if (file.includes("scripts/")) continue;

    const hadPrismaImport =
      /import\s*\{\s*prisma\s*\}\s*from\s*["']@\/lib\/prisma["']/.test(s);
    if (!hadPrismaImport) continue;

    if (!s.includes("orgSlug") && !file.includes("[orgSlug]")) continue;

    s = s.replace(
      /import\s*\{\s*prisma\s*\}\s*from\s*["']@\/lib\/prisma["'];?/,
      'import { tenantPrisma } from "@/lib/prisma";',
    );
    s = s.replace(/\bprisma\./g, "tenantPrisma(orgSlug).");

    fs.writeFileSync(file, s);
    // eslint-disable-next-line no-console
    console.log("patched", file);
  }
}
