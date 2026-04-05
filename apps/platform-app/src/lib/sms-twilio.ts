import { platformLog } from "@/lib/platform-log";

export type SendSmsResult =
  | { sent: true; sid: string }
  | { sent: false; skipped: true }
  | { sent: false; skipped: false; error: string };

/**
 * Optional Twilio SMS. Configure TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN and either
 * TWILIO_FROM_NUMBER (E.164) or TWILIO_MESSAGING_SERVICE_SID (MG…).
 */
export async function sendPatientPaySmsViaTwilio(args: {
  toE164: string;
  body: string;
  requestId?: string;
  /** Per-tenant Twilio subaccount (optional); otherwise env defaults. */
  twilioOverride?: { accountSid: string; authToken: string };
}): Promise<SendSmsResult> {
  const sid =
    args.twilioOverride?.accountSid?.trim() ||
    process.env.TWILIO_ACCOUNT_SID?.trim();
  const token =
    args.twilioOverride?.authToken?.trim() ||
    process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

  if (!sid || !token || (!fromNumber && !messagingServiceSid)) {
    return { sent: false, skipped: true };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams();
  form.set("To", args.toE164);
  form.set("Body", args.body);
  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid);
  } else if (fromNumber) {
    form.set("From", fromNumber);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
  } catch (e) {
    platformLog("warn", "sms.twilio.request_failed", {
      requestId: args.requestId,
      message: e instanceof Error ? e.message : "unknown",
    });
    return {
      sent: false,
      skipped: false,
      error: "SMS request failed",
    };
  }

  const json = (await res.json().catch(() => ({}))) as {
    sid?: string;
    message?: string;
    code?: number;
  };

  if (!res.ok) {
    platformLog("warn", "sms.twilio.error_response", {
      requestId: args.requestId,
      status: res.status,
      code: json.code,
      message: json.message,
    });
    return {
      sent: false,
      skipped: false,
      error: json.message ?? `Twilio error (${res.status})`,
    };
  }

  if (!json.sid) {
    return { sent: false, skipped: false, error: "Twilio returned no message sid" };
  }

  platformLog("info", "sms.twilio.sent", {
    requestId: args.requestId,
    twilioSid: json.sid,
  });

  return { sent: true, sid: json.sid };
}
