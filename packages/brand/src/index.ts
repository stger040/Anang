import { brandDefaults, type BrandConfig } from "./config";

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return v?.trim() ? v : undefined;
}

export function getBrand(): BrandConfig {
  const d = brandDefaults;
  return {
    ...d,
    company: {
      ...d.company,
      displayName:
        env("NEXT_PUBLIC_ANANG_COMPANY_DISPLAY") ?? d.company.displayName,
      domain: env("NEXT_PUBLIC_ANANG_DOMAIN") ?? d.company.domain,
      platformSubdomain:
        env("NEXT_PUBLIC_ANANG_APP_HOST") ?? d.company.platformSubdomain,
    },
    product: {
      ...d.product,
      suiteName: env("NEXT_PUBLIC_ANANG_SUITE_NAME") ?? d.product.suiteName,
      tagline: env("NEXT_PUBLIC_ANANG_TAGLINE") ?? d.product.tagline,
    },
    modules: d.modules,
    technical: {
      serviceId: env("ANANG_SERVICE_ID") ?? d.technical.serviceId,
    },
  };
}

export { brandDefaults };
export type { BrandConfig };
export { cedarInspiredTheme } from "./theme";
export type { CedarInspiredTheme } from "./theme";
