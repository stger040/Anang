import { Button } from "@anang/ui";
import Link from "next/link";

export function ConnectSubnav({
  orgSlug,
  current,
}: {
  orgSlug: string;
  current: "claims" | "remittances" | "authorizations";
}) {
  const base = `/o/${orgSlug}/connect`;

  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-slate-200 pb-4"
      aria-label="Connect sections"
    >
      <Link href={base}>
        <Button
          type="button"
          size="sm"
          variant={current === "claims" ? "primary" : "secondary"}
        >
          Claims
        </Button>
      </Link>
      <Link href={`${base}/remittances`}>
        <Button
          type="button"
          size="sm"
          variant={current === "remittances" ? "primary" : "secondary"}
        >
          Remittances
        </Button>
      </Link>
      <Link href={`${base}/authorizations`}>
        <Button
          type="button"
          size="sm"
          variant={current === "authorizations" ? "primary" : "secondary"}
        >
          Authorizations
        </Button>
      </Link>
    </nav>
  );
}
