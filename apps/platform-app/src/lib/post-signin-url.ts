/** Build `/post-signin` URL with optional org + invite (preserved through Auth.js callbackUrl). */
export function postSignInPath(opts: {
  intendedOrgSlug?: string | null;
  pendingInviteToken?: string | null;
}): string {
  const q = new URLSearchParams();
  const org = opts.intendedOrgSlug?.trim();
  const invite = opts.pendingInviteToken?.trim();
  if (org) q.set("org", org);
  if (invite) q.set("invite", invite);
  const qs = q.toString();
  return qs ? `/post-signin?${qs}` : "/post-signin";
}
