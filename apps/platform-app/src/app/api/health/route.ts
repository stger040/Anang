import { getBrand } from "@anang/brand";
import { NextResponse } from "next/server";

/** Liveness for load balancers and quick “is the app up?” checks during demos. */
export function GET() {
  const b = getBrand();
  return NextResponse.json({
    ok: true,
    serviceId: b.technical.serviceId,
    ts: new Date().toISOString(),
  });
}
