export const brandDefaults = {
  company: {
    legalName: "Anang",
    displayName: "Anang",
    domain: "anang.ai",
    platformSubdomain: "app.anang.ai",
  },

  product: {
    suiteName: "Anang",
    tagline: "AI revenue cycle built for modern health systems.",
    shortDescription:
      "Unified platform for patient financial engagement, claims intelligence, and proactive denial prevention.",
  },

  modules: {
    core: {
      key: "CORE" as const,
      label: "Platform",
      description: "Tenants, users, entitlements, audit, and branding.",
    },
    build: {
      key: "BUILD" as const,
      label: "Build",
      description:
        "AI-assisted claims build, documentation gaps, denial risk — human-in-the-loop.",
    },
    pay: {
      key: "PAY" as const,
      label: "Pay",
      description: "Patient statements, balances, payments, and staff views.",
    },
    connect: {
      key: "CONNECT" as const,
      label: "Connect",
      description: "Claim lifecycle, payer status, remittance, clearinghouse readiness.",
    },
    insight: {
      key: "INSIGHT" as const,
      label: "Insight",
      description: "Denial trends, clean claim rate, AR, and revenue leakage signals.",
    },
    support: {
      key: "SUPPORT" as const,
      label: "Support",
      description: "Staff workspace for billing operations and workflows.",
    },
    cover: {
      key: "COVER" as const,
      label: "Cover",
      description: "Affordability, coverage, and patient-facing denial resolution paths.",
    },
  },

  technical: {
    serviceId: "anang-platform",
  },
};

export type BrandConfig = typeof brandDefaults;
