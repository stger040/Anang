"use client";

import { Button } from "@anang/ui";

export function DemoLoginButton({ email }: { email: string }) {
  return (
    <Button
      type="button"
      className="shrink-0"
      variant="secondary"
      onClick={async () => {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const j = (await res.json()) as { redirectTo?: string };
        if (j.redirectTo) window.location.href = j.redirectTo;
      }}
    >
      Continue
    </Button>
  );
}
