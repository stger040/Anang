import type { ExplainLineInput } from "@/lib/ai/explanation-types";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function templateExplainStatementLine(input: ExplainLineInput): string {
  const amt = formatUsd(input.amountCents);
  const code = input.code.trim() || "—";
  const desc = input.description.trim() || "Service or supply";
  const parts = [
    `This line uses code ${code} and describes “${desc}” for ${amt}.`,
    "This type of line usually reflects a specific service, procedure, drug, or fee from your visit. The exact meaning depends on how your provider coded the encounter and your payer’s contract.",
    "Your explanation of benefits (EOB) or electronic remittance from insurance, and your provider’s billing office, are the authoritative sources for why this amount was billed and what you owe after insurance.",
  ];
  return parts.join("\n\n");
}
