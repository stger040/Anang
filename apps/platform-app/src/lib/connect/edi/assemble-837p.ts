/**
 * Minimal HIPAA 5010 837P (professional) string builder from canonical draft rows.
 * Teaching / rehearsal shape — not certified for production submission (E2b2b2).
 * @see Implementation guide 005010X222A1 for full compliance work (E2b2b4).
 */

import type { TradingPartnerEnrollmentV1 } from "@/lib/trading-partner-enrollment";

export type Assemble837pTradingPartner = {
  isaSenderId: string;
  isaReceiverId: string;
  gsSenderCode: string;
  gsReceiverCode: string;
  /** NM1*41 submitter org */
  submitterName: string;
  /** NM1*40 receiver / payer org */
  receiverName: string;
  /** NM1*85 billing provider — rendering org name */
  billingProviderOrgName: string;
  /** 10-digit NPI (stylistic; validate with payer in real enrollments) */
  billingProviderNpi: string;
};

export type Assemble837pPatient = {
  firstName: string;
  lastName: string;
  mrn?: string | null;
  dob?: Date | null;
};

export type Assemble837pEncounter = {
  dateOfService: Date;
};

export type Assemble837pLine = {
  cpt: string;
  icd10: string;
  modifier?: string | null;
  units: number;
  chargeCents: number;
};

export type Assemble837pCoverage = {
  payerName: string;
  memberId?: string | null;
} | null;

export type Assemble837pControls = {
  isa13: string;
  gs06: string;
  st02: string;
};

export type Assemble837pInput = {
  now: Date;
  /** CLM / trace identifier (e.g. draft-scoped), avoid * and ~ */
  claimControlNumber: string;
  controls: Assemble837pControls;
  tradingPartner: Assemble837pTradingPartner;
  patient: Assemble837pPatient;
  encounter: Assemble837pEncounter;
  lines: Assemble837pLine[];
  primaryCoverage: Assemble837pCoverage;
};

function sanitizeToken(s: string): string {
  return s.replace(/[*~]/g, " ").replace(/\s+/g, " ").trim();
}

function padIsa(s: string, len: number): string {
  const t = sanitizeToken(s).slice(0, len);
  return t.padEnd(len, " ");
}

/** CCYYMMDD */
export function formatX12Date(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** HHMM */
function formatX12TimeHm(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}${min}`;
}

/** HHMMSS */
function formatX12TimeHms(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const sec = String(d.getUTCSeconds()).padStart(2, "0");
  return `${h}${min}${sec}`;
}

function dollarsFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function icd837(icd: string): string {
  return sanitizeToken(icd).replace(/\./g, "").toUpperCase();
}

function orderedUniqueIcds(lines: Assemble837pLine[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ln of lines) {
    const k = icd837(ln.icd10);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function joinSeg(parts: string[]): string {
  return `${parts.join("*")}~`;
}

/**
 * Builds one interchange (ISA through IEA). Control numbers must be numeric strings where required.
 */
export function assemble837pProfessional(input: Assemble837pInput): string {
  const { lines } = input;
  if (lines.length === 0) {
    throw new Error("assemble837pProfessional requires at least one line");
  }

  const dateIsa = formatX12Date(input.now);
  const timeIsa = formatX12TimeHm(input.now);
  const timeBht = formatX12TimeHms(input.now);
  const dateGs = formatX12Date(input.now);
  const timeGs = formatX12TimeHms(input.now);
  const dos = formatX12Date(input.encounter.dateOfService);

  const sender = padIsa(input.tradingPartner.isaSenderId, 15);
  const receiver = padIsa(input.tradingPartner.isaReceiverId, 15);
  const claimRef = sanitizeToken(input.claimControlNumber).slice(0, 38);
  if (!claimRef) {
    throw new Error("claimControlNumber is required");
  }

  const totalCents = lines.reduce((s, ln) => s + ln.chargeCents, 0);
  const totalUsd = dollarsFromCents(totalCents);
  const icds = orderedUniqueIcds(lines);
  const principalIcd = icds[0] ?? "UNKNOWN";

  const ln = sanitizeToken(input.patient.lastName).slice(0, 60);
  const fn = sanitizeToken(input.patient.firstName).slice(0, 35);
  const memberId =
    sanitizeToken(
      input.primaryCoverage?.memberId ??
        input.patient.mrn ??
        claimRef.slice(0, 20),
    ).slice(0, 80) || "UNKNOWN";

  const gender = "U";
  const dobStr = input.patient.dob
    ? formatX12Date(input.patient.dob)
    : "19800101";

  const payerName = sanitizeToken(
    input.primaryCoverage?.payerName ?? "UNKNOWN PAYER",
  ).slice(0, 60);

  const submitterOrg = sanitizeToken(
    input.tradingPartner.submitterName,
  ).slice(0, 60);
  const receiverOrg = sanitizeToken(
    input.tradingPartner.receiverName,
  ).slice(0, 60);
  const billOrg = sanitizeToken(
    input.tradingPartner.billingProviderOrgName,
  ).slice(0, 60);
  const npi = sanitizeToken(input.tradingPartner.billingProviderNpi).replace(
    /\D/g,
    "",
  ).slice(0, 10);

  const ts: string[] = [];

  ts.push(
    joinSeg([
      "ST",
      "837",
      input.controls.st02,
      "005010X222A1",
    ]),
  );
  ts.push(
    joinSeg([
      "BHT",
      "0019",
      "00",
      claimRef,
      formatX12Date(input.now),
      timeBht,
      "CH",
    ]),
  );
  ts.push(joinSeg(["NM1", "41", "2", submitterOrg, "", "", "", "", "46", "ANANG"]));
  ts.push(joinSeg(["NM1", "40", "2", receiverOrg, "", "", "", "", "46", "PAYER"]));
  ts.push(joinSeg(["HL", "1", "", "20", "1"]));
  ts.push(
    joinSeg([
      "NM1",
      "85",
      "2",
      billOrg,
      "",
      "",
      "",
      "",
      "XX",
      npi || "0000000000",
    ]),
  );
  ts.push(joinSeg(["HL", "2", "1", "22", "0"]));
  ts.push(joinSeg(["SBR", "P", "18", "", "", "", "", "", "CI"]));
  ts.push(joinSeg(["NM1", "IL", "1", ln, fn, "", "", "", "MI", memberId]));
  ts.push(joinSeg(["DMG", "D8", dobStr, gender]));
  ts.push(joinSeg(["HL", "3", "2", "23", "0"]));
  ts.push(joinSeg(["NM1", "QC", "1", ln, fn]));
  ts.push(
    joinSeg(["CLM", claimRef, totalUsd, "", "", "11:B:1", "Y", "A", "Y", "Y"]),
  );
  ts.push(joinSeg(["DTP", "472", "D8", dos]));

  const hiParts = ["HI", `ABK:${principalIcd}`];
  for (const extra of icds.slice(1)) {
    hiParts.push(`ABF:${extra}`);
  }
  ts.push(joinSeg(hiParts));

  let lx = 0;
  for (const row of lines) {
    lx += 1;
    ts.push(joinSeg(["LX", String(lx)]));
    const cpt = sanitizeToken(row.cpt).replace(/\D/g, "").slice(0, 5);
    const mod = row.modifier
      ? sanitizeToken(row.modifier).slice(0, 2)
      : "";
    const proc = mod ? `HC:${cpt}:${mod}` : `HC:${cpt}`;
    ts.push(
      joinSeg([
        "SV1",
        proc,
        dollarsFromCents(row.chargeCents),
        "UN",
        String(Math.max(1, row.units)),
        "",
        "",
        "1",
      ]),
    );
  }

  const seCount = ts.length + 1;
  ts.push(joinSeg(["SE", String(seCount), input.controls.st02]));

  const tsBody = ts.join("");

  const gs = joinSeg([
    "GS",
    "HC",
    input.tradingPartner.gsSenderCode.slice(0, 15),
    input.tradingPartner.gsReceiverCode.slice(0, 15),
    dateGs,
    timeGs,
    input.controls.gs06,
    "X",
    "005010X222A1",
  ]);

  const ge = joinSeg(["GE", "1", input.controls.gs06]);

  const isa = joinSeg([
    "ISA",
    "00",
    "".padEnd(10, " "),
    "00",
    "".padEnd(10, " "),
    "ZZ",
    sender,
    "ZZ",
    receiver,
    dateIsa.slice(2),
    timeIsa,
    "^",
    "00501",
    input.controls.isa13,
    "0",
    "P",
    ">",
  ]);

  const iea = joinSeg(["IEA", "1", input.controls.isa13]);

  return `${isa}${gs}${tsBody}${ge}${iea}`;
}

/** Defaults when Implementation hub enrollment is incomplete */
export function defaultTradingPartnerFor837p(): Assemble837pTradingPartner {
  return {
    isaSenderId: "ANANGSUBMIT",
    isaReceiverId: "PAYERPLACE",
    gsSenderCode: "ANANG",
    gsReceiverCode: "PAYER",
    submitterName: "Anang Submit",
    receiverName: "Payer Receiver",
    billingProviderOrgName: "Rendering Group",
    billingProviderNpi: "1316235193",
  };
}

/** Merge stored enrollment (E2b2b1) with safe fallbacks for rehearsal X12. */
export function tradingPartnerFor837pFromTenant(
  enrollment: TradingPartnerEnrollmentV1 | undefined,
  fallbacks: { orgName: string },
): Assemble837pTradingPartner {
  const d = defaultTradingPartnerFor837p();
  const org = sanitizeToken(fallbacks.orgName).slice(0, 60) || d.billingProviderOrgName;
  if (!enrollment) {
    return {
      ...d,
      submitterName: org,
      billingProviderOrgName: org,
    };
  }
  const label =
    sanitizeToken(
      enrollment.displayLabel ?? enrollment.clearinghouseKey ?? "",
    ).slice(0, 60) || org;
  return {
    isaSenderId: enrollment.isaSenderId ?? d.isaSenderId,
    isaReceiverId: enrollment.isaReceiverId ?? d.isaReceiverId,
    gsSenderCode: enrollment.gsSenderCode ?? d.gsSenderCode,
    gsReceiverCode: enrollment.gsReceiverCode ?? d.gsReceiverCode,
    submitterName: label,
    receiverName: label === org ? d.receiverName : `${label} receiver`,
    billingProviderOrgName: org,
    billingProviderNpi: d.billingProviderNpi,
  };
}
