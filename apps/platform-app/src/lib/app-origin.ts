/** Canonical public origin for OAuth redirect_uri and links (no trailing slash). */
export function getAppOrigin(): string {
  const authUrl = process.env.AUTH_URL?.trim();
  if (authUrl) return authUrl.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3001";
}
