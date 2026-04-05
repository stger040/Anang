import type { PatientPayTokenFailureReason } from "@/lib/patient-pay-token";
import { PATIENT_PAY_DEFAULT_TTL_SEC } from "@/lib/patient-pay-token";
import { Card } from "@anang/ui";
import Link from "next/link";

const DAYS = Math.round(PATIENT_PAY_DEFAULT_TTL_SEC / (24 * 60 * 60));

export function PatientPayLinkErrorPanel({
  reason,
  orgSlug,
  orgDisplayName,
  supportRef,
  variant = "token",
}: {
  reason?: PatientPayTokenFailureReason | "statement_missing";
  orgSlug: string;
  orgDisplayName?: string | null;
  /** Correlation id from `x-request-id` (middleware) — safe to read to support staff. */
  supportRef?: string;
  variant?: "token" | "statement" | "receipt";
}) {
  const title =
    variant === "receipt"
      ? "We could not open this receipt"
      : variant === "statement"
        ? "Statement not available"
        : reasonCopy(reason ?? "invalid").title;

  const body =
    variant === "receipt"
      ? "Return from checkout usually includes a full web address. Open the link from your confirmation email, or go to billing home and open your statement again. If you were charged in error, contact billing with the time of payment."
      : variant === "statement"
        ? "This payment link may be outdated or the statement was removed. Ask billing for a new link if you still owe a balance."
        : reasonCopy(reason ?? "invalid").body;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      {orgDisplayName ? (
        <p className="text-center text-xs font-medium uppercase tracking-wide text-slate-500">
          {orgDisplayName}
        </p>
      ) : null}
      <Card className="mt-6 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
        {supportRef ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center font-mono text-xs text-slate-700">
            Support reference: {supportRef}
          </p>
        ) : null}
        <p className="mt-6 text-center text-sm">
          <Link
            href={`/p/${encodeURIComponent(orgSlug)}`}
            className="font-medium text-teal-700 underline"
          >
            Billing home
          </Link>
        </p>
      </Card>
    </div>
  );
}

function reasonCopy(
  reason: PatientPayTokenFailureReason | "statement_missing",
): {
  title: string;
  body: string;
} {
  switch (reason) {
    case "statement_missing":
      return {
        title: "Statement not available",
        body: "This payment link may be outdated or the statement was removed.",
      };
    case "unconfigured":
      return {
        title: "Online billing unavailable",
        body:
          "Payment links are not configured on this site yet. Please use the phone number or address on your paper statement to reach billing.",
      };
    case "expired":
      return {
        title: "This payment link expired",
        body: `For security, links only work for about ${DAYS} days. Request a new statement link from your provider’s billing department.`,
      };
    case "wrong_org":
      return {
        title: "Link does not match this site",
        body:
          "You may have followed a bookmark for a different organization. Open the link from your latest billing message or use billing home below.",
      };
    case "malformed":
    case "invalid":
      return {
        title: "This link is incomplete or invalid",
        body:
          "The web address may have been cut off when copied. Try opening the link directly from your email or text message, or ask billing to resend it.",
      };
    default:
      return {
        title: "We could not open this link",
        body: "Please contact your provider’s billing department for help.",
      };
  }
}
