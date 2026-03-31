/** Maps “showcase tier” on the login screen to seeded user emails (resolved in API). */

export const DEMO_TIER_OPTIONS = [
  {
    id: "enterprise" as const,
    title: "Enterprise",
    subtitle: "Full platform",
    description:
      "All modules — Build, Pay, Connect, Insight, Support, Cover. Typical health-system rollout.",
    tenantPreview: "LCO Health Center",
    moduleSummary: "Everything on",
    accent: "navy" as const,
  },
  {
    id: "growth" as const,
    title: "Growth",
    subtitle: "Clinical + revenue core",
    description:
      "Build, Pay, Insight — no Connect, Support, or Cover. Mid-market selective deployment.",
    tenantPreview: "Tamarack Health",
    moduleSummary: "Build · Pay · Insight + Core",
    accent: "navy" as const,
  },
  {
    id: "essentials" as const,
    title: "Essentials",
    subtitle: "Operations & analytics",
    description:
      "Pay + Insight only. Revenue staff and dashboards without claims connectivity in-app.",
    tenantPreview: "Demo Tenant",
    moduleSummary: "Pay · Insight + Core",
    accent: "coral" as const,
  },
  {
    id: "platform_admin" as const,
    title: "Platform admin",
    subtitle: "Cross-tenant operator",
    description:
      "Anang operator view — all tenants, global audit. Not for client-facing demos.",
    tenantPreview: "Internal",
    moduleSummary: "/admin",
    accent: "coral" as const,
  },
];

export type DemoTierId = (typeof DEMO_TIER_OPTIONS)[number]["id"];

export const TIER_TO_USER_EMAIL: Record<DemoTierId, string> = {
  enterprise: "admin@lco.anang.demo",
  growth: "rcm@tamarack.anang.demo",
  essentials: "viewer@demo.anang.demo",
  platform_admin: "super@anang.internal",
};
