/**
 * Demo-only password gate. In production, replace with real auth and remove or
 * disable these env-based defaults.
 */
export function getDemoLoginEmail(): string {
  return (
    process.env.DEMO_LOGIN_EMAIL?.trim().toLowerCase() ?? "demo@anang.ai"
  );
}

export function getDemoPassword(): string {
  return process.env.DEMO_LOGIN_PASSWORD ?? "demo";
}
