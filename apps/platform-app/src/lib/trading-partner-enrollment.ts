/**
 * Clearinghouse / trading-partner enrollment profile (E2b2b1).
 * Stored at Tenant.settings.implementation.tradingPartnerEnrollment — not PHI.
 */

export type TradingPartnerEnrollmentV1 = {
  /** Short key: availity, change_healthcare, other, or custom text */
  clearinghouseKey?: string;
  displayLabel?: string;
  environment: "test" | "production";
  isaSenderId?: string;
  isaReceiverId?: string;
  gsSenderCode?: string;
  gsReceiverCode?: string;
  /** True when ISA/GS production enrollment is approved / live */
  interchangeEnrollmentComplete?: boolean;
  notes?: string;
};

export function parseTradingPartnerEnrollment(
  raw: unknown,
): TradingPartnerEnrollmentV1 | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const env = o.environment === "production" ? "production" : "test";
  const interchangeEnrollmentComplete = o.interchangeEnrollmentComplete === true;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  const out: TradingPartnerEnrollmentV1 = {
    environment: env,
    clearinghouseKey: str("clearinghouseKey"),
    displayLabel: str("displayLabel"),
    isaSenderId: str("isaSenderId"),
    isaReceiverId: str("isaReceiverId"),
    gsSenderCode: str("gsSenderCode"),
    gsReceiverCode: str("gsReceiverCode"),
    notes: str("notes"),
    interchangeEnrollmentComplete,
  };
  if (!tradingPartnerEnrollmentHasContent(out)) {
    return undefined;
  }
  return out;
}

export function tradingPartnerEnrollmentHasContent(
  tp: TradingPartnerEnrollmentV1,
): boolean {
  if (tp.interchangeEnrollmentComplete) {
    return true;
  }
  if (tp.environment === "production") {
    return true;
  }
  return Boolean(
    tp.clearinghouseKey ||
      tp.displayLabel ||
      tp.isaSenderId ||
      tp.isaReceiverId ||
      tp.gsSenderCode ||
      tp.gsReceiverCode ||
      (tp.notes && tp.notes.length > 0),
  );
}

export function readTradingPartnerEnrollmentFromForm(
  formData: FormData,
): TradingPartnerEnrollmentV1 | undefined {
  const clearinghouseKey = String(
    formData.get("tp_clearinghouseKey") ?? "",
  ).trim();
  const clearinghouseOther = String(
    formData.get("tp_clearinghouseOther") ?? "",
  ).trim();
  const keyFinal =
    clearinghouseKey === "other" && clearinghouseOther
      ? clearinghouseOther
      : clearinghouseKey || undefined;

  const displayLabel = String(formData.get("tp_displayLabel") ?? "").trim();
  const envRaw = String(formData.get("tp_environment") ?? "test").trim();
  const environment =
    envRaw === "production" ? "production" : "test";
  const isaSenderId = String(formData.get("tp_isaSenderId") ?? "").trim();
  const isaReceiverId = String(formData.get("tp_isaReceiverId") ?? "").trim();
  const gsSenderCode = String(formData.get("tp_gsSenderCode") ?? "").trim();
  const gsReceiverCode = String(formData.get("tp_gsReceiverCode") ?? "").trim();
  const notes = String(formData.get("tp_notes") ?? "").trim();
  const interchangeEnrollmentComplete =
    formData.get("tp_interchangeEnrollmentComplete") === "on";

  const draft: TradingPartnerEnrollmentV1 = {
    environment,
    clearinghouseKey: keyFinal,
    displayLabel: displayLabel || undefined,
    isaSenderId: isaSenderId || undefined,
    isaReceiverId: isaReceiverId || undefined,
    gsSenderCode: gsSenderCode || undefined,
    gsReceiverCode: gsReceiverCode || undefined,
    notes: notes || undefined,
    interchangeEnrollmentComplete,
  };

  if (!tradingPartnerEnrollmentHasContent(draft)) {
    return undefined;
  }
  return draft;
}

/** One-line summary for Connect hub (no secrets — these are interchange ids). */
export function formatTradingPartnerSummary(
  tp: TradingPartnerEnrollmentV1 | undefined,
): string | null {
  if (!tp || !tradingPartnerEnrollmentHasContent(tp)) {
    return null;
  }
  const parts = [
    tp.displayLabel ?? tp.clearinghouseKey,
    tp.environment === "production" ? "production" : "test",
    tp.interchangeEnrollmentComplete ? "interchange enrolled" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
