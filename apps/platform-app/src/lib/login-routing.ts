/**
 * Maps the login “profile” picker to seeded operator accounts (pilot / staging).
 * Replace with IdP group → tenant mapping in production.
 */

export const ACCESS_PROFILE_OPTIONS = [
  {
    id: "enterprise" as const,
    title: "Health system",
    subtitle: "Full modules",
    description:
      "Build, Pay, Connect, Insight, Support, Cover — typical IDN footprint.",
    tenantPreview: "LCO Health Center",
    moduleSummary: "All purchased modules",
    accent: "navy" as const,
  },
  {
    id: "growth" as const,
    title: "Regional group",
    subtitle: "Selective modules",
    description:
      "Build, Pay, Insight — mid-market rollout without every module enabled.",
    tenantPreview: "Tamarack Health",
    moduleSummary: "Build · Pay · Insight + Core",
    accent: "navy" as const,
  },
  {
    id: "essentials" as const,
    title: "Pilot tenant",
    subtitle: "Focused scope",
    description:
      "Pay + Insight — revenue and analytics while other modules are phased in.",
    tenantPreview: "Pilot Regional",
    moduleSummary: "Pay · Insight + Core",
    accent: "coral" as const,
  },
  {
    id: "platform_admin" as const,
    title: "Platform operator",
    subtitle: "Internal only",
    description:
      "Cross-tenant administration and audit — not for clinic end users.",
    tenantPreview: "Anang operations",
    moduleSummary: "/admin",
    accent: "coral" as const,
  },
];

export type AccessProfileId = (typeof ACCESS_PROFILE_OPTIONS)[number]["id"];

export const PROFILE_TO_USER_EMAIL: Record<AccessProfileId, string> = {
  enterprise: "admin@lco.anang.demo",
  growth: "rcm@tamarack.anang.demo",
  essentials: "viewer@demo.anang.demo",
  platform_admin: "super@anang.internal",
};
