import { validateGreenwayPublicJwksJson } from "@/lib/greenway-jwks-public";
import { NextResponse } from "next/server";

/**
 * Public JWKS for Greenway Developer Platform backend-service app registration.
 * Populated via GREENWAY_JWKS_JSON (public keys only — never commit private keys).
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7517
 */
export const dynamic = "force-dynamic";

const JWKS_CONTENT_TYPE = "application/jwk-set+json";

export function GET() {
  const raw = process.env.GREENWAY_JWKS_JSON?.trim();
  if (!raw) {
    return NextResponse.json(
      {
        error:
          "JWKS not configured. Set GREENWAY_JWKS_JSON to a public JWKS document (ES384 / P-384).",
      },
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
  const result = validateGreenwayPublicJwksJson(raw);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Invalid GREENWAY_JWKS_JSON", detail: result.error },
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  return new NextResponse(result.normalizedJson, {
    status: 200,
    headers: {
      "Content-Type": JWKS_CONTENT_TYPE,
      "Cache-Control": "public, max-age=300",
    },
  });
}
