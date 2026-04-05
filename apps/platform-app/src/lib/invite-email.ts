import { getBrand } from "@anang/brand";

import { INVITE_EXPIRY_DAYS } from "@/lib/user-invite";

export type InviteEmailDelivery =
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

/**
 * Sends invite link if `RESEND_API_KEY` or `SENDGRID_API_KEY` is set; otherwise `skipped`.
 */
export async function sendTenantInviteEmail(opts: {
  to: string;
  inviteUrl: string;
  tenantDisplayName: string;
  roleLabel: string;
}): Promise<InviteEmailDelivery> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const sendgridKey = process.env.SENDGRID_API_KEY?.trim();

  const b = getBrand();
  const company = b.company.displayName;
  const subject = `Invitation to ${opts.tenantDisplayName} — ${company}`;

  const text = [
    `${company}: you were invited to join ${opts.tenantDisplayName} on the platform.`,
    `Role: ${opts.roleLabel}.`,
    "",
    `Accept your invitation (sign in with this email):`,
    opts.inviteUrl,
    "",
    `This link expires in about ${INVITE_EXPIRY_DAYS} days.`,
  ]
    .join("\n")
    .replace(/\n\n\n+/g, "\n\n");

  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b">
  <p><strong>${escapeHtml(company)}</strong> — workspace invitation</p>
  <p>You were invited to <strong>${escapeHtml(opts.tenantDisplayName)}</strong> as <strong>${escapeHtml(opts.roleLabel)}</strong>.</p>
  <p><a href="${escapeHtml(opts.inviteUrl)}" style="color:#0f766e">Accept invitation</a></p>
  <p style="font-size:12px;color:#64748b">Or paste this URL into your browser:<br/>${escapeHtml(opts.inviteUrl)}</p>
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
