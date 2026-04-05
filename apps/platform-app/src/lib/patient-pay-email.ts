import { getBrand } from "@anang/brand";

import { PATIENT_PAY_DEFAULT_TTL_SEC } from "@/lib/patient-pay-token";

export type PatientPayEmailDelivery =
  | { status: "sent" }
  | { status: "skipped" }
  | { status: "failed"; message: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function daysFromTtlSec(ttlSec: number): string {
  const d = Math.round(ttlSec / 86400);
  return d >= 1 ? `${d} day${d === 1 ? "" : "s"}` : "a short time";
}

/**
 * Sends patient Pay link when `RESEND_API_KEY` or `SENDGRID_API_KEY` is set; otherwise `skipped`.
 */
export async function sendPatientPayLinkEmail(opts: {
  to: string;
  payUrl: string;
  tenantDisplayName: string;
  patientFirstName: string;
  statementNumber: string;
  amountDueLabel: string;
  ttlSec?: number;
}): Promise<PatientPayEmailDelivery> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const sendgridKey = process.env.SENDGRID_API_KEY?.trim();

  const b = getBrand();
  const company = b.company.displayName;
  const ttlSec = opts.ttlSec ?? PATIENT_PAY_DEFAULT_TTL_SEC;
  const ttlLabel = daysFromTtlSec(ttlSec);
  const greeting = opts.patientFirstName.trim() || "there";

  const subject = `Your bill from ${opts.tenantDisplayName} — ${company}`;

  const text = [
    `Hello ${greeting},`,
    "",
    `${opts.tenantDisplayName} has a statement ready for you (${opts.statementNumber}). Amount due: ${opts.amountDueLabel}.`,
    "",
    `View and pay securely (no separate login required):`,
    opts.payUrl,
    "",
    `For your security, you may be asked to confirm your date of birth or the last four characters of your account number on file before details are shown.`,
    "",
    `This link expires in about ${ttlLabel}. If you did not expect this message, contact ${opts.tenantDisplayName} billing.`,
    "",
    `— ${company}`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b">
  <p>Hello ${escapeHtml(greeting)},</p>
  <p><strong>${escapeHtml(opts.tenantDisplayName)}</strong> has a statement ready for you
    (<span style="font-family:ui-monospace,monospace">${escapeHtml(opts.statementNumber)}</span>).
    Amount due: <strong>${escapeHtml(opts.amountDueLabel)}</strong>.</p>
  <p><a href="${escapeHtml(opts.payUrl)}" style="color:#0f766e;font-weight:600">View and pay securely</a></p>
  <p style="font-size:12px;color:#64748b">Or paste this URL into your browser:<br/>${escapeHtml(opts.payUrl)}</p>
  <p style="font-size:12px;color:#64748b">For your security, you may need to confirm your date of birth or the last four characters of your account number before details are shown.</p>
  <p style="font-size:12px;color:#64748b">This link expires in about ${escapeHtml(ttlLabel)}.</p>
</body></html>`.trim();

  if (resendKey) {
    const from =
      process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
    const fromHeader = from.includes("<") ? from : `${company} <${from}>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [opts.to],
        subject,
        text,
        html,
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!res.ok) {
      const msg =
        typeof body?.message === "string"
          ? body.message
          : `Resend HTTP ${res.status}`;
      return { status: "failed", message: msg };
    }
    return { status: "sent" };
  }

  if (sendgridKey) {
    const fromEmail =
      process.env.SENDGRID_FROM_EMAIL?.trim() || "noreply@example.com";
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }] }],
        from: { email: fromEmail, name: company },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      }),
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      return {
        status: "failed",
        message: raw || `SendGrid HTTP ${res.status}`,
      };
    }
    return { status: "sent" };
  }

  return { status: "skipped" };
}
