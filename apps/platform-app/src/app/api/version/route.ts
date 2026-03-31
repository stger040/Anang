import { getBrand } from "@anang/brand";
import { NextResponse } from "next/server";

const APP_VERSION = "0.1.0";

/** Deploy identity — pair with `/api/health` for support screens. */
export function GET() {
  const b = getBrand();
  return NextResponse.json({
    version: APP_VERSION,
    serviceId: b.technical.serviceId,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
}
