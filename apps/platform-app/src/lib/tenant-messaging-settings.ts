/**
 * Optional per-tenant SMS / Twilio overrides in `Tenant.settings` (JSON).
 * Do not store long-lived production secrets in DB without encryption — subaccount
 * tokens belong in a vault; this shape supports pilot / single-tenant configs.
 */

export type TenantSmsQuietHours = {
  /** Local hour [0,23] inclusive start of quiet window */
  startHour: number;
  /** Local hour [0,23] inclusive end (exclusive of end in typical "21–8" wrap) */
  endHour: number;
  /** IANA tz, e.g. America/Chicago */
  timezone?: string;
};

export type TenantMessagingSettings = {
  smsQuietHours?: TenantSmsQuietHours;
  twilio?: {
    accountSid: string;
    authToken: string;
  };
};

function num(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n;
}

function str(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t || null;
}

export function parseTenantMessagingSettings(
  tenantSettings: unknown,
): TenantMessagingSettings | null {
  if (!tenantSettings || typeof tenantSettings !== "object" || Array.isArray(tenantSettings)) {
    return null;
  }
  const root = tenantSettings as Record<string, unknown>;
  const messaging = root.messaging;
  if (!messaging || typeof messaging !== "object" || Array.isArray(messaging)) {
    return null;
  }
  const m = messaging as Record<string, unknown>;
  const qhRaw = m.smsQuietHours;
  let smsQuietHours: TenantSmsQuietHours | undefined;
  if (qhRaw && typeof qhRaw === "object" && !Array.isArray(qhRaw)) {
    const q = qhRaw as Record<string, unknown>;
    const sh = num(q.startHour);
    const eh = num(q.endHour);
    if (sh != null && eh != null && sh >= 0 && sh <= 23 && eh >= 0 && eh <= 23) {
      smsQuietHours = {
        startHour: sh,
        endHour: eh,
        timezone: str(q.timezone) ?? undefined,
      };
    }
  }
  const twRaw = m.twilio;
  let twilio: TenantMessagingSettings["twilio"];
  if (twRaw && typeof twRaw === "object" && !Array.isArray(twRaw)) {
    const t = twRaw as Record<string, unknown>;
    const accountSid = str(t.accountSid);
    const authToken = str(t.authToken);
    if (accountSid && authToken) {
      twilio = { accountSid, authToken };
    }
  }
  if (!smsQuietHours && !twilio) return null;
  return { ...(smsQuietHours ? { smsQuietHours } : {}), ...(twilio ? { twilio } : {}) };
}

function hourInTimeZone(now: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).format(now);
  const v = parseInt(h, 10);
  return Number.isFinite(v) ? v : now.getUTCHours();
}

export function isWithinSmsQuietHours(
  now: Date,
  qh: TenantSmsQuietHours,
): boolean {
  const tz = qh.timezone?.trim() || "UTC";
  let hour: number;
  try {
    hour = hourInTimeZone(now, tz);
  } catch {
    hour = now.getUTCHours();
  }
  const s = qh.startHour;
  const e = qh.endHour;
  if (s === e) return false;
  if (s > e) {
    return hour >= s || hour < e;
  }
  return hour >= s && hour < e;
}
