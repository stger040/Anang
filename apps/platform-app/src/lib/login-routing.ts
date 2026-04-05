/**
 * Virtual-email pilot mapping (`PROFILE_TO_USER_EMAIL`) and optional `accessProfile`
 * in credentials authorize. The sign-in UI uses real emails only; virtual mailbox
 * defaults to `enterprise` when no profile is sent.
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
  enterprise: "rick@anang.ai",
  growth: "rick@stginnovation.com",
  essentials: "rick@stginnovation.com",
  platform_admin: "rick@anang.ai",
};
