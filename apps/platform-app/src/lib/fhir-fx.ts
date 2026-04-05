/**
 * Pilot FX: foreign **Money** minor units → **USD cents** for Pay / Stripe alignment on FHIR fixture import.
 * Rates are **USD per 1.0 unit of major foreign currency** (e.g. 1 EUR → rate USD).
 * **`FHIR_IMPORT_FX_RATES_JSON`** overrides / extends built-ins. Not for regulated pricing — refresh for production.
 */

/** ISO 4217 minor-unit decimals; unknown → **2** (USD-style). */
const ISO_4217_MINOR_DECIMALS: Record<string, number> = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  CLP: 0,
  BIF: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

/** Indicative USD-per-major-unit; replace with env or live feed for real use. */
const BUILTIN_USD_PER_MAJOR_UNIT: Record<string, number> = {
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0068,
  CAD: 0.72,
  AUD: 0.63,
  CHF: 1.12,
  SEK: 0.095,
  NOK: 0.091,
  DKK: 0.145,
  PLN: 0.25,
  CNY: 0.14,
  INR: 0.012,
  MXN: 0.055,
  BRL: 0.18,
  NZD: 0.58,
  SGD: 0.74,
  HKD: 0.128,
  KRW: 0.00075,
  CZK: 0.044,
  HUF: 0.0028,
  ILS: 0.27,
  THB: 0.029,
  ZAR: 0.055,
};

export function minorDecimalPlacesForCurrency(currencyUpper: string): number {
  if (!currencyUpper) return 2;
  return ISO_4217_MINOR_DECIMALS[currencyUpper] ?? 2;
}

let envRatesCache: Record<string, number> | null | undefined;

function fxRatesFromEnv(): Record<string, number> | null {
  if (envRatesCache !== undefined) return envRatesCache;
  const raw = process.env.FHIR_IMPORT_FX_RATES_JSON?.trim();
  if (!raw) {
    envRatesCache = null;
    return null;
  }
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) {
      envRatesCache = null;
      return null;
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      const code = k.trim().toUpperCase();
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out[code] = v;
    }
    envRatesCache = Object.keys(out).length ? out : null;
    return envRatesCache;
  } catch {
    envRatesCache = null;
    return null;
  }
}

export type FhirFxLedger = {
  skippedNoRate: number;
  usedEnvRate: boolean;
  usedBuiltinRate: boolean;
};

/**
 * When **true**, **{@link normalizeFhirBundlePayload}** rejects the bundle if FX would drop any foreign line
 * or if matching **Claim**s yield no billable lines. Env **`FHIR_IMPORT_FX_STRICT`**: `1` / `true` / `yes`.
 */
export function resolveFhirImportFxStrict(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  const v = process.env.FHIR_IMPORT_FX_STRICT?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Convert FHIR **Money** minor units to **USD cents**. **`ledger`** records env vs built-in use and skips.
 */
export function foreignMinorToUsdCents(
  minorUnits: number,
  currencyIso: string,
  ledger: FhirFxLedger,
): number | null {
  const cur = currencyIso.trim().toUpperCase();
  if (cur === "USD" || cur === "USN") return minorUnits;
  if (minorUnits < 0) return null;

  const exp = minorDecimalPlacesForCurrency(cur);
  const major = minorUnits / 10 ** exp;

  const env = fxRatesFromEnv();
  let rate = env?.[cur];
  if (rate != null && rate > 0) {
    ledger.usedEnvRate = true;
  } else {
    rate = BUILTIN_USD_PER_MAJOR_UNIT[cur];
    if (rate != null && rate > 0) ledger.usedBuiltinRate = true;
  }
  if (rate == null || rate <= 0) {
    ledger.skippedNoRate += 1;
    return null;
  }

  const usdMajor = major * rate;
  return Math.round(usdMajor * 100);
}
