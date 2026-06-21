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

  products: {
    claimsAi: {
      label: "Claims AI",
      tagline: "Stop denials before submission",
      description:
        "AI-assisted claims build that surfaces documentation gaps, missing modifiers, and payer-specific denial risks before the claim leaves your system. Human-in-the-loop — your team approves every change.",
    },
    patientPay: {
      label: "Patient Pay",
      tagline: "Patient financial engagement, reimagined",
      description:
        "Mobile-first patient billing portal with digital statements, flexible payment plans, AI-powered bill explanations, coverage navigation, and financial assistance matching.",
    },
    intelligence: {
      label: "Intelligence",
      tagline: "Revenue insights that drive action",
      description:
        "Denial trend analytics, clean claim rate tracking, propensity-to-pay scoring, and AR performance dashboards — so your RCM leaders can act on data, not hunches.",
    },
  },

  modules: {
    core: {
      key: "CORE" as const,
      label: "Platform",
      description: "Tenants, users, entitlements, audit, and branding.",
    },
    build: {
      key: "BUILD" as const,
      label: "Claims AI",
      description:
        "AI-assisted claims build, documentation gaps, denial risk — human-in-the-loop.",
    },
    pay: {
      key: "PAY" as const,
      label: "Patient Pay",
      description: "Patient statements, balances, payments, mobile app, and staff views.",
    },
    connect: {
      key: "CONNECT" as const,
      label: "RCM Ops",
      description: "Claim lifecycle, payer status, remittance, clearinghouse readiness.",
    },
    insight: {
      key: "INSIGHT" as const,
      label: "Intelligence",
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
