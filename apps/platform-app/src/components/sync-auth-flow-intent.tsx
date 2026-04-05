"use client";

import { useEffect } from "react";

/**
 * Persists org / invite hints for OAuth flows that drop query params, via httpOnly cookies.
 */
export function SyncAuthFlowIntent({
  intendedOrgSlug,
  pendingInviteToken,
}: {
  intendedOrgSlug?: string;
  pendingInviteToken?: string;
}) {
  useEffect(() => {
    if (!intendedOrgSlug && !pendingInviteToken) return;
    void fetch("/api/auth/flow-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intendedOrgSlug: intendedOrgSlug ?? undefined,
        pendingInviteToken: pendingInviteToken ?? undefined,
      }),
    });
  }, [intendedOrgSlug, pendingInviteToken]);

  return null;
}
